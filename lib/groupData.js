import {
  advanceRotationTurn,
  computeExpenseShares,
  generateGroupCode,
  getRotationCurrentUserId,
  getDisplayNameFromUser,
  pickPreferredDisplayName,
} from "./utils";
import { clearRuntimeCache, readRuntimeCache, writeRuntimeCache } from "./runtimeCache";

export const DISPLAY_NAME_STORAGE_KEY = "evenly-display-name";
const USER_GROUPS_CACHE_MS = 12000;
const USER_CONTACTS_CACHE_MS = 12000;
const GROUP_DETAIL_CACHE_MS = 10000;

export function getStoredDisplayName() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(DISPLAY_NAME_STORAGE_KEY)?.trim() || "";
}

export function setStoredDisplayName(displayName) {
  if (typeof window === "undefined") return;

  const trimmedName = String(displayName || "").trim();
  if (!trimmedName) {
    window.localStorage.removeItem(DISPLAY_NAME_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(DISPLAY_NAME_STORAGE_KEY, trimmedName);
}

function isMissingTableError(error, tableName) {
  return (
    String(error?.code || "") === "PGRST205" ||
    String(error?.code || "") === "42P01" ||
    new RegExp(tableName, "i").test(String(error?.message || ""))
  );
}

async function insertWithFallbacks(supabase, table, payloads, options = {}) {
  const { select = "*", single = true } = options;
  let lastError = null;

  for (const payload of payloads) {
    let query = supabase.from(table).insert(payload);
    if (select) {
      query = query.select(select);
      if (single) {
        query = query.single();
      }
    }

    const response = await query;
    if (!response.error) {
      return response;
    }

    lastError = response.error;
  }

  throw lastError || new Error(`Insert failed for ${table}.`);
}

async function updateWithFallbacks(supabase, table, matchers, payloads, options = {}) {
  const { select = "*", single = true } = options;
  let lastError = null;

  for (const payload of payloads) {
    let query = supabase.from(table).update(payload);

    for (const [column, value] of Object.entries(matchers)) {
      query = query.eq(column, value);
    }

    if (select) {
      query = query.select(select);
      if (single) {
        query = query.single();
      }
    }

    const response = await query;
    if (!response.error) {
      return response;
    }

    lastError = response.error;
  }

  throw lastError || new Error(`Update failed for ${table}.`);
}

async function upsertWithFallbacks(supabase, table, payloads, options = {}) {
  const { select = "*", single = true, onConflict } = options;
  let lastError = null;

  for (const payload of payloads) {
    let query = supabase.from(table).upsert(payload, onConflict ? { onConflict } : undefined);

    if (select) {
      query = query.select(select);
      if (single) {
        query = query.single();
      }
    }

    const response = await query;
    if (!response.error) {
      return response;
    }

    lastError = response.error;
  }

  throw lastError || new Error(`Upsert failed for ${table}.`);
}

export function normalizeInviteCode(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

export async function loadProfileName(supabase, user) {
  const cacheKey = `profile:${user?.id || "anon"}`;
  const cachedProfileName = readRuntimeCache(cacheKey, USER_GROUPS_CACHE_MS);
  if (cachedProfileName) {
    return cachedProfileName;
  }

  const storedName = getStoredDisplayName();
  const metadataName = pickPreferredDisplayName(
    user?.user_metadata?.display_name,
    user?.user_metadata?.name,
  );
  const fallbackName = pickPreferredDisplayName(storedName, metadataName, getDisplayNameFromUser(user, ""));

  if (!supabase || !user) {
    return fallbackName;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Profile lookup failed:", error);
    return fallbackName;
  }

  const resolvedName = pickPreferredDisplayName(storedName, metadataName, data?.display_name, fallbackName);
  writeRuntimeCache(cacheKey, resolvedName);
  return resolvedName;
}

export async function syncProfileName(supabase, user, displayName) {
  if (!supabase || !user || !displayName) return;

  try {
    await supabase.from("profiles").upsert(
      {
        user_id: user.id,
        display_name: displayName,
      },
      { onConflict: "user_id" },
    );
    setStoredDisplayName(displayName);
    clearRuntimeCache(["profile:"]);
  } catch (error) {
    console.error("Profile upsert skipped:", error);
  }

  try {
    await supabase
      .from("group_members")
      .update({ display_name: displayName })
      .eq("user_id", user.id);
  } catch (error) {
    console.error("Group member name sync skipped:", error);
  }
}

async function loadGroupAppearances(supabase, groupIds) {
  if (!supabase || !groupIds?.length) return new Map();

  const response = await supabase
    .from("group_appearance")
    .select("*")
    .in("group_id", groupIds);

  if (response.error) {
    if (isMissingTableError(response.error, "group_appearance")) {
      return new Map();
    }
    throw response.error;
  }

  return new Map((response.data || []).map((entry) => [entry.group_id, entry]));
}

function mergeAppearanceIntoGroup(group, appearance) {
  if (!group || !appearance) return group;

  return {
    ...group,
    card_color: appearance.card_color || group.card_color || group.color || null,
    card_image:
      appearance.card_image ||
      appearance.background_image ||
      appearance.image_url ||
      group.card_image ||
      group.background_image ||
      group.image_url ||
      null,
  };
}

export async function loadUserGroupsBundle(supabase, user) {
  const cacheKey = `groups:${user?.id || "anon"}`;
  const cachedBundle = readRuntimeCache(cacheKey, USER_GROUPS_CACHE_MS);
  if (cachedBundle) {
    return cachedBundle;
  }

  const profileNamePromise = loadProfileName(supabase, user);

  const membershipsResponse = await supabase
    .from("group_members")
    .select("*")
    .eq("user_id", user.id);

  if (membershipsResponse.error) throw membershipsResponse.error;

  const memberships = membershipsResponse.data || [];
  const groupIds = [...new Set(memberships.map((membership) => membership.group_id).filter(Boolean))];

  if (!groupIds.length) {
    const profileName = await profileNamePromise;
    return {
      profileName,
      memberships,
      groups: [],
      membersByGroup: {},
      expensesByGroup: {},
    };
  }

  const [profileName, groupsResponse, membersResponse, expensesResponse, appearanceMap] = await Promise.all([
    profileNamePromise,
    supabase
      .from("groups")
      .select("*")
      .in("id", groupIds),
    supabase
      .from("group_members")
      .select("id, group_id, user_id, display_name, role, created_at")
      .in("group_id", groupIds),
    supabase
      .from("expenses")
      .select("id, group_id, paid_by, participants, shares, split_type, amount_cents, round_up_cents")
      .in("group_id", groupIds),
    loadGroupAppearances(supabase, groupIds),
  ]);

  if (groupsResponse.error) throw groupsResponse.error;
  if (membersResponse.error) throw membersResponse.error;
  if (expensesResponse.error) {
    console.error("Expenses could not be loaded yet:", expensesResponse.error);
  }

  const membershipOrder = memberships.reduce((accumulator, membership) => {
    accumulator[membership.group_id] = membership.created_at || "";
    return accumulator;
  }, {});

  const groups = [...(groupsResponse.data || [])]
    .map((group) => mergeAppearanceIntoGroup(group, appearanceMap.get(group.id)))
    .sort((left, right) => {
    const leftDate = new Date(membershipOrder[left.id] || left.created_at || 0).getTime();
    const rightDate = new Date(membershipOrder[right.id] || right.created_at || 0).getTime();
    return rightDate - leftDate;
  });

  const membersByGroup = {};
  for (const member of membersResponse.data || []) {
    const normalizedMember =
      member.user_id === user.id ? { ...member, display_name: profileName } : member;
    membersByGroup[member.group_id] = membersByGroup[member.group_id] || [];
    membersByGroup[member.group_id].push(normalizedMember);
  }

  const expensesByGroup = {};
  for (const expense of expensesResponse.data || []) {
    expensesByGroup[expense.group_id] = expensesByGroup[expense.group_id] || [];
    expensesByGroup[expense.group_id].push(expense);
  }

  const bundle = {
    profileName,
    memberships,
    groups,
    membersByGroup,
    expensesByGroup,
  };

  writeRuntimeCache(cacheKey, bundle);
  return bundle;
}

export async function loadUserContacts(supabase, user) {
  if (!supabase || !user) return [];

  const cacheKey = `contacts:${user.id}`;
  const cachedContacts = readRuntimeCache(cacheKey, USER_CONTACTS_CACHE_MS);
  if (cachedContacts) {
    return cachedContacts;
  }

  const response = await supabase
    .from("contacts")
    .select("*")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: false });

  if (response.error) {
    const tableMissing =
      String(response.error.code || "") === "PGRST205" ||
      String(response.error.code || "") === "42P01" ||
      /contacts/i.test(String(response.error.message || ""));

    if (tableMissing) return [];
    throw response.error;
  }

  const contacts = response.data || [];
  writeRuntimeCache(cacheKey, contacts);
  return contacts;
}

export async function createContactRecord(supabase, user, payload) {
  if (!supabase || !user) {
    throw new Error("Sign in first.");
  }

  const { displayName, phone = "", email = "" } = payload;
  const trimmedName = String(displayName || "").trim();

  if (!trimmedName) {
    throw new Error("Add a name first.");
  }

  const response = await insertWithFallbacks(
    supabase,
    "contacts",
    [
      {
        owner_user_id: user.id,
        display_name: trimmedName,
        phone: String(phone || "").trim() || null,
        email: String(email || "").trim() || null,
        status: "guest",
      },
      {
        owner_user_id: user.id,
        display_name: trimmedName,
      },
    ],
    { select: "*" },
  );

  clearRuntimeCache();
  return response.data || null;
}

export async function loadGroupDetailBundle(supabase, groupId, user) {
  const cacheKey = `group:${groupId}:${user?.id || "anon"}`;
  const cachedBundle = readRuntimeCache(cacheKey, GROUP_DETAIL_CACHE_MS);
  if (cachedBundle) {
    return cachedBundle;
  }

  const profileNamePromise = loadProfileName(supabase, user);

  const [profileName, membershipResponse, groupResponse, membersResponse, expensesResponse, contextsResponse, settlementsResponse, appearanceMap, rotationsResponse] =
    await Promise.all([
      profileNamePromise,
      supabase.from("group_members").select("*").eq("group_id", groupId).eq("user_id", user.id).maybeSingle(),
      supabase.from("groups").select("*").eq("id", groupId).maybeSingle(),
      supabase.from("group_members").select("*").eq("group_id", groupId),
      supabase.from("expenses").select("*").eq("group_id", groupId).order("created_at", { ascending: false }),
      supabase.from("contexts").select("*").eq("group_id", groupId),
      supabase
        .from("settlements")
        .select("*")
        .eq("group_id", groupId)
        .order("settled_at", { ascending: false }),
      loadGroupAppearances(supabase, [groupId]),
      supabase.from("rotations").select("*").eq("group_id", groupId).order("created_at", { ascending: true }),
    ]);

  if (membershipResponse.error && membershipResponse.error.code !== "PGRST116") {
    throw membershipResponse.error;
  }
  if (groupResponse.error && groupResponse.error.code !== "PGRST116") {
    throw groupResponse.error;
  }
  if (membersResponse.error) throw membersResponse.error;
  if (expensesResponse.error) {
    console.error("Expenses lookup failed:", expensesResponse.error);
  }
  if (contextsResponse.error) {
    console.error("Contexts lookup failed:", contextsResponse.error);
  }
  const settlementsError = settlementsResponse.error;
  const settlementsTableMissing =
    settlementsError &&
    (String(settlementsError.code || "") === "PGRST205" ||
      String(settlementsError.code || "") === "42P01" ||
      /settlements/i.test(String(settlementsError.message || "")));

  if (settlementsError && !settlementsTableMissing) {
    console.error("Settlements lookup failed:", settlementsError);
  }

  const rotationsError = rotationsResponse.error;
  const rotationsTableMissing = rotationsError && isMissingTableError(rotationsError, "rotations");
  if (rotationsError && !rotationsTableMissing) {
    console.error("Rotations lookup failed:", rotationsError);
  }

  let rotationHistory = [];
  if (!rotationsTableMissing) {
    const rotationIds = (rotationsResponse.data || []).map((rotation) => rotation.id).filter(Boolean);
    if (rotationIds.length) {
      const historyResponse = await supabase
        .from("rotation_history")
        .select("*")
        .in("rotation_id", rotationIds)
        .order("completed_at", { ascending: false });

      if (historyResponse.error) {
        if (!isMissingTableError(historyResponse.error, "rotation_history")) {
          console.error("Rotation history lookup failed:", historyResponse.error);
        }
      } else {
        rotationHistory = historyResponse.data || [];
      }
    }
  }

  const bundle = {
    profileName,
    membership: membershipResponse.data || null,
    group: mergeAppearanceIntoGroup(groupResponse.data || null, appearanceMap.get(groupId)),
    members: (membersResponse.data || []).map((member) =>
      member.user_id === user.id ? { ...member, display_name: profileName } : member,
    ),
    expenses: expensesResponse.data || [],
    contexts: contextsResponse.data || [],
    recordedSettlements: settlementsTableMissing ? [] : settlementsResponse.data || [],
    rotations: rotationsTableMissing ? [] : rotationsResponse.data || [],
    rotationHistory,
  };

  writeRuntimeCache(cacheKey, bundle);
  return bundle;
}

export async function generateUniqueJoinCode(supabase) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = generateGroupCode();
    const existing = await supabase
      .from("groups")
      .select("id")
      .eq("join_code", code)
      .maybeSingle();

    if (existing.error) throw existing.error;
    if (!existing.data) return code;
  }

  throw new Error("Could not generate a unique code. Try again.");
}

