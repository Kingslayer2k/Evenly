"use client";

import { useMemo, useState } from "react";
import DeleteExpenseDialog from "./DeleteExpenseDialog";
import {
  computeExpenseShares,
  formatCurrency,
  formatExpenseDate,
  getExpenseEmoji,
  getExpenseTitle,
} from "../lib/utils";

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

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" />
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
    <div className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[var(--surface-accent)] px-3 py-1.5 text-[14px] font-medium text-[var(--text)]">
      <div
        className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold text-white"
        style={{ backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] }}
      >
        {getInitials(member.display_name)}
      </div>
      <span>{member.display_name}</span>
      {amountLabel ? <span className="text-[var(--text-muted)]">{amountLabel}</span> : null}
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
  onEdit,
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
  const fairBreakdown = useMemo(() => expense?.split_details?.fair || null, [expense]);
  const totalAmount = useMemo(
    () => (Number(expense?.amount_cents || 0) + Number(expense?.round_up_cents || 0)) / 100,
    [expense],
  );
  const isEqualSplit = expense?.split_type !== "custom";
  const equalAmount = participantMembers.length ? totalAmount / participantMembers.length : 0;

  if (!isOpen || !expense) return null;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-[var(--overlay)]" onClick={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="expense-detail-title"
          className="fixed inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-[28px] border border-[var(--border)] bg-[var(--surface)] px-6 pt-6 pb-8 shadow-[0_-18px_44px_rgba(28,25,23,0.14)]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-[var(--border)]" />

          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex items-start gap-3">
              <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[var(--surface-accent)] text-[22px]">
                {getExpenseEmoji(expense)}
              </div>
              <div className="min-w-0">
                <h2 id="expense-detail-title" className="truncate text-[28px] font-bold tracking-[-0.04em] text-[var(--text)]">
                  {getExpenseTitle(expense)}
                </h2>
                <p className="mt-2 text-[14px] text-[var(--text-muted)]">{formatExpenseDate(expense.created_at)}</p>
              </div>
            </div>

            <div className="shrink-0 text-right">
              <div className="text-[28px] font-bold tracking-[-0.04em] text-[var(--text)]">
                {formatCurrency(totalAmount)}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 ml-auto flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--text)] transition hover:opacity-90"
                aria-label="Close expense details"
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          <div className="mt-7 rounded-[24px] bg-[var(--surface-muted)] p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">Paid by</div>
            <div className="mt-3 inline-flex items-center gap-3 rounded-full bg-[var(--surface)] px-4 py-3 text-[15px] font-medium text-[var(--text)] shadow-[0_4px_12px_rgba(28,25,23,0.04)]">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold text-white"
                style={{ backgroundColor: AVATAR_COLORS[1] }}
              >
                {getInitials(payer?.display_name || "Someone")}
              </div>
              <span>{payer?.display_name || "Someone"}</span>
            </div>

            <div className="mt-6 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
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

            <p className="mt-4 text-[16px] font-semibold text-[var(--text-muted)]">
              {expense?.split_method === "fair"
                ? "Fair split by items"
                : isEqualSplit
                  ? `${formatCurrency(equalAmount)} each`
                  : "Custom split"}
            </p>

            {fairBreakdown?.calculations?.length ? (
              <div className="mt-5 rounded-[18px] bg-[var(--surface)] px-4 py-4 shadow-[0_4px_12px_rgba(28,25,23,0.04)]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                  Fair breakdown
                </div>
                <div className="mt-3 space-y-3">
                  {fairBreakdown.calculations.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between gap-4 text-[14px]">
                      <div>
                        <div className="font-semibold text-[var(--text)]">{entry.label}</div>
                        <div className="mt-1 text-[var(--text-muted)]">
                          Items {formatCurrency(Number(entry.itemsCents || 0) / 100)} + shared {formatCurrency(Number(entry.sharedShareCents || 0) / 100)}
                        </div>
                      </div>
                      <div className="font-semibold text-[var(--text)]">
                        {formatCurrency(Number(entry.totalCents || 0) / 100)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            {onEdit ? (
              <button
                type="button"
                onClick={() => onEdit?.(expense)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-4 text-[15px] font-medium text-[var(--text)] transition hover:bg-[var(--surface-muted)] active:scale-[0.99]"
              >
                <EditIcon />
                Edit
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onChangePayer?.(expense)}
              className={`min-h-11 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-4 text-[15px] font-medium text-[var(--text)] transition hover:bg-[var(--surface-muted)] active:scale-[0.99] ${onEdit ? "" : "col-span-2"}`}
            >
              Change who paid
            </button>

            {canDelete ? (
              <button
                type="button"
                onClick={() => setShowDeleteDialog(true)}
                className="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border border-[var(--danger)] bg-transparent px-4 text-[15px] font-medium text-[var(--danger)] transition hover:bg-[color:rgba(220,38,38,0.08)] active:bg-[color:rgba(220,38,38,0.14)]"
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
