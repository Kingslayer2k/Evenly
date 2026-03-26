export function generateGroupCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error("Failed to copy:", err);
    return false;
  }
}

export function formatBalance(amount) {
  const prefix = amount >= 0 ? "+" : "-";
  return `${prefix}$${Math.abs(amount).toFixed(2)}`;
}

export const PRESET_COLORS = [
  "#FA8072",
  "#89CFF0",
  "#FFEF00",
  "#98FF98",
  "#E6E6FA",
  "#FFE5B4",
  "#FF7F50",
  "#87CEEB",
];

const LEADING_EXPENSE_EMOJI_RE = /^(\p{Extended_Pictographic}(?:\uFE0F)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F)?)*)\s*/u;

export function formatCurrency(amount) {
  return `$${Number(amount || 0).toFixed(2)}`;
}

export function formatSignedCurrency(amount) {
  const value = Number(amount || 0);
  const prefix = value >= 0 ? "+" : "-";
  return `${prefix}${formatCurrency(Math.abs(value))}`;
}

export function formatCurrencyCompact(amount) {
  const value = Number(amount || 0);
  if (Number.isInteger(value)) return `$${value.toLocaleString()}`;
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function sanitizeDisplayName(value) {
  return String(value || "").trim();
}

export function pickPreferredDisplayName(...candidates) {
  const cleaned = candidates
    .map((candidate) => sanitizeDisplayName(candidate))
    .filter(Boolean);

  if (!cleaned.length) {
    return "";
  }

  const scored = cleaned.map((value) => {
    let score = value.length;

    if (/\s/.test(value)) score += 20;
    if (/[A-Z]/.test(value)) score += 3;
    if (/^[a-z0-9._-]+$/.test(value)) score -= 6;

    return { value, score };
  });

  scored.sort((left, right) => right.score - left.score);
  return scored[0]?.value || cleaned[0];
}

export function getStandingCopy(balance) {
  if (balance > 0) return "you're fine.";
  if (balance < 0) return "you owe.";
  return "settled up.";
}

export function getDefaultColor(index = 0) {
  return PRESET_COLORS[index % PRESET_COLORS.length];
}

export function getStableCardColor(seed, fallbackIndex = 0) {
  const text = String(seed || "");
  if (!text) return getDefaultColor(fallbackIndex);

  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }

  return PRESET_COLORS[hash % PRESET_COLORS.length] || getDefaultColor(fallbackIndex);
}

export function getDisplayNameFromUser(user, profileName) {
  return (
    pickPreferredDisplayName(
      profileName,
      user?.user_metadata?.display_name,
      user?.user_metadata?.name,
      user?.email ? user.email.split("@")[0] : "",
    ) || "You"
  );
}

