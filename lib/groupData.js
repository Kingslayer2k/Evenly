import { generateGroupCode, getDisplayNameFromUser, pickPreferredDisplayName } from "./utils";

export const DISPLAY_NAME_STORAGE_KEY = "evenly-display-name";

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

export function normalizeInviteCode(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

export async function loadProfileName(supabase, user) {
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

  return pickPreferredDisplayName(storedName, metadataName, data?.display_name, fallbackName);
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

export async function loadUserGroupsBundle(supabase, user) {
  const profileName = await loadProfileName(supabase, user);
  await syncProfileName(supabase, user, profileName);

  const membershipsResponse = await supabase
    .from("group_members")
    .select("*")
    .eq("user_id", user.id);

  if (membershipsResponse.error) throw membershipsResponse.error;

  const memberships = membershipsResponse.data || [];
  const groupIds = [...new Set(memberships.map((membership) => membership.group_id).filter(Boolean))];

  if (!groupIds.length) {
    return {
      profileName,
      memberships,
      groups: [],
      membersByGroup: {},
      expensesByGroup: {},
    };
  }

  const [groupsResponse, membersResponse, expensesResponse] = await Promise.all([
    supabase.from("groups").select("*").in("id", groupIds),
    supabase.from("group_members").select("*").in("group_id", groupIds),
    supabase.from("expenses").select("*").in("group_id", groupIds),
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

  const groups = [...(groupsResponse.data || [])].sort((left, right) => {
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

  return {
    profileName,
    memberships,
    groups,
    membersByGroup,
    expensesByGroup,
  };
}

export async function loadGroupDetailBundle(supabase, groupId, user) {
  const profileName = await loadProfileName(supabase, user);
  await syncProfileName(supabase, user, profileName);

  const [membershipResponse, groupResponse, membersResponse, expensesResponse, contextsResponse] =
    await Promise.all([
      supabase.from("group_members").select("*").eq("group_id", groupId).eq("user_id", user.id).maybeSingle(),
      supabase.from("groups").select("*").eq("id", groupId).maybeSingle(),
      supabase.from("group_members").select("*").eq("group_id", groupId),
      supabase.from("expenses").select("*").eq("group_id", groupId).order("created_at", { ascending: false }),
      supabase.from("contexts").select("*").eq("group_id", groupId),
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

  return {
    profileName,
    membership: membershipResponse.data || null,
    group: groupResponse.data || null,
    members: (membersResponse.data || []).map((member) =>
      member.user_id === user.id ? { ...member, display_name: profileName } : member,
    ),
    expenses: expensesResponse.data || [],
    contexts: contextsResponse.data || [],
  };
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

export async function createGroupWithMembership(supabase, user, profileName, name) {
  const code = await generateUniqueJoinCode(supabase);
  const displayName = getDisplayNameFromUser(user, profileName);

  const groupResponse = await insertWithFallbacks(
    supabase,
    "groups",
    [
      { name, join_code: code, created_by: user.id },
      { name, join_code: code, owner_id: user.id },
      { name, join_code: code },
    ],
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

  return {
    group,
    code,
  };
}

export async function updateGroupCardColor(supabase, groupId, color) {
  if (!supabase || !groupId || !color) return null;

  try {
    const response = await updateWithFallbacks(
      supabase,
      "groups",
      { id: groupId },
      [{ card_color: color }, { color }, {}],
      { select: "*", single: true },
    );

    return response.data || null;
  } catch (error) {
    console.error("Group color sync skipped:", error);
    return null;
  }
}

export async function updateGroupCardImage(supabase, groupId, imageData) {
  if (!supabase || !groupId || !imageData) return null;

  try {
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
    contextId,
    contextName,
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

  const titlePayloads = [
    { title },
    { name: title },
    { description: title },
    {},
  ];

  const payloads = [];
  for (const titlePayload of titlePayloads) {
    payloads.push({
      ...base,
      ...titlePayload,
      created_by: user.id,
      context_id: resolvedContextId,
    });
    payloads.push({
      ...base,
      ...titlePayload,
      context_id: resolvedContextId,
    });
  }

  const response = await insertWithFallbacks(supabase, "expenses", payloads, { select: "*" });
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

  return response.data;
}