export async function createGroupWithMembership(supabase, user, profileName, name, options = {}) {
  const code = await generateUniqueJoinCode(supabase);
  const displayName = getDisplayNameFromUser(user, profileName);
  const mode = options.mode === "trip" ? "trip" : "group";
  const tripStartDate = options.tripStartDate || null;
  const tripEndDate = options.tripEndDate || null;

  const groupPayloads = [
    {
      name,
      join_code: code,
      created_by: user.id,
      group_type: mode,
      start_date: tripStartDate,
      end_date: tripEndDate,
    },
    {
      name,
      join_code: code,
      owner_id: user.id,
      type: mode,
      starts_at: tripStartDate,
      ends_at: tripEndDate,
    },
    {
      name,
      join_code: code,
      created_by: user.id,
      group_type: mode,
    },
    {
      name,
      join_code: code,
      type: mode,
    },
    { name, join_code: code, created_by: user.id },
    { name, join_code: code, owner_id: user.id },
    { name, join_code: code },
  ];

  const groupResponse = await insertWithFallbacks(
    supabase,
    "groups",
    groupPayloads,
    { select: "*" },
  );

  const group = groupResponse.data;

  await insertWithFallbacks(
    supabase,
    "group_members",
    [
      { group_id: group.id, user_id: user.id, display_name: displayName, role: "admin" },
      { group_id: group.id, user_id: user.id, display_name: displayName, role: "member" },
      { group_id: group.id, user_id: user.id, display_name: displayName },
    ],
    { select: "*" },
  );

  clearRuntimeCache();
  return {
    group,
    code,
  };
}

