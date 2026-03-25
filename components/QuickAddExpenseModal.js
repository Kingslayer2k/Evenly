"use client";

import { useEffect, useRef, useState } from "react";
import { createExpenseRecord } from "../lib/groupData";
import { supabase } from "../lib/supabase";

export default function QuickAddExpenseModal({
  isOpen,
  onClose,
  groups,
  membersByGroup,
  memberships,
  user,
  onSuccess,
}) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const amountRef = useRef(null);
  const descRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const firstGroupId = groups[0]?.id || "";
    setSelectedGroupId(firstGroupId);
    setAmount("");
    setDescription("");
    setError("");
    setIsSubmitting(false);
    window.setTimeout(() => amountRef.current?.focus(), 80);
  }, [isOpen, groups]);

  useEffect(() => {
    if (!selectedGroupId) return;
    const membership = memberships.find((m) => m.group_id === selectedGroupId);
    setPaidBy(membership?.id || "");
  }, [selectedGroupId, memberships]);

  function resetAndClose() {
    setAmount("");
    setDescription("");
    setError("");
    setIsSubmitting(false);
    onClose?.();
  }

  const members = membersByGroup[selectedGroupId] || [];
  const selectedGroup = groups.find((g) => g.id === selectedGroupId);
  const amountCents = Math.round(parseFloat(amount || "0") * 100);
  const canSubmit = amountCents > 0 && selectedGroupId && !isSubmitting;

  async function handleSubmit() {
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError("");

    try {
      const title = `\u{1F4B8} ${description.trim() || "Expense"}`;
      await createExpenseRecord(supabase, user, {
        groupId: selectedGroupId,
        title,
        amountCents,
        paidBy,
        participants: members.map((m) => m.id),
        splitType: "equal",
        splitMethod: "even",
        contextName: selectedGroup?.name || "General",
      });

      onSuccess?.({ groupId: selectedGroupId });
      resetAndClose();
    } catch (err) {
      setError(err.message || "Could not add expense right now.");
      setIsSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[var(--overlay)]" onClick={resetAndClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-x-0 bottom-0 rounded-t-[24px] border border-[var(--border)] bg-[var(--surface)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-[var(--border)]" />

        <div className="px-6 pt-4 pb-[max(calc(env(safe-area-inset-bottom)+24px),24px)]">
          <h2 className="text-[22px] font-bold tracking-[-0.03em] text-[var(--text)]">
            Quick add
          </h2>

          <div className="mt-5 flex items-baseline gap-1">
            <span className="text-[36px] font-bold text-[var(--text-soft)]">$</span>
            <input
              ref={amountRef}
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") descRef.current?.focus(); }}
              placeholder="0.00"
              className="w-full bg-transparent text-[40px] font-bold tracking-[-0.03em] text-[var(--text)] outline-none placeholder:text-[var(--text-soft)]"
            />
          </div>

          <input
            ref={descRef}
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleSubmit(); }}
            placeholder="What was it for?"
            className="mt-3 h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 text-[16px] text-[var(--text)] placeholder:text-[var(--text-soft)] outline-none focus:border-[var(--accent)]"
          />

          {groups.length > 1 ? (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSelectedGroupId(g.id)}
                  className={`shrink-0 rounded-full px-3.5 py-2 text-[13px] font-semibold transition ${
                    selectedGroupId === g.id
                      ? "bg-[var(--accent)] text-white"
                      : "border border-[var(--border)] text-[var(--text-muted)]"
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          ) : null}

          {members.length > 1 ? (
            <div className="mt-4">
              <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                Paid by
              </div>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaidBy(m.id)}
                    className={`rounded-full px-3.5 py-2 text-[13px] font-semibold transition ${
                      paidBy === m.id
                        ? "bg-[var(--accent)] text-white"
                        : "border border-[var(--border)] text-[var(--text-muted)]"
                    }`}
                  >
                    {m.display_name || "Member"}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {error ? (
            <p className="mt-3 text-[13px] font-medium text-[var(--danger)]">{error}</p>
          ) : null}

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            className="mt-5 w-full rounded-xl bg-[var(--accent)] py-3.5 text-[16px] font-semibold text-white transition disabled:bg-[var(--surface-muted)] disabled:text-[var(--text-soft)]"
          >
            {isSubmitting ? "Adding..." : "Add expense"}
          </button>
        </div>
      </div>
    </div>
  );
}
