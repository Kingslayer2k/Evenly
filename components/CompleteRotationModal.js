"use client";

import { useMemo, useState } from "react";

function formatCurrency(amount) {
  return `$${Number(amount || 0).toFixed(2)}`;
}

export default function CompleteRotationModal({
  isOpen,
  rotation,
  recentExpenses = [],
  onClose,
  onConfirm,
  isSubmitting = false,
}) {
  const [linkedExpenseId, setLinkedExpenseId] = useState("");
  const [note, setNote] = useState("");

  const suggestedExpense = useMemo(() => {
    const normalizedRotation = String(rotation?.name || "").trim().toLowerCase();
    return recentExpenses.find((expense) =>
      String(expense?.title || "").trim().toLowerCase().includes(normalizedRotation),
    ) || recentExpenses[0] || null;
  }, [recentExpenses, rotation?.name]);

  if (!isOpen || !rotation) return null;

  return (
    <div className="fixed inset-0 z-[85] bg-[var(--overlay)]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-[28px] border border-[var(--border)] bg-[var(--surface)] px-5 pt-5 pb-[calc(var(--safe-bottom)+24px)] shadow-[0_-18px_44px_rgba(28,25,23,0.14)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-[var(--border)]" />

        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-[24px] font-bold tracking-[-0.04em] text-[var(--text)]">Mark complete</h3>
            <p className="mt-2 text-[14px] leading-5 text-[var(--text-muted)]">
              Wrap up {rotation.name} and hand the baton to the next person.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--text)]"
            aria-label="Close mark complete modal"
          >
            ×
          </button>
        </div>

        <div className="mt-5 rounded-[22px] bg-[var(--surface-accent)] px-4 py-4">
          <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--accent-strong)]">
            Next move
          </div>
          <div className="mt-2 text-[22px] font-bold tracking-[-0.04em] text-[var(--accent-strong)]">
            Advance the turn
          </div>
        </div>

        <div className="mt-5">
          <div className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
            Link an expense (optional)
          </div>
          <div className="mt-3 space-y-3">
            {[suggestedExpense, ...recentExpenses.filter((expense) => expense.id !== suggestedExpense?.id)]
              .filter(Boolean)
              .slice(0, 4)
              .map((expense) => (
                <button
                  key={expense.id}
                  type="button"
                  onClick={() => setLinkedExpenseId(expense.id === linkedExpenseId ? "" : expense.id)}
                  className={`flex min-h-11 w-full items-center justify-between rounded-[18px] border px-4 py-3 text-left ${
                    linkedExpenseId === expense.id
                      ? "border-[var(--accent)] bg-[var(--surface-accent)]"
                      : "border-[var(--border)] bg-[var(--surface-soft)]"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-semibold text-[var(--text)]">{expense.title}</div>
                    <div className="mt-1 text-[13px] text-[var(--text-muted)]">
                      {formatCurrency((Number(expense.amount_cents || 0) + Number(expense.round_up_cents || 0)) / 100)}
                    </div>
                  </div>
                  {suggestedExpense?.id === expense.id ? (
                    <span className="rounded-full bg-[var(--surface)] px-3 py-1 text-[12px] font-semibold text-[var(--accent-strong)]">
                      Suggested
                    </span>
                  ) : null}
                </button>
              ))}
          </div>
        </div>

        <div className="mt-5">
          <label className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
            Note (optional)
          </label>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            placeholder="Anything the next person should know?"
            className="mt-2 w-full rounded-[18px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[16px] text-[var(--text)] outline-none"
          />
        </div>

        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => onConfirm?.({ linkedExpenseId: linkedExpenseId || null, note })}
          className="mt-5 flex min-h-[52px] w-full items-center justify-center rounded-full bg-[var(--accent)] px-5 text-[16px] font-semibold text-white disabled:opacity-60"
        >
          {isSubmitting ? "Saving..." : "Mark complete"}
        </button>
      </div>
    </div>
  );
}