export async function updateGroupCardColor(supabase, groupId, color) {
  if (!supabase || !groupId || !color) return null;

  try {
    try {
      const appearanceResponse = await upsertWithFallbacks(
        supabase,
        "group_appearance",
        [{ group_id: groupId, card_color: color }],
        { select: "*", single: true, onConflict: "group_id" },
      );

      clearRuntimeCache();
      return appearanceResponse.data || null;
    } catch (appearanceError) {
      if (!isMissingTableError(appearanceError, "group_appearance")) {
        console.error("Group appearance color sync skipped:", appearanceError);
      }
    }

    const response = await updateWithFallbacks(
      supabase,
      "groups",
      { id: groupId },
      [{ card_color: color }, { color }, {}],
      { select: "*", single: true },
    );

    clearRuntimeCache();
    return response.data || null;
  } catch (error) {
    console.error("Group color sync skipped:", error);
    return null;
  }
}

export async function updateGroupCardImage(supabase, groupId, imageData) {
  if (!supabase || !groupId || !imageData) return null;

  try {
    try {
      const appearanceResponse = await upsertWithFallbacks(
        supabase,
        "group_appearance",
        [{ group_id: groupId, card_image: imageData }],
        { select: "*", single: true, onConflict: "group_id" },
      );

      clearRuntimeCache();
      return appearanceResponse.data || null;
    } catch (appearanceError) {
      if (!isMissingTableError(appearanceError, "group_appearance")) {
        console.error("Group appearance image sync skipped:", appearanceError);
      }
    }

    const response = await updateWithFallbacks(
      supabase,
      "groups",
      { id: groupId },
      [
        { card_image: imageData },
        { background_image: imageData },
        { image_url: imageData },
      ],
      { select: "*", single: true },
    );

    clearRuntimeCache();
    return response.data || null;
  } catch (error) {
    console.error("Group image sync skipped:", error);
    return null;
  }
}

