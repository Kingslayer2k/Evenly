"use client";

import { useState } from "react";
import { formatCurrency } from "../lib/utils";

export default function PayerSwitchModal({ isOpen, onClose, onSave, expense, members }) {
  const [paidBy, setPaidBy] = useState(expense?.paid_by || "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen || !expense) return null;

  async function handleSave() {
    if (!paidBy) {
      setError("Pick someone first.");
      return;
    }

    setIsSaving(true);
    setError("");

    const result = await onSave?.(expense, paidBy);
    if (!result?.ok) {
      setIsSaving(false);
      setError(result?.message || "Could not switch the payer.");
      return;
    }

    setIsSaving(false);
    onClose?.();
  }

  return (
    <div className="fixed inset-0 z-50 bg-[rgba(28,25,23,0.35)]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-x-0 bottom-0 rounded-t-[28px] bg-white px-6 pt-6 pb-8 shadow-[0_-10px_40px_rgba(28,25,23,0.14)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-[#E5E7EB]" />

        <h2 className="text-[24px] font-bold tracking-[-0.04em] text-[#1C1917]">Switch payer</h2>
        <p className="mt-2 text-[14px] leading-5 text-[#6B7280]">
          Move <span className="font-semibold text-[#1C1917]">{expense.title || expense.name || expense.description || "this expense"}</span> ({formatCurrency((Number(expense.amount_cents || 0) + Number(expense.round_up_cents || 0)) / 100)}) to someone else.
        </p>

        <div className="mt-5 space-y-3">
          {(members || []).map((member) => {
            const active = paidBy === member.id;
            return (
              <button
                key={member.id}
                type="button"
                onClick={() => setPaidBy(member.id)}
                className={`flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left transition ${
                  active ? "border-[#0070F3] bg-[#F4F8FF]" : "border-[#E5E7EB] bg-white hover:bg-[#FAFAF8]"
                }`}
              >
                <span className="text-[15px] font-medium text-[#1C1917]">{member.display_name}</span>
                <span
                  className={`h-5 w-5 rounded-full border ${
                    active ? "border-[#0070F3] bg-[#0070F3]" : "border-[#D1D5DB]"
                  }`}
                />
              </button>
            );
          })}
        </div>

        {error ? <p className="mt-4 text-[14px] font-medium text-[#DC2626]">{error}</p> : null}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[#E5E7EB] px-5 py-3 text-[15px] font-semibold text-[#6B7280] transition hover:bg-[#F7F7F5]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="rounded-full bg-[#0070F3] px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-[#0060D6] disabled:cursor-not-allowed disabled:bg-[#A3C5F7]"
          >
            {isSaving ? "Saving..." : "Update payer"}
          </button>
        </div>
      </div>
    </div>
  );
}
