"use client";

import { useMemo, useState } from "react";
import DeleteExpenseDialog from "./DeleteExpenseDialog";
import { computeExpenseShares, formatCurrency, formatExpenseDate, getExpenseTitle } from "../lib/utils";

const AVATAR_COLORS = ["#8BA888", "#5F7D6A", "#D4A574", "#89CFF0"];

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m6 6 12 12" />
      <path d="M18 6 6 18" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="m19 6-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function getInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

function MemberChip({ member, amountLabel, index }) {
  return (
    <div className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[rgba(95,125,106,0.1)] px-3 py-1.5 text-[14px] font-medium text-[#1C1917]">
      <div
        className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold text-white"
        style={{ backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] }}
      >
        {getInitials(member.display_name)}
      </div>
      <span>{member.display_name}</span>
      {amountLabel ? <span className="text-[#6B7280]">{amountLabel}</span> : null}
    </div>
  );
}

export default function ExpenseDetail({
  isOpen,
  expense,
  members,
  canDelete = false,
  isDeleting = false,
  onClose,
  onDelete,
  onChangePayer,
}) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const payer = useMemo(
    () => (members || []).find((member) => member.id === expense?.paid_by) || null,
    [expense?.paid_by, members],
  );

  const participantMembers = useMemo(() => {
    const ids = Array.isArray(expense?.participants) ? expense.participants : [];
    const memberMap = new Map((members || []).map((member) => [member.id, member]));
    return ids.map((id) => memberMap.get(id)).filter(Boolean);
  }, [expense, members]);

  const shares = useMemo(() => computeExpenseShares(expense), [expense]);
  const totalAmount = useMemo(
    () => (Number(expense?.amount_cents || 0) + Number(expense?.round_up_cents || 0)) / 100,
    [expense],
  );
  const isEqualSplit = expense?.split_type !== "custom";
  const equalAmount = participantMembers.length ? totalAmount / participantMembers.length : 0;

  if (!isOpen || !expense) return null;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-[rgba(28,25,23,0.38)]" onClick={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="expense-detail-title"
          className="fixed inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-[28px] bg-white px-6 pt-6 pb-8 shadow-[0_-18px_44px_rgba(28,25,23,0.14)]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-[#E5E7EB]" />

          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 id="expense-detail-title" className="truncate text-[28px] font-bold tracking-[-0.04em] text-[#1C1917]">
                {getExpenseTitle(expense)}
              </h2>
              <p className="mt-2 text-[14px] text-[#6B7280]">{formatExpenseDate(expense.created_at)}</p>
            </div>

            <div className="shrink-0 text-right">
              <div className="text-[28px] font-bold tracking-[-0.04em] text-[#1C1917]">
                {formatCurrency(totalAmount)}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 ml-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#F3F4F6] text-[#1C1917] transition hover:bg-[#E5E7EB]"
                aria-label="Close expense details"
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          <div className="mt-7 rounded-[24px] bg-[#F7F7F5] p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6B7280]">Paid by</div>
            <div className="mt-3 inline-flex items-center gap-3 rounded-full bg-white px-4 py-3 text-[15px] font-medium text-[#1C1917] shadow-[0_4px_12px_rgba(28,25,23,0.04)]">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold text-white"
                style={{ backgroundColor: AVATAR_COLORS[1] }}
              >
                {getInitials(payer?.display_name || "Someone")}
              </div>
              <span>{payer?.display_name || "Someone"}</span>
            </div>

            <div className="mt-6 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6B7280]">
              Split with
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {participantMembers.map((member, index) => (
                <MemberChip
                  key={member.id}
                  member={member}
                  amountLabel={expense?.split_type === "custom" ? formatCurrency(Number(shares[member.id] || 0) / 100) : ""}
                  index={index}
                />
              ))}
            </div>

            <p className="mt-4 text-[16px] font-semibold text-[#6B7280]">
              {isEqualSplit ? `${formatCurrency(equalAmount)} each` : "Custom split"}
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => onChangePayer?.(expense)}
              className="min-h-11 rounded-[10px] border border-[#E5E7EB] bg-white px-4 text-[15px] font-medium text-[#1C1917] transition hover:bg-[#F7F7F5] active:scale-[0.99]"
            >
              Change who paid
            </button>

            {canDelete ? (
              <button
                type="button"
                onClick={() => setShowDeleteDialog(true)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border border-[#DC2626] bg-transparent px-4 text-[15px] font-medium text-[#DC2626] transition hover:bg-[rgba(220,38,38,0.05)] active:bg-[rgba(220,38,38,0.1)]"
              >
                <TrashIcon />
                Delete expense
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <DeleteExpenseDialog
        isOpen={showDeleteDialog}
        expenseTitle={getExpenseTitle(expense)}
        expenseAmount={formatCurrency(totalAmount)}
        isDeleting={isDeleting}
        onCancel={() => setShowDeleteDialog(false)}
        onConfirm={async () => {
          const result = await onDelete?.(expense);
          if (result?.ok) {
            setShowDeleteDialog(false);
          }
        }}
      />
    </>
  );
}