export async function joinGroupByCode(supabase, user, profileName, code) {
  const normalizedCode = normalizeInviteCode(code);
  const groupResponse = await supabase
    .from("groups")
    .select("*")
    .eq("join_code", normalizedCode)
    .maybeSingle();

  if (groupResponse.error) throw groupResponse.error;
  if (!groupResponse.data) {
    throw new Error("Invalid code. Try again.");
  }

  const existingMembership = await supabase
    .from("group_members")
    .select("id")
    .eq("group_id", groupResponse.data.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingMembership.error && existingMembership.error.code !== "PGRST116") {
    throw existingMembership.error;
  }

  if (existingMembership.data?.id) {
    throw new Error("You already joined this group.");
  }

  const displayName = getDisplayNameFromUser(user, profileName);

  await insertWithFallbacks(
    supabase,
    "group_members",
    [
      { group_id: groupResponse.data.id, user_id: user.id, display_name: displayName, role: "member" },
      { group_id: groupResponse.data.id, user_id: user.id, display_name: displayName, role: "admin" },
      { group_id: groupResponse.data.id, user_id: user.id, display_name: displayName },
    ],
    { select: "*" },
  );

  clearRuntimeCache();
  return groupResponse.data;
}

function buildContextPayloads(groupId, label, userId = null, type = "general", emoji = "🤝") {
  const basePayloads = [
    { group_id: groupId, name: label, emoji, closed: false, type },
    { group_id: groupId, name: label, emoji, closed: false },
    { group_id: groupId, name: label, type, emoji },
  ];

  if (!userId) return basePayloads;

  const enrichedPayloads = [];
  for (const payload of basePayloads) {
    enrichedPayloads.push({ ...payload, created_by: userId });
    enrichedPayloads.push({ ...payload, user_id: userId });
    enrichedPayloads.push({ ...payload, owner_id: userId });
    enrichedPayloads.push(payload);
  }

  return enrichedPayloads;
}

