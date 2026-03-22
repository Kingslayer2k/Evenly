"use client";

import { useEffect, useRef, useState } from "react";

function Spinner() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
  );
}

export default function JoinGroupModal({ isOpen, onClose, onJoin, initialCode = "" }) {
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setCode(initialCode.toUpperCase().slice(0, 6));
    setError("");
    window.setTimeout(() => {
      inputRef.current?.focus();
    }, 20);
    function onKeyDown(event) {
      if (event.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [initialCode, isOpen, onClose]);

  async function tryJoin(nextCode) {
    if (nextCode.length < 6 || isLoading) return;
    setIsLoading(true);
    setError("");

    const result = await onJoin?.(nextCode);
    if (result?.ok) {
      setCode("");
      setError("");
      setIsLoading(false);
      onClose?.();
      return;
    }

    setIsLoading(false);
    setError(result?.message || "Invalid code. Try again.");
  }

  useEffect(() => {
    if (code.length === 6) {
      void tryJoin(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  if (!isOpen) return null;

  function handleInputChange(event) {
    const next = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    setCode(next);
    if (error) setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await tryJoin(code);
  }

  return (
    <div className="fixed inset-0 z-50 bg-[var(--overlay)]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-x-0 bottom-0 h-[85vh] rounded-t-[24px] border border-[var(--border)] bg-[var(--surface)] transition duration-300 ease-out"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex h-14 items-center justify-between border-b border-[var(--border)] px-5">
          <button type="button" className="text-[16px] font-medium text-[var(--text-muted)]" onClick={onClose}>
            Cancel
          </button>
          <span />
          <span />
        </div>

        <form onSubmit={handleSubmit} className="flex h-[calc(85vh-56px)] flex-col px-6 pt-6 pb-6">
          <h2 className="text-[28px] font-bold text-[var(--text)]">Join by code</h2>
          <p className="mt-2 text-[15px] font-normal text-[var(--text-muted)]">No links, no drama.</p>

          <label className="mt-8 block text-[13px] font-medium text-[var(--text-muted)]">Code</label>
          <input
            ref={inputRef}
            type="text"
            maxLength={6}
            autoComplete="off"
            value={code}
            onChange={handleInputChange}
            placeholder="ABC123"
            className="mt-2 h-16 w-full rounded-xl border-2 border-[var(--border)] bg-[var(--surface)] px-5 text-center font-mono text-[28px] font-bold tracking-[8px] uppercase text-[var(--text)] outline-none focus:border-[var(--accent)]"
          />

          {error ? (
            <p className="mt-2 text-[14px] font-normal text-[var(--danger)]">{error}</p>
          ) : null}

          <div className="mt-auto flex justify-end">
            <button
              type="submit"
              disabled={code.length < 6 || isLoading}
              className="flex min-w-[124px] items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-8 py-3 text-[16px] font-medium text-white transition duration-200 ease-out hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)] disabled:text-[var(--text-soft)]"
            >
              {isLoading ? (
                <>
                  <Spinner />
                  Joining...
                </>
              ) : (
                "Join"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
