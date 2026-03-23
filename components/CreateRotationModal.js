"use client";

import { useMemo, useState } from "react";

function ChevronIcon({ direction = "down" }) {
  const rotation = direction === "up" ? "-90" : "90";
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

const FREQUENCIES = ["daily", "weekly", "monthly", "as needed"];

export default function CreateRotationModal({ isOpen, onClose, onCreate, members = [], isSubmitting = false }) {
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState("weekly");
  const [selectedIds, setSelectedIds] = useState(members.map((member) => member.user_id));
  const [orderedIds, setOrderedIds] = useState(members.map((member) => member.user_id));
  const [startUserId, setStartUserId] = useState(members[0]?.user_id || "");
  const [error, setError] = useState("");

  const orderedMembers = useMemo(() => {
    const byUserId = new Map(members.map((member) => [member.user_id, member]));
    return orderedIds.map((id) => byUserId.get(id)).filter(Boolean);
  }, [members, orderedIds]);

  if (!isOpen) return null;

  function toggleMember(userId) {
    setSelectedIds((previous) => {
      if (previous.includes(userId)) {
        const next = previous.filter((id) => id !== userId);
        if (!next.includes(startUserId)) {
          setStartUserId(next[0] || "");
        }
        return next;
      }
      return [...previous, userId];
    });
  }

  function moveMember(userId, direction) {
    setOrderedIds((previous) => {
      const index = previous.indexOf(userId);
      if (index < 0) return previous;
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= previous.length) return previous;
      const next = [...previous];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmedName = String(name || "").trim();
    const activePeople = orderedIds.filter((id) => selectedIds.includes(id));

    if (!trimmedName) {
      setError("Give the rotation a name first.");
      return;
    }

    if (activePeople.length < 2) {
      setError("Pick at least two people for the rotation.");
      return;
    }

    const currentTurnIndex = Math.max(0, activePeople.indexOf(startUserId || activePeople[0]));

    const result = await onCreate?.({
      name: trimmedName,
      frequency,
      people: activePeople,
      currentTurnIndex,
    });

    if (!result?.ok) {
      setError(result?.message || "Could not create the rotation.");
      return;
    }

    setName("");
    setFrequency("weekly");
    setError("");
    onClose?.();
  }

  return (
    <div className="fixed inset-0 z-[80] bg-[var(--overlay)]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-[28px] border border-[var(--border)] bg-[var(--surface)] px-5 pt-5 pb-[calc(var(--safe-bottom)+24px)] shadow-[0_-18px_44px_rgba(28,25,23,0.14)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-[var(--border)]" />

        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-[24px] font-bold tracking-[-0.04em] text-[var(--text)]">Create rotation</h3>
            <p className="mt-2 text-[14px] leading-5 text-[var(--text-muted)]">
              Groceries, trash, cleaning. Keep the order clear and lightweight.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--text)]"
            aria-label="Close create rotation modal"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          <div>
            <label className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Groceries, trash, deep clean..."
              className="mt-2 h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-[16px] text-[var(--text)] outline-none"
            />
          </div>

          <div>
            <div className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
              Frequency
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {FREQUENCIES.map((value) => {
                const active = frequency === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFrequency(value)}
                    className={`min-h-11 rounded-full px-4 text-[14px] font-semibold capitalize ${
                      active
                        ? "bg-[var(--accent)] text-white"
                        : "bg-[var(--surface-muted)] text-[var(--text-muted)]"
                    }`}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
              People in order
            </div>
            <div className="mt-3 space-y-3">
              {orderedMembers.map((member, index) => {
                const checked = selectedIds.includes(member.user_id);
                return (
                  <div
                    key={member.user_id}
                    className="rounded-[22px] border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <label className="flex min-w-0 items-center gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleMember(member.user_id)}
                          className="h-4 w-4"
                        />
                        <span className="truncate text-[16px] font-medium text-[var(--text)]">
                          {member.display_name}
                        </span>
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => moveMember(member.user_id, "up")}
                          disabled={index === 0}
                          className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--text-muted)] disabled:opacity-40"
                          aria-label={`Move ${member.display_name} up`}
                        >
                          <ChevronIcon direction="up" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveMember(member.user_id, "down")}
                          disabled={index === orderedMembers.length - 1}
                          className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--text-muted)] disabled:opacity-40"
                          aria-label={`Move ${member.display_name} down`}
                        >
                          <ChevronIcon direction="down" />
                        </button>
                      </div>
                    </div>
                    {checked ? (
                      <button
                        type="button"
                        onClick={() => setStartUserId(member.user_id)}
                        className={`mt-3 min-h-11 rounded-full px-4 text-[14px] font-semibold ${
                          startUserId === member.user_id
                            ? "bg-[var(--surface-accent)] text-[var(--accent-strong)]"
                            : "bg-[var(--surface)] text-[var(--text-muted)]"
                        }`}
                      >
                        {startUserId === member.user_id ? "Starts first" : "Set as first"}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          {error ? <p className="text-[14px] font-medium text-[var(--danger)]">{error}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex min-h-[52px] w-full items-center justify-center rounded-full bg-[var(--accent)] px-5 text-[16px] font-semibold text-white disabled:opacity-60"
          >
            {isSubmitting ? "Creating..." : "Create rotation"}
          </button>
        </form>
      </div>
    </div>
  );
}
