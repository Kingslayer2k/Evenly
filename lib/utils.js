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

export function getStandingCopy(balance) {
  if (balance > 0) return "you're fine.";
  if (balance < 0) return "you owe.";
  return "settled up.";
}

export function getDefaultColor(index = 0) {
  return PRESET_COLORS[index % PRESET_COLORS.length];
}

export function getDisplayNameFromUser(user, profileName) {
  if (profileName) return profileName;
  if (user?.user_metadata?.display_name) return user.user_metadata.display_name;
  if (user?.user_metadata?.name) return user.user_metadata.name;
  if (user?.email) return user.email.split("@")[0];
  return "You";
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
      toMemberId: creditor.memberId,
      toName: creditor.displayName,
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

export function getUserSettlementSummary(members, expenses, membership) {
  if (!membership) {
    return {
      balancesByMember: {},
      settlements: [],
      youOwe: [],
      owedToYou: [],
      netAmount: 0,
    };
  }

  const balancesByMember = computeBalancesForGroup(members, expenses);
  const settlements = buildSettlementsFromBalances(members, balancesByMember);
  const memberId = membership.id;

  return {
    balancesByMember,
    settlements,
    youOwe: settlements.filter((item) => item.fromMemberId === memberId),
    owedToYou: settlements.filter((item) => item.toMemberId === memberId),
    netAmount: Number(balancesByMember[memberId] || 0) / 100,
  };
}

export function getExpenseTitle(expense) {
  return expense?.title || expense?.name || expense?.description || "Shared expense";
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
