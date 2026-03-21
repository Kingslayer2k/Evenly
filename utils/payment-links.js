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
    return {
      primaryUrl: "venmo://",
      fallbackUrl: "https://venmo.com/",
    };
  }

  const txn = direction === "request" ? "charge" : "pay";
  return {
    primaryUrl: `venmo://paycharge?txn=${txn}&recipients=${encodeURIComponent(username)}&amount=${encodeURIComponent(formatAmount(amount))}&note=${encodeURIComponent(note)}`,
    fallbackUrl: `https://venmo.com/${encodeURIComponent(username)}?txn=${txn}&amount=${encodeURIComponent(formatAmount(amount))}&note=${encodeURIComponent(note)}`,
  };
}

export function buildCashAppLink({ cashtag, amount, note }) {
  if (!cashtag) {
    return {
      primaryUrl: "cashapp://",
      fallbackUrl: "https://cash.app/",
    };
  }

  return {
    primaryUrl: `cashapp://pay?cash_tag=${encodeURIComponent(cashtag)}&amount=${encodeURIComponent(formatAmount(amount))}&note=${encodeURIComponent(note)}`,
    fallbackUrl: `https://cash.app/$${encodeURIComponent(cashtag)}/${encodeURIComponent(formatAmount(amount))}`,
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

  const { primaryUrl, fallbackUrl } = action;
  const fallbackTimer = window.setTimeout(() => {
    if (!fallbackUrl || document.visibilityState === "hidden") return;
    window.open(fallbackUrl, "_blank", "noopener,noreferrer");
  }, 1400);

  const clearFallback = () => {
    window.clearTimeout(fallbackTimer);
    document.removeEventListener("visibilitychange", clearFallback);
    window.removeEventListener("pagehide", clearFallback);
  };

  document.addEventListener("visibilitychange", clearFallback);
  window.addEventListener("pagehide", clearFallback);
  window.location.href = primaryUrl;
}
