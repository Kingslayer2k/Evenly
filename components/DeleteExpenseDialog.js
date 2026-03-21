"use client";

export default function DeleteExpenseDialog({
  isOpen,
  expenseTitle,
  expenseAmount,
  isDeleting = false,
  onCancel,
  onConfirm,
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(0,0,0,0.5)] px-6"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-expense-title"
        className="w-full max-w-[340px] rounded-[16px] bg-white p-6 shadow-[0_18px_44px_rgba(28,25,23,0.18)]"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="delete-expense-title" className="text-[20px] font-bold tracking-[-0.03em] text-[#1C1917]">
          Delete this expense?
        </h2>

        <p className="mt-3 text-[16px] font-medium text-[#6B7280]">
          {expenseTitle} - {expenseAmount}
        </p>

        <p className="mt-3 text-[14px] leading-6 text-[#9CA3AF]">
          This will remove it for everyone in the group and update all balances.
        </p>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="h-11 flex-1 rounded-[10px] border border-[#E5E7EB] bg-white text-[15px] font-medium text-[#6B7280] transition hover:bg-[#F7F7F5] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="h-11 flex-1 rounded-[10px] bg-[#DC2626] text-[15px] font-medium text-white transition hover:bg-[#B91C1C] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