async function getContextTypeCandidates(supabase, groupId) {
  const candidates = [];
  const seen = new Set();

  function addCandidate(value) {
    const next = String(value || "").trim();
    if (!next || seen.has(next)) return;
    seen.add(next);
    candidates.push(next);
  }

  const [groupContexts, anyContexts] = await Promise.all([
    supabase.from("contexts").select("type").eq("group_id", groupId).limit(5),
    supabase.from("contexts").select("type").limit(10),
  ]);

  for (const row of groupContexts.data || []) {
    addCandidate(row.type);
  }

  for (const row of anyContexts.data || []) {
    addCandidate(row.type);
  }

  ["home", "trip"].forEach(addCandidate);

  return candidates;
}

export async function ensureContextId(supabase, groupId, userId = null) {
  const existingContexts = await supabase
    .from("contexts")
    .select("*")
    .eq("group_id", groupId)
    .limit(1);

  if (!existingContexts.error && existingContexts.data?.length) {
    return existingContexts.data[0].id;
  }

  const typeCandidates = await getContextTypeCandidates(supabase, groupId);
  const payloads = typeCandidates.flatMap((type) =>
    buildContextPayloads(groupId, "Shared", userId, type, "🤝"),
  );

  const response = await insertWithFallbacks(
    supabase,
    "contexts",
    payloads,
    { select: "*" },
  );

  return response.data?.id || null;
}

export async function resolveContextId(supabase, groupId, contextId, contextName, userId = null) {
  if (contextId) return contextId;

  const normalizedName = String(contextName || "").trim();

  if (normalizedName) {
    const existingContexts = await supabase
      .from("contexts")
      .select("*")
      .eq("group_id", groupId);

    if (existingContexts.error) {
      throw existingContexts.error;
    }

    const matchingContext = (existingContexts.data || []).find((context) => {
      const label = String(context.name || "").trim().toLowerCase();
      return label === normalizedName.toLowerCase();
    });

    if (matchingContext?.id) {
      return matchingContext.id;
    }

    const typeCandidates = await getContextTypeCandidates(supabase, groupId);
    const payloads = typeCandidates.flatMap((type) =>
      buildContextPayloads(groupId, normalizedName, userId, type, "📍"),
    );

    const response = await insertWithFallbacks(
      supabase,
      "contexts",
      payloads,
      { select: "*" },
    );

    return response.data?.id || null;
  }

  return ensureContextId(supabase, groupId, userId);
}