export function getMemberPreview(members) {
  const names = (members || []).map((member) => member.display_name).filter(Boolean);
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 3).join(", ")} +${names.length - 3} others`;
}

export function computeExpenseShares(expense) {
  const participants = Array.isArray(expense?.participants) ? expense.participants : [];
  if (!participants.length) return {};

  if (expense?.split_type === "custom" && expense?.shares) {
    const customShares = {};
    for (const participantId of participants) {
      customShares[participantId] = Math.max(0, Number(expense.shares[participantId] || 0));
    }
    return customShares;
  }

  const total = Number(expense?.amount_cents || 0) + Number(expense?.round_up_cents || 0);
  const perPerson = Math.floor(total / participants.length);
  let remainder = total - perPerson * participants.length;
  const equalShares = {};
  for (const participantId of participants) {
    equalShares[participantId] = perPerson + (remainder > 0 ? 1 : 0);
    remainder = Math.max(0, remainder - 1);
  }
  return equalShares;
}

export function allocateCentsByWeights(entries, totalCents) {
  const safeEntries = (entries || []).filter((entry) => Number(entry?.weight || 0) > 0);
  if (!safeEntries.length || totalCents <= 0) {
    return {};
  }

  const totalWeight = safeEntries.reduce((sum, entry) => sum + Number(entry.weight || 0), 0);
  const allocations = {};
  let allocated = 0;

  safeEntries.forEach((entry) => {
    const exactShare = (Number(entry.weight || 0) / totalWeight) * totalCents;
    const floorShare = Math.floor(exactShare);
    allocations[entry.id] = {
      cents: floorShare,
      remainder: exactShare - floorShare,
    };
    allocated += floorShare;
  });

  let remaining = totalCents - allocated;
  const byRemainder = [...safeEntries].sort((left, right) => {
    return (allocations[right.id]?.remainder || 0) - (allocations[left.id]?.remainder || 0);
  });

  for (const entry of byRemainder) {
    if (remaining <= 0) break;
    allocations[entry.id].cents += 1;
    remaining -= 1;
  }

  return Object.fromEntries(
    Object.entries(allocations).map(([id, value]) => [id, Number(value.cents || 0)]),
  );
}

export function calculateFairSplit(splitEntries, sharedCosts, totalCents) {
  const entries = (splitEntries || []).map((entry) => ({
    ...entry,
    itemsCents: Math.max(0, Number(entry?.itemsCents || 0)),
  }));
  const shared = (sharedCosts || []).map((cost) => ({
    ...cost,
    amountCents: Math.max(0, Number(cost?.amountCents || 0)),
  }));

  const itemTotalCents = entries.reduce((sum, entry) => sum + entry.itemsCents, 0);
  const sharedTotalCents = shared.reduce((sum, cost) => sum + cost.amountCents, 0);
  const combinedTotalCents = itemTotalCents + sharedTotalCents;
  const differenceCents = totalCents - combinedTotalCents;
  const weightedShared = allocateCentsByWeights(
    entries.map((entry) => ({ id: entry.id, weight: entry.itemsCents })),
    sharedTotalCents,
  );

  const calculations = entries.map((entry) => {
    const sharedShareCents = Number(weightedShared[entry.id] || 0);
    return {
      id: entry.id,
      label: entry.label,
      kind: entry.kind || "member",
      itemsCents: entry.itemsCents,
      sharedShareCents,
      totalCents: entry.itemsCents + sharedShareCents,
    };
  });

  return {
    itemTotalCents,
    sharedTotalCents,
    combinedTotalCents,
    differenceCents,
    isValid: combinedTotalCents > 0,
    calculations,
    participantShares: Object.fromEntries(
      calculations.map((entry) => [entry.id, Number(entry.totalCents || 0)]),
    ),
  };
}

export function computeBalancesForGroup(members, expenses) {
  const balances = {};
  for (const member of members || []) {
    balances[member.id] = 0;
  }

  for (const expense of expenses || []) {
    const total = Number(expense?.amount_cents || 0) + Number(expense?.round_up_cents || 0);
    balances[expense.paid_by] = (balances[expense.paid_by] || 0) + total;
    const shares = computeExpenseShares(expense);
    for (const [memberId, cents] of Object.entries(shares)) {
      balances[memberId] = (balances[memberId] || 0) - Number(cents || 0);
    }
  }

  return balances;
}

function settlementAmountToCents(settlement) {
  if (settlement?.amount_cents != null) {
    return Number(settlement.amount_cents || 0);
  }

  return Math.round(Number(settlement?.amount || 0) * 100);
}

export function applyRecordedSettlementsToBalances(members, balancesByMember, recordedSettlements) {
  const nextBalances = { ...(balancesByMember || {}) };
  const membersByUserId = new Map((members || []).map((member) => [member.user_id, member]));

  for (const settlement of recordedSettlements || []) {
    const fromMember = membersByUserId.get(settlement.from_user_id);
    const toMember = membersByUserId.get(settlement.to_user_id);
    const cents = settlementAmountToCents(settlement);

    if (!fromMember?.id || !toMember?.id || !cents) continue;

    nextBalances[fromMember.id] = Number(nextBalances[fromMember.id] || 0) + cents;
    nextBalances[toMember.id] = Number(nextBalances[toMember.id] || 0) - cents;
  }

  return nextBalances;
}

export function sumGroupTotal(expenses) {
  return (expenses || []).reduce(
    (sum, expense) => sum + Number(expense?.amount_cents || 0) / 100 + Number(expense?.round_up_cents || 0) / 100,
    0,
  );
}

export function needsAttention(balance) {
  return Number(balance || 0) < 0;
}

export function buildSettlementsFromBalances(members, balancesByMember) {
  const creditors = [];
  const debtors = [];

  for (const member of members || []) {
    const balance = Number(balancesByMember?.[member.id] || 0);
    if (balance > 0) {
      creditors.push({
        memberId: member.id,
        displayName: member.display_name || "Someone",
        cents: balance,
      });
    } else if (balance < 0) {
      debtors.push({
        memberId: member.id,
        displayName: member.display_name || "Someone",
        cents: Math.abs(balance),
      });
    }
  }

  const settlements = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const transfer = Math.min(debtor.cents, creditor.cents);

    settlements.push({
      fromMemberId: debtor.memberId,
      fromName: debtor.displayName,
      fromUserId: members.find((member) => member.id === debtor.memberId)?.user_id || null,
      toMemberId: creditor.memberId,
      toName: creditor.displayName,
      toUserId: members.find((member) => member.id === creditor.memberId)?.user_id || null,
      cents: transfer,
      amount: transfer / 100,
    });

    debtor.cents -= transfer;
    creditor.cents -= transfer;

    if (debtor.cents <= 0) debtorIndex += 1;
    if (creditor.cents <= 0) creditorIndex += 1;
  }

  return settlements;
}

export function getUserSettlementSummary(members, expenses, membership, recordedSettlements = []) {
  if (!membership) {
    return {
      balancesByMember: {},
      recordedSettlements: [],
      settlements: [],
      youOwe: [],
      owedToYou: [],
      netAmount: 0,
    };
  }

  const balancesByMember = applyRecordedSettlementsToBalances(
    members,
    computeBalancesForGroup(members, expenses),
    recordedSettlements,
  );
  const settlements = buildSettlementsFromBalances(members, balancesByMember);
  const memberId = membership.id;

  return {
    balancesByMember,
    recordedSettlements,
    settlements,
    youOwe: settlements.filter((item) => item.fromMemberId === memberId),
    owedToYou: settlements.filter((item) => item.toMemberId === memberId),
    netAmount: Number(balancesByMember[memberId] || 0) / 100,
  };
}

export function stripExpenseEmojiPrefix(value) {
  return String(value || "").replace(LEADING_EXPENSE_EMOJI_RE, "").trim();
}

export function getExpenseEmoji(expense) {
  if (expense?.emoji) return expense.emoji;
  const raw = expense?.title || expense?.name || expense?.description || "";
  const match = String(raw).match(LEADING_EXPENSE_EMOJI_RE);
  return match?.[1] || "💸";
}

export function getExpenseTitle(expense) {
  const raw = expense?.title || expense?.name || expense?.description || "Shared expense";
  return stripExpenseEmojiPrefix(raw) || "Shared expense";
}

export function formatExpenseDate(value) {
  if (!value) return "Just now";

  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "Just now";
  }
}

export function formatRelativeTimeShort(value) {
  if (!value) return "Just now";

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "Just now";

  const diffMs = Date.now() - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < hour) {
    return `${Math.max(1, Math.floor(diffMs / minute))}m ago`;
  }

  if (diffMs < day) {
    return `${Math.floor(diffMs / hour)}h ago`;
  }

  if (diffMs < day * 7) {
    return `${Math.floor(diffMs / day)}d ago`;
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(new Date(value));
  } catch {
    return "Recently";
  }
}

export function getRotationCurrentUserId(rotation) {
  const people = Array.isArray(rotation?.people) ? rotation.people : [];
  if (!people.length) return null;
  const safeIndex = Math.max(0, Number(rotation?.current_turn_index || 0)) % people.length;
  return people[safeIndex] || null;
}

export function advanceRotationTurn(rotation) {
  const people = Array.isArray(rotation?.people) ? rotation.people : [];
  if (!people.length) {
    return {
      ...rotation,
      current_turn_index: 0,
      last_completed_at: new Date().toISOString(),
    };
  }

  return {
    ...rotation,
    current_turn_index: (Number(rotation?.current_turn_index || 0) + 1) % people.length,
    last_completed_at: new Date().toISOString(),
  };
}
