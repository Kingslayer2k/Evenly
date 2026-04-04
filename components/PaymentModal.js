"use client";

import { useMemo, useState } from "react";
import {
  buildAppleCashLink,
  buildCashAppLink,
  buildPayPalLink,
  buildVenmoLink,
  buildZelleLink,
  openExternalPaymentLink,
} from "../utils/payment-links";
import { formatCurrency } from "../lib/utils";

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function methodTitle(direction, name) {
  return direction === "pay" ? `Pay ${name}` : `Request from ${name}`;
}

function methodConfirmationCopy(direction, name, amount, methodLabel) {
  if (direction === "pay") {
    return `If you paid ${name} ${formatCurrency(amount)} via ${methodLabel}, mark this as settled.`;
  }

  return `If ${name} paid you ${formatCurrency(amount)} via ${methodLabel}, mark this as settled.`;
}

function extractPaymentHandles(member) {
  return {
    venmoUsername:
      member?.venmo_username ||
      member?.venmo ||
      member?.venmo_handle ||
      member?.payment_venmo ||
      "",
    cashTag:
      member?.cash_app_tag ||
      member?.cash_tag ||
      member?.cashtag ||
      member?.payment_cash_app ||
      "",
    phone:
      member?.phone ||
      member?.phone_number ||
      member?.mobile ||
      member?.zelle_phone ||
      "",
  };
}

export default function PaymentModal({
  isOpen,
  direction,
  settlementItem,
  counterparty,
  groupName,
  isSubmitting = false,
  onClose,
  onConfirmSettlement,
}) {
  const [selectedMethod, setSelectedMethod] = useState("");

  const handles = useMemo(() => extractPaymentHandles(counterparty), [counterparty]);
  const counterpartyName = counterparty?.display_name || settlementItem?.toName || settlementItem?.fromName || "them";
  const amount = Number(settlementItem?.amount || 0);
  const note = `Evenly - ${groupName}`;

  const methods = useMemo(
    () => [
      {
        key: "venmo",
        label: "Venmo",
        emoji: "💚",
        action: buildVenmoLink({
          username: handles.venmoUsername,
          amount,
          note,
          direction,
        }),
      },
      {
        key: "zelle",
        label: "Zelle",
        emoji: "🔵",
        action: buildZelleLink({
          phone: handles.phone,
          counterpartyName,
          amount,
          groupName,
          direction,
        }),
      },
      {
        key: "cash_app",
        label: "Cash App",
        emoji: "💵",
        action: buildCashAppLink({
          cashtag: handles.cashTag,
          amount,
          note,
        }),
      },
      {
        key: "apple_cash",
        label: "Apple Cash",
        emoji: "💬",
        action: buildAppleCashLink({
          phone: handles.phone,
          direction,
          counterpartyName,
          amount,
          groupName,
        }),
      },
      {
        key: "paypal",
        label: "PayPal",
        emoji: "🅿️",
        action: buildPayPalLink(),
      },
      {
        key: "cash",
        label: "Cash / Other",
        emoji: "💸",
        action: null,
      },
    ],
    [amount, counterpartyName, direction, groupName, handles, note],
  );

  if (!isOpen || !settlementItem) return null;

  const chosenMethod = methods.find((method) => method.key === selectedMethod) || null;

  return (
    <div className="fixed inset-0 z-[65] bg-[var(--overlay)]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-modal-title"
        className="fixed inset-x-0 bottom-0 rounded-t-[24px] border border-[var(--border)] bg-[var(--surface)] px-6 pt-6 pb-8 shadow-[0_-16px_36px_rgba(28,25,23,0.16)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-[var(--border)]" />

        <h2 id="payment-modal-title" className="text-[24px] font-bold tracking-[-0.04em] text-[var(--text)]">
          {methodTitle(direction, counterpartyName)}
        </h2>
        <div className="mt-2 text-[32px] font-bold tracking-[-0.05em] text-[var(--accent)]">
          {formatCurrency(amount)}
        </div>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">
          Open the app and send {counterpartyName} this amount
        </p>

        {!chosenMethod ? (
          <>
            <p className="mt-6 text-[13px] font-medium uppercase tracking-[0.1em] text-[var(--text-muted)]">
              Choose payment method
            </p>

            <div className="mt-4 space-y-3">
              {methods.map((method) => (
                <button
                  key={method.key}
                  type="button"
                  onClick={() => {
                    setSelectedMethod(method.key);
                    if (method.action) {
                      openExternalPaymentLink(method.action);
                    }
                  }}
                  className={`flex min-h-14 w-full items-center justify-between rounded-[12px] border px-4 text-left transition hover:opacity-90 active:scale-[0.99] ${
                    method.key === "venmo"
                      ? "border-[#2a3a55] bg-[#1a2235]"
                      : method.key === "cash_app"
                        ? "border-[#2a4030] bg-[#162218]"
                        : method.key === "paypal"
                          ? "border-[#222a44] bg-[#141828]"
                          : "border-[var(--border)] bg-[var(--surface-muted)]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[22px]">{method.emoji}</span>
                    <span className={`text-[16px] font-medium ${
                      method.key === "venmo" ? "text-[#9ab0cc]"
                      : method.key === "cash_app" ? "text-[#7a9e84]"
                      : method.key === "paypal" ? "text-[#8a9ab8]"
                      : "text-[var(--text)]"
                    }`}>{method.label}</span>
                  </div>
                  <ChevronIcon />
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="mt-6 rounded-[20px] bg-[var(--surface-muted)] p-5">
            <div className="text-[18px] font-semibold text-[var(--text)]">
              Did you complete the payment?
            </div>
            <p className="mt-3 text-[14px] leading-6 text-[var(--text-muted)]">
              {methodConfirmationCopy(direction, counterpartyName, amount, chosenMethod.label)}
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedMethod("")}
                className="min-h-11 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-4 text-[15px] font-medium text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)]"
              >
                Not yet
              </button>
              <button
                type="button"
                onClick={() =>
                  onConfirmSettlement?.({
                    settlementItem,
                    method: chosenMethod.key,
                    direction,
                    counterparty,
                  })
                }
                disabled={isSubmitting}
                className="min-h-11 rounded-[10px] bg-[var(--accent)] px-4 text-[15px] font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Saving..." : "Yes, settled"}
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-5 min-h-11 w-full rounded-[10px] bg-transparent text-[15px] font-medium text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
