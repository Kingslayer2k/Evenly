"use client";

export default function LeaveGroupDialog({
  isOpen,
  groupName,
  isLeaving = false,
  onCancel,
  onConfirm,
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--overlay)] px-6"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="leave-group-title"
        className="w-full max-w-[340px] rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_18px_44px_rgba(28,25,23,0.18)]"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="leave-group-title" className="text-[20px] font-bold tracking-[-0.03em] text-[var(--text)]">
          Leave this group?
        </h2>

        <p className="mt-3 text-[16px] font-medium text-[var(--text-muted)]">{groupName}</p>

        <p className="mt-3 text-[14px] leading-6 text-[var(--text-soft)]">
          We&apos;ll remove this group from your list. If you still have past expenses tied to your membership,
          you&apos;ll need to reassign or delete those first so the history stays intact.
        </p>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLeaving}
            className="h-11 flex-1 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] text-[15px] font-medium text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isLeaving}
            className="h-11 flex-1 rounded-[10px] bg-[var(--accent)] text-[15px] font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLeaving ? "Leaving..." : "Leave group"}
          </button>
        </div>
      </div>
    </div>
  );
}
