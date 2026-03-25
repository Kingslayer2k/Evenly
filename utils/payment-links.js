"use client";

function formatAmount(amount) {
  return Number(amount || 0).toFixed(2);
}

function buildMessageBody({ direction, counterpartyName, amount, groupName, methodLabel }) {
  if (direction === "request") {
    return `Hey ${counterpartyName}, can you send $${formatAmount(amount)} for ${groupName} on Evenly? ${methodLabel ? `I opened ${methodLabel} to make it easy.` : ""}`.trim();
  }

  return `Hey ${counterpartyName}, I just sent $${formatAmount(amount)} for ${groupName} on Evenly.`;
}

export function buildVenmoLink({ username, amount, note, direction = "pay" }) {
  const txn = direction === "request" ? "charge" : "pay";
  if (!username) {
    return { primaryUrl: "https://venmo.com/", fallbackUrl: "" };
  }
  // Use HTTPS universal link — iOS opens the Venmo app if installed, browser otherwise
  return {
    primaryUrl: `https://venmo.com/?txn=${txn}&recipients=${encodeURIComponent(username)}&amount=${encodeURIComponent(formatAmount(amount))}&note=${encodeURIComponent(note)}`,
    fallbackUrl: "",
  };
}

export function buildCashAppLink({ cashtag }) {
  if (!cashtag) {
    return { primaryUrl: "https://cash.app/", fallbackUrl: "" };
  }
  // Use HTTPS universal link — iOS opens Cash App if installed, browser otherwise
  const tag = cashtag.startsWith("$") ? cashtag.slice(1) : cashtag;
  return {
    primaryUrl: `https://cash.app/$${encodeURIComponent(tag)}`,
    fallbackUrl: "",
  };
}

export function buildAppleCashLink({ phone, direction, counterpartyName, amount, groupName }) {
  const message = buildMessageBody({
    direction,
    counterpartyName,
    amount,
    groupName,
    methodLabel: "Apple Cash",
  });
  const recipient = phone ? `${phone}` : "";
  return {
    primaryUrl: `sms:${recipient}?&body=${encodeURIComponent(message)}`,
    fallbackUrl: "",
  };
}

export function buildZelleLink({ phone, counterpartyName, amount, groupName, direction }) {
  const message = buildMessageBody({
    direction,
    counterpartyName,
    amount,
    groupName,
    methodLabel: "Zelle",
  });
  const recipient = phone ? `${phone}` : "";
  return {
    primaryUrl: `sms:${recipient}?&body=${encodeURIComponent(message)}`,
    fallbackUrl: "https://www.zellepay.com/",
  };
}

export function openExternalPaymentLink(action) {
  if (typeof window === "undefined" || !action?.primaryUrl) return;
  window.open(action.primaryUrl, "_blank", "noopener,noreferrer");
}