export async function createExpenseRecord(supabase, user, payload) {
  const {
    groupId,
    title,
    amountCents,
    roundUpCents = 0,
    paidBy,
    participants,
    shares,
    splitType,
    splitMethod = splitType === "custom" ? "custom" : "even",
    contextId,
    contextName,
    contactParticipants = [],
    contactShares = {},
    splitDetails = null,
  } = payload;

  let resolvedContextId = null;

  try {
    resolvedContextId = await resolveContextId(supabase, groupId, contextId, contextName, user.id);
  } catch (error) {
    console.error("Context setup failed:", error);
    throw new Error(error?.message || "We couldn't set up a context for this expense yet.");
  }

  if (!resolvedContextId) {
    throw new Error("We couldn't create a context for this expense yet.");
  }

  const base = {
    group_id: groupId,
    amount_cents: amountCents,
    round_up_cents: roundUpCents,
    paid_by: paidBy,
    participants,
    shares,
    split_type: splitType,
  };

  const basePayloadVariants = [
    {
      ...base,
      split_method: splitMethod,
      split_details: splitDetails,
    },
    {
      ...base,
      split_method: splitMethod,
    },
    {
      ...base,
      split_details: splitDetails,
    },
    base,
  ];

  const titlePayloads = [
    { title },
    { name: title },
    { description: title },
    {},
  ];

  const payloads = [];
  for (const basePayload of basePayloadVariants) {
    for (const titlePayload of titlePayloads) {
      payloads.push({
        ...basePayload,
        ...titlePayload,
        created_by: user.id,
        context_id: resolvedContextId,
      });
      payloads.push({
        ...basePayload,
        ...titlePayload,
        context_id: resolvedContextId,
      });
    }
  }

  const response = await insertWithFallbacks(supabase, "expenses", payloads, { select: "*" });
  const expense = response.data;

  try {
    const expenseParticipantRows = [];

    for (const participantId of participants || []) {
      expenseParticipantRows.push({
        expense_id: expense.id,
        group_id: groupId,
        member_id: participantId,
        share_cents:
          splitType === "custom"
            ? Number(shares?.[participantId] || 0)
            : Number(computeExpenseShares({ participants, amount_cents: amountCents, round_up_cents: roundUpCents, split_type: splitType, shares })?.[participantId] || 0),
      });
    }

    for (const contactId of contactParticipants || []) {
      expenseParticipantRows.push({
        expense_id: expense.id,
        group_id: groupId,
        contact_id: contactId,
        share_cents: Number(contactShares?.[contactId] || 0),
      });
    }

    if (expenseParticipantRows.length) {
      const participantResponse = await supabase.from("expense_participants").insert(expenseParticipantRows);
      if (participantResponse.error) {
        const tableMissing =
          String(participantResponse.error.code || "") === "PGRST205" ||
          String(participantResponse.error.code || "") === "42P01" ||
          /expense_participants/i.test(String(participantResponse.error.message || ""));

        if (!tableMissing) {
          console.error("Expense participant sync skipped:", participantResponse.error);
        }
      }
    }
  } catch (error) {
    console.error("Expense participant sync skipped:", error);
  }

  clearRuntimeCache();
  return expense;
}

export async function updateExpenseRecord(supabase, expenseId, {
  title,
  amountCents,
  paidBy,
  participants,
  splitType,
  splitMethod,
  shares,
  splitDetails,
}) {
  const base = {
    amount_cents: amountCents,
    paid_by: paidBy,
    participants,
    shares,
    split_type: splitType,
  };

  const baseVariants = [
    { ...base, split_method: splitMethod, split_details: splitDetails },
    { ...base, split_method: splitMethod },
    { ...base, split_details: splitDetails },
    base,
  ];

  const titleVariants = [
    { title },
    { name: title },
    { description: title },
    {},
  ];

  const payloads = [];
  for (const basePayload of baseVariants) {
    for (const titlePayload of titleVariants) {
      payloads.push({ ...basePayload, ...titlePayload });
    }
  }

  const response = await updateWithFallbacks(
    supabase,
    "expenses",
    { id: expenseId },
    payloads,
    { select: "*" },
  );

  clearRuntimeCache();
  return response.data;
}

