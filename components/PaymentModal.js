"use client";

import { useMemo, useState } from "react";
import {
  buildAppleCashLink,
  buildCashAppLink,
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
        url: buildVenmoLink({
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
        url: buildZelleLink({
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
        url: buildCashAppLink({
          cashtag: handles.cashTag,
          amount,
          note,
        }),
      },
      {
        key: "apple_cash",
        label: "Apple Cash",
        emoji: "💬",
        url: buildAppleCashLink({
          phone: handles.phone,
          direction,
          counterpartyName,
          amount,
          groupName,
        }),
      },
      {
        key: "cash",
        label: "Cash / Other",
        emoji: "💸",
        url: "",
      },
    ],
    [amount, counterpartyName, direction, groupName, handles, note],
  );

  if (!isOpen || !settlementItem) return null;

  const chosenMethod = methods.find((method) => method.key === selectedMethod) || null;

  return (
    <div className="fixed inset-0 z-[65] bg-[rgba(28,25,23,0.38)]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-modal-title"
        className="fixed inset-x-0 bottom-0 rounded-t-[24px] bg-white px-6 pt-6 pb-8 shadow-[0_-16px_36px_rgba(28,25,23,0.16)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-[#E5E7EB]" />

        <h2 id="payment-modal-title" className="text-[24px] font-bold tracking-[-0.04em] text-[#1C1917]">
          {methodTitle(direction, counterpartyName)}
        </h2>
        <div className="mt-2 text-[32px] font-bold tracking-[-0.05em] text-[#5F7D6A]">
          {formatCurrency(amount)}
        </div>

        {!chosenMethod ? (
          <>
            <p className="mt-6 text-[13px] font-medium uppercase tracking-[0.1em] text-[#6B7280]">
              Choose payment method
            </p>

            <div className="mt-4 space-y-3">
              {methods.map((method) => (
                <button
                  key={method.key}
                  type="button"
                  onClick={() => {
                    setSelectedMethod(method.key);
                    if (method.url) {
                      openExternalPaymentLink(method.url);
                    }
                  }}
                  className="flex min-h-14 w-full items-center justify-between rounded-[12px] border border-[#E5E7EB] bg-[#F9FAFB] px-4 text-left transition hover:bg-[#F3F4F6] active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[22px]">{method.emoji}</span>
                    <span className="text-[16px] font-medium text-[#1C1917]">{method.label}</span>
                  </div>
                  <ChevronIcon />
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="mt-6 rounded-[20px] bg-[#F7F7F5] p-5">
            <div className="text-[18px] font-semibold text-[#1C1917]">
              Did you complete the payment?
            </div>
            <p className="mt-3 text-[14px] leading-6 text-[#6B7280]">
              {methodConfirmationCopy(direction, counterpartyName, amount, chosenMethod.label)}
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedMethod("")}
                className="min-h-11 rounded-[10px] border border-[#E5E7EB] bg-white px-4 text-[15px] font-medium text-[#6B7280] transition hover:bg-[#F3F4F6]"
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
                className="min-h-11 rounded-[10px] bg-[#5F7D6A] px-4 text-[15px] font-medium text-white transition hover:bg-[#3A4E43] disabled:cursor-not-allowed disabled:bg-[#A3B8A8]"
              >
                {isSubmitting ? "Saving..." : "Yes, settled"}
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-5 min-h-11 w-full rounded-[10px] bg-transparent text-[15px] font-medium text-[#6B7280] transition hover:bg-[#F7F7F5]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
