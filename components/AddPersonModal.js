"use client";

import { useState } from "react";

export default function AddPersonModal({ isOpen, onClose, onCreate }) {
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-[var(--overlay)]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-person-title"
        className="fixed inset-x-0 bottom-0 rounded-t-[28px] border border-[var(--border)] bg-[var(--surface)] px-6 pt-6 pb-8 shadow-[0_-18px_44px_rgba(28,25,23,0.16)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-[var(--border)]" />

        <h2 id="add-person-title" className="text-[24px] font-bold tracking-[-0.04em] text-[var(--text)]">
          Add Person
        </h2>
        <p className="mt-2 text-[14px] leading-6 text-[var(--text-muted)]">
          Track expenses with someone who doesn’t use Evenly yet.
        </p>

        <div className="mt-6 space-y-5">
          <label className="block">
            <div className="text-[13px] font-medium text-[var(--text-muted)]">Name</div>
            <input
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="mt-2 h-12 w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-4 text-[15px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
            />
          </label>

          <label className="block">
            <div className="text-[13px] font-medium text-[var(--text-muted)]">Phone (optional)</div>
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="mt-2 h-12 w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-4 text-[15px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
            />
          </label>

          <label className="block">
            <div className="text-[13px] font-medium text-[var(--text-muted)]">Email (optional)</div>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 h-12 w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-4 text-[15px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
            />
          </label>
        </div>

        {error ? <div className="mt-4 text-[14px] font-medium text-[var(--danger)]">{error}</div> : null}

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] text-[15px] font-medium text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={async () => {
              setIsSubmitting(true);
              setError("");
              const result = await onCreate?.({
                displayName,
                phone,
                email,
              });

              if (!result?.ok) {
                setError(result?.message || "Could not add that person.");
                setIsSubmitting(false);
                return;
              }

              setDisplayName("");
              setPhone("");
              setEmail("");
              setIsSubmitting(false);
              onClose?.();
            }}
            className="min-h-11 rounded-[12px] bg-[var(--accent)] text-[15px] font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Adding..." : "Add person"}
          </button>
        </div>
      </div>
    </div>
  );
}
