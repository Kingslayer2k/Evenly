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
  if (!username) {
    return "venmo://";
  }

  const txn = direction === "request" ? "charge" : "pay";
  return `venmo://paycharge?txn=${txn}&recipients=${encodeURIComponent(username)}&amount=${encodeURIComponent(formatAmount(amount))}&note=${encodeURIComponent(note)}`;
}

export function buildCashAppLink({ cashtag, amount, note }) {
  if (!cashtag) {
    return "cashapp://";
  }

  return `cashapp://pay?cash_tag=${encodeURIComponent(cashtag)}&amount=${encodeURIComponent(formatAmount(amount))}&note=${encodeURIComponent(note)}`;
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
  return `sms:${recipient}${recipient ? "" : ""}?&body=${encodeURIComponent(message)}`;
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
  return `sms:${recipient}${recipient ? "" : ""}?&body=${encodeURIComponent(message)}`;
}

export function openExternalPaymentLink(url) {
  if (typeof window === "undefined" || !url) return;
  window.location.href = url;
}