export async function updateExpensePayerRecord(supabase, expenseId, paidBy) {
  const response = await updateWithFallbacks(
    supabase,
    "expenses",
    { id: expenseId },
    [{ paid_by: paidBy }],
    { select: "*" },
  );

  clearRuntimeCache();
  return response.data;
}

export async function deleteExpenseRecord(supabase, expenseId) {
  if (!supabase || !expenseId) {
    throw new Error("Missing expense id.");
  }

  const response = await supabase.from("expenses").delete().eq("id", expenseId);

  if (response.error) {
    throw response.error;
  }

  clearRuntimeCache();
  return true;
}

export async function leaveGroupRecord(supabase, groupId, userId) {
  if (!supabase || !groupId || !userId) {
    throw new Error("Missing group info.");
  }

  const [membershipResponse, membersResponse] = await Promise.all([
    supabase
      .from("group_members")
      .select("*")
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("group_members")
      .select("*")
      .eq("group_id", groupId)
      .order("created_at", { ascending: true }),
  ]);

  if (membershipResponse.error && membershipResponse.error.code !== "PGRST116") {
    throw membershipResponse.error;
  }
  if (membersResponse.error) {
    throw membersResponse.error;
  }

  const membership = membershipResponse.data || null;
  const members = membersResponse.data || [];

  if (!membership?.id) {
    throw new Error("You are not in this group anymore.");
  }

  const [paidExpensesResponse, participantExpensesResponse] = await Promise.all([
    supabase.from("expenses").select("id").eq("group_id", groupId).eq("paid_by", membership.id).limit(1),
    supabase.from("expenses").select("id").eq("group_id", groupId).contains("participants", [membership.id]).limit(1),
  ]);

  if (paidExpensesResponse.error) {
    throw paidExpensesResponse.error;
  }
  if (participantExpensesResponse.error) {
    throw participantExpensesResponse.error;
  }

  if ((paidExpensesResponse.data || []).length || (participantExpensesResponse.data || []).length) {
    throw new Error("Reassign or delete your past expenses before leaving this group.");
  }

  if (members.length <= 1) {
    await deleteGroupRecord(supabase, groupId);
    return { deletedGroup: true };
  }

  if (membership.role === "admin") {
    const nextAdmin = members.find((member) => member.id !== membership.id);
    if (nextAdmin?.id) {
      try {
        await supabase.from("group_members").update({ role: "admin" }).eq("id", nextAdmin.id);
      } catch (error) {
        console.error("Admin handoff skipped:", error);
      }
    }
  }

  const response = await supabase.from("group_members").delete().eq("id", membership.id);
  if (response.error) {
    throw response.error;
  }

  clearRuntimeCache();
  return { deletedGroup: false };
}

async function safeDeleteByMatch(supabase, table, matchers) {
  let query = supabase.from(table).delete();

  for (const [column, value] of Object.entries(matchers)) {
    query = query.eq(column, value);
  }

  const response = await query;

  if (response.error && !isMissingTableError(response.error, table)) {
    throw response.error;
  }
}

export async function deleteGroupRecord(supabase, groupId) {
  if (!supabase || !groupId) {
    throw new Error("Missing group id.");
  }

  await safeDeleteByMatch(supabase, "expense_participants", { group_id: groupId });
  await safeDeleteByMatch(supabase, "settlements", { group_id: groupId });
  await safeDeleteByMatch(supabase, "expenses", { group_id: groupId });
  await safeDeleteByMatch(supabase, "contexts", { group_id: groupId });
  await safeDeleteByMatch(supabase, "group_members", { group_id: groupId });

  const response = await supabase.from("groups").delete().eq("id", groupId);

  if (response.error) {
    throw response.error;
  }

  clearRuntimeCache();
  return true;
}

export async function createSettlementRecord(supabase, payload) {
  const {
    groupId,
    fromUserId,
    toUserId,
    amount,
    paymentMethod,
    notes = "",
  } = payload;

  const response = await insertWithFallbacks(
    supabase,
    "settlements",
    [
      {
        group_id: groupId,
        from_user_id: fromUserId,
        to_user_id: toUserId,
        amount,
        payment_method: paymentMethod,
        notes,
        settled_at: new Date().toISOString(),
      },
      {
        group_id: groupId,
        from_user_id: fromUserId,
        to_user_id: toUserId,
        amount,
        payment_method: paymentMethod,
        settled_at: new Date().toISOString(),
      },
    ],
    { select: "*" },
  );

  clearRuntimeCache();
  return response.data || null;
}

