"use client";

import { formatCurrency } from "../lib/utils";

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function SettlementRow({ item, variant, onAction }) {
  const isOwe = variant === "owe";

  return (
    <div className="border-b border-[var(--border-soft)] py-3 last:border-b-0">
      <div className="flex items-center justify-between gap-4">
        <div className="text-[15px] font-medium text-[var(--text)]">
          {isOwe ? `You owe ${item.toName}` : `${item.fromName} owes you`}
        </div>
        <div className={`text-[17px] font-bold ${isOwe ? "text-[var(--warning)]" : "text-[var(--accent-strong)]"}`}>
          {formatCurrency(item.amount)}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onAction?.(item, isOwe ? "pay" : "request")}
        className={`mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-[8px] px-4 text-[14px] font-medium transition active:scale-[0.99] ${
          isOwe
            ? "bg-[var(--accent)] text-white hover:opacity-90"
            : "bg-[var(--surface-accent)] text-[var(--accent-strong)] hover:bg-[var(--accent-soft-hover)]"
        }`}
      >
        <span>{isOwe ? `Pay ${item.toName}` : `Request from ${item.fromName}`}</span>
        <ArrowIcon />
      </button>
    </div>
  );
}

export default function SettlementCard({ summary, onAction }) {
  const hasItems = summary?.youOwe?.length || summary?.owedToYou?.length;

  return (
    <section className="mt-6 rounded-[28px] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">Settle up</div>

      {hasItems ? (
        <div className="mt-4">
          {(summary?.youOwe || []).map((item) => (
            <SettlementRow
              key={`owe-${item.fromMemberId}-${item.toMemberId}`}
              item={item}
              variant="owe"
              onAction={onAction}
            />
          ))}

          {(summary?.owedToYou || []).map((item) => (
            <SettlementRow
              key={`owed-${item.fromMemberId}-${item.toMemberId}`}
              item={item}
              variant="owed"
              onAction={onAction}
            />
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl bg-[var(--surface-muted)] px-4 py-4 text-center">
          <div className="text-[32px]">✓</div>
          <div className="mt-2 text-[18px] font-medium text-[var(--text)]">All settled up!</div>
          <div className="mt-1 text-[14px] text-[var(--text-muted)]">Everyone is even.</div>
        </div>
      )}
    </section>
  );
}
