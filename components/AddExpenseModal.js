"use client";

import { useMemo, useState } from "react";

function toCents(value) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.round(parsed * 100);
}

export default function AddExpenseModal({
  isOpen,
  onClose,
  onSubmit,
  members,
  contexts,
  initialPayerId,
}) {
  const memberIds = (members || []).map((member) => member.id);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState(initialPayerId || memberIds[0] || "");
  const [splitMode, setSplitMode] = useState("equal");
  const [selectedParticipants, setSelectedParticipants] = useState(memberIds);
  const [customAmounts, setCustomAmounts] = useState(
    memberIds.reduce((accumulator, memberId) => {
      accumulator[memberId] = "";
      return accumulator;
    }, {}),
  );
  const [contextId, setContextId] = useState(contexts?.[0]?.id || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const amountCents = useMemo(() => toCents(amount), [amount]);

  const selectedMembers = useMemo(
    () => (members || []).filter((member) => selectedParticipants.includes(member.id)),
    [members, selectedParticipants],
  );

  const customTotalCents = useMemo(() => {
    return selectedParticipants.reduce((sum, memberId) => sum + toCents(customAmounts[memberId]), 0);
  }, [customAmounts, selectedParticipants]);

  if (!isOpen) return null;

  function toggleParticipant(memberId) {
    setSelectedParticipants((previous) => {
      if (previous.includes(memberId)) {
        return previous.filter((id) => id !== memberId);
      }
      return [...previous, memberId];
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSubmitting) return;

    if (!title.trim()) {
      setError("Give the expense a name first.");
      return;
    }

    if (!amountCents) {
      setError("Add a real amount before saving.");
      return;
    }

    if (!paidBy) {
      setError("Pick who paid.");
      return;
    }

    if (!selectedParticipants.length) {
      setError("Choose at least one person in the split.");
      return;
    }

    let shares = null;
    if (splitMode === "custom") {
      if (customTotalCents !== amountCents) {
        setError("Custom shares need to add up to the full amount.");
        return;
      }

      shares = selectedParticipants.reduce((accumulator, memberId) => {
        accumulator[memberId] = toCents(customAmounts[memberId]);
        return accumulator;
      }, {});
    }

    setIsSubmitting(true);
    setError("");

    const result = await onSubmit?.({
      title: title.trim(),
      amountCents,
      paidBy,
      participants: selectedParticipants,
      splitType: splitMode,
      shares,
      contextId: contextId || null,
    });

    if (!result?.ok) {
      setIsSubmitting(false);
      setError(result?.message || "Could not save the expense.");
      return;
    }

    setIsSubmitting(false);
    onClose?.();
  }

  return (
    <div className="fixed inset-0 z-50 bg-[rgba(28,25,23,0.35)]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-x-0 bottom-0 max-h-[90vh] overflow-y-auto rounded-t-[28px] bg-white px-6 pt-6 pb-8 shadow-[0_-10px_40px_rgba(28,25,23,0.14)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-[#E5E7EB]" />

        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[28px] font-bold tracking-[-0.04em] text-[#1C1917]">Add expense</h2>
            <p className="mt-2 text-[14px] leading-5 text-[#6B7280]">
              Drop in what happened and we&apos;ll update everyone live.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F3F4F6] text-[#1C1917] transition hover:bg-[#E5E7EB]"
            aria-label="Close add expense modal"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#6B7280]">
              What was it?
            </label>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Groceries, dinner, gas..."
              className="mt-2 h-12 w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[16px] text-[#1C1917] outline-none focus:border-[#0070F3]"
            />
          </div>

          <div>
            <label className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#6B7280]">
              Amount
            </label>
            <div className="mt-2 flex h-12 items-center rounded-2xl border border-[#E5E7EB] bg-white px-4 focus-within:border-[#0070F3]">
              <span className="text-[18px] font-semibold text-[#1C1917]">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
                className="ml-2 w-full bg-transparent text-[16px] text-[#1C1917] outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#6B7280]">
                Paid by
              </label>
              <select
                value={paidBy}
                onChange={(event) => setPaidBy(event.target.value)}
                className="mt-2 h-12 w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[16px] text-[#1C1917] outline-none focus:border-[#0070F3]"
              >
                {(members || []).map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.display_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#6B7280]">
                Context
              </label>
              <select
                value={contextId}
                onChange={(event) => setContextId(event.target.value)}
                className="mt-2 h-12 w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[16px] text-[#1C1917] outline-none focus:border-[#0070F3]"
              >
                <option value="">No context</option>
                {(contexts || []).map((context) => (
                  <option key={context.id} value={context.id}>
                    {context.name || context.title || "Shared"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#6B7280]">
              Split
            </div>
            <div className="mt-2 inline-flex rounded-full bg-[#F3F4F6] p-1">
              {["equal", "custom"].map((mode) => {
                const active = splitMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSplitMode(mode)}
                    className={`rounded-full px-4 py-2 text-[14px] font-semibold capitalize transition ${
                      active ? "bg-white text-[#1C1917] shadow-[0_2px_6px_rgba(28,25,23,0.08)]" : "text-[#6B7280]"
                    }`}
                  >
                    {mode}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#6B7280]">
              In the split
            </div>
            <div className="mt-3 space-y-3">
              {(members || []).map((member) => {
                const checked = selectedParticipants.includes(member.id);
                return (
                  <div
                    key={member.id}
                    className="rounded-2xl border border-[#E5E7EB] bg-[#FAFAF8] p-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <label className="flex items-center gap-3 text-[15px] text-[#1C1917]">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleParticipant(member.id)}
                          className="h-4 w-4 rounded border-[#D1D5DB] text-[#0070F3] focus:ring-[#0070F3]"
                        />
                        <span>{member.display_name}</span>
                      </label>

                      {splitMode === "custom" && checked ? (
                        <div className="flex h-10 items-center rounded-xl border border-[#E5E7EB] bg-white px-3">
                          <span className="text-[14px] font-semibold text-[#1C1917]">$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={customAmounts[member.id] || ""}
                            onChange={(event) =>
                              setCustomAmounts((previous) => ({
                                ...previous,
                                [member.id]: event.target.value,
                              }))
                            }
                            className="ml-2 w-24 bg-transparent text-right text-[14px] text-[#1C1917] outline-none"
                            placeholder="0.00"
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {splitMode === "equal" ? (
            <div className="rounded-2xl bg-[#F7F7F5] px-4 py-3 text-[14px] text-[#6B7280]">
              {selectedMembers.length
                ? `Each person covers about $${(amountCents / 100 / selectedMembers.length || 0).toFixed(2)}.`
                : "Pick at least one person to split this with."}
            </div>
          ) : (
            <div className="rounded-2xl bg-[#F7F7F5] px-4 py-3 text-[14px] text-[#6B7280]">
              Custom total: ${(customTotalCents / 100).toFixed(2)} of ${(amountCents / 100).toFixed(2)}
            </div>
          )}

          {error ? <p className="text-[14px] font-medium text-[#DC2626]">{error}</p> : null}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-[#E5E7EB] px-5 py-3 text-[15px] font-semibold text-[#6B7280] transition hover:bg-[#F7F7F5]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-full bg-[#0070F3] px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-[#0060D6] disabled:cursor-not-allowed disabled:bg-[#A3C5F7]"
            >
              {isSubmitting ? "Saving..." : "Save expense"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