export async function loadUserTurnRotations(supabase, user) {
  if (!supabase || !user) return [];

  const membershipsResponse = await supabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", user.id);

  if (membershipsResponse.error) {
    throw membershipsResponse.error;
  }

  const groupIds = [...new Set((membershipsResponse.data || []).map((row) => row.group_id).filter(Boolean))];
  if (!groupIds.length) return [];

  const [groupsResponse, membersResponse, rotationsResponse] = await Promise.all([
    supabase.from("groups").select("id, name").in("id", groupIds),
    supabase.from("group_members").select("group_id, user_id, display_name").in("group_id", groupIds),
    supabase
      .from("rotations")
      .select("*")
      .in("group_id", groupIds)
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
  ]);

  if (groupsResponse.error) {
    throw groupsResponse.error;
  }
  if (membersResponse.error) {
    throw membersResponse.error;
  }
  if (rotationsResponse.error) {
    if (isMissingTableError(rotationsResponse.error, "rotations")) {
      return [];
    }
    throw rotationsResponse.error;
  }

  const groupNameById = new Map((groupsResponse.data || []).map((group) => [group.id, group.name]));
  const membersByGroup = new Map();
  (membersResponse.data || []).forEach((member) => {
    const bucket = membersByGroup.get(member.group_id) || [];
    bucket.push(member);
    membersByGroup.set(member.group_id, bucket);
  });

  return (rotationsResponse.data || [])
    .map((rotation) => {
      const groupMembers = membersByGroup.get(rotation.group_id) || [];
      const currentUserId = getRotationCurrentUserId(rotation);
      const currentMember = groupMembers.find((member) => member.user_id === currentUserId) || null;
      return {
        ...rotation,
        group_name: groupNameById.get(rotation.group_id) || "Group",
        current_turn_user_id: currentUserId,
        current_turn_name: currentMember?.display_name || "Someone",
        members: groupMembers,
      };
    })
    .filter((rotation) => rotation.current_turn_user_id === user.id);
}

export async function createRotationRecord(supabase, payload) {
  const {
    groupId,
    name,
    frequency,
    people,
    currentTurnIndex = 0,
  } = payload;

  const response = await insertWithFallbacks(
    supabase,
    "rotations",
    [
      {
        group_id: groupId,
        name,
        frequency,
        people,
        current_turn_index: currentTurnIndex,
        is_active: true,
      },
      {
        group_id: groupId,
        name,
        frequency,
        people,
        current_turn_index: currentTurnIndex,
      },
    ],
    { select: "*" },
  );

  clearRuntimeCache();
  return response.data || null;
}

export async function completeRotationRecord(supabase, rotation, payload = {}) {
  if (!supabase || !rotation?.id) {
    throw new Error("Missing rotation.");
  }

  const {
    completedBy,
    linkedExpenseId = null,
    note = "",
  } = payload;

  const nextRotation = advanceRotationTurn(rotation);
  const completedAt = new Date().toISOString();

  const updateResponse = await supabase
    .from("rotations")
    .update({
      current_turn_index: nextRotation.current_turn_index,
      last_completed_at: completedAt,
    })
    .eq("id", rotation.id)
    .select("*")
    .single();

  if (updateResponse.error) {
    throw updateResponse.error;
  }

  const historyResponse = await insertWithFallbacks(
    supabase,
    "rotation_history",
    [
      {
        rotation_id: rotation.id,
        completed_by: completedBy,
        completed_at: completedAt,
        linked_expense_id: linkedExpenseId,
        note: String(note || "").trim() || null,
      },
      {
        rotation_id: rotation.id,
        completed_by: completedBy,
        completed_at: completedAt,
        note: String(note || "").trim() || null,
      },
    ],
    { select: "*" },
  );

  clearRuntimeCache();
  return {
    rotation: updateResponse.data || nextRotation,
    history: historyResponse.data || null,
  };
}

export async function loadRecentGroupExpenses(supabase, groupId, limit = 6) {
  if (!supabase || !groupId) return [];

  const response = await supabase
    .from("expenses")
    .select("id, title, amount_cents, round_up_cents, created_at, split_details")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (response.error) {
    throw response.error;
  }

  return response.data || [];
}
