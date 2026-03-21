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
    <div className="fixed inset-0 z-[70] bg-[rgba(28,25,23,0.38)]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-person-title"
        className="fixed inset-x-0 bottom-0 rounded-t-[28px] bg-white px-6 pt-6 pb-8 shadow-[0_-18px_44px_rgba(28,25,23,0.16)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-[#E5E7EB]" />

        <h2 id="add-person-title" className="text-[24px] font-bold tracking-[-0.04em] text-[#1C1917]">
          Add Person
        </h2>
        <p className="mt-2 text-[14px] leading-6 text-[#6B7280]">
          Track expenses with someone who doesn’t use Evenly yet.
        </p>

        <div className="mt-6 space-y-5">
          <label className="block">
            <div className="text-[13px] font-medium text-[#6B7280]">Name</div>
            <input
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="mt-2 h-12 w-full rounded-[10px] border border-[#E5E7EB] px-4 text-[15px] text-[#1C1917] outline-none focus:border-[#5F7D6A]"
            />
          </label>

          <label className="block">
            <div className="text-[13px] font-medium text-[#6B7280]">Phone (optional)</div>
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="mt-2 h-12 w-full rounded-[10px] border border-[#E5E7EB] px-4 text-[15px] text-[#1C1917] outline-none focus:border-[#5F7D6A]"
            />
          </label>

          <label className="block">
            <div className="text-[13px] font-medium text-[#6B7280]">Email (optional)</div>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 h-12 w-full rounded-[10px] border border-[#E5E7EB] px-4 text-[15px] text-[#1C1917] outline-none focus:border-[#5F7D6A]"
            />
          </label>
        </div>

        {error ? <div className="mt-4 text-[14px] font-medium text-[#DC2626]">{error}</div> : null}

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-[12px] border border-[#E5E7EB] bg-white text-[15px] font-medium text-[#6B7280] transition hover:bg-[#F7F7F5]"
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
            className="min-h-11 rounded-[12px] bg-[#5F7D6A] text-[15px] font-medium text-white transition hover:bg-[#3A4E43] disabled:cursor-not-allowed disabled:bg-[#A3B8A8]"
          >
            {isSubmitting ? "Adding..." : "Add person"}
          </button>
        </div>
      </div>
    </div>
  );
}
