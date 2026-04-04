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
    <div className={`rounded-[18px] border p-4 ${isOwe ? "border-[rgba(248,113,113,0.3)] bg-[rgba(248,113,113,0.06)]" : "border-[var(--border)] bg-[var(--surface-soft)]"}`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className={`text-[11px] font-semibold uppercase tracking-[0.1em] ${isOwe ? "text-[var(--danger)]" : "text-[var(--text-muted)]"}`}>
            {isOwe ? "You owe" : "Owed to you"}
          </div>
          <div className={`mt-1 text-[22px] font-bold tracking-[-0.04em] ${isOwe ? "text-[var(--danger)]" : "text-[var(--accent-strong)]"}`}>
            {formatCurrency(item.amount)}
          </div>
          <div className={`mt-0.5 text-[13px] ${isOwe ? "text-[rgba(248,113,113,0.6)]" : "text-[var(--text-muted)]"}`}>
            {isOwe ? `to ${item.toName}` : `from ${item.fromName}`}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onAction?.(item, isOwe ? "pay" : "request")}
          className={`inline-flex min-h-11 items-center gap-2 rounded-[12px] px-4 text-[14px] font-semibold transition active:scale-[0.99] ${
            isOwe
              ? "border border-[rgba(248,113,113,0.35)] bg-[rgba(248,113,113,0.12)] text-[var(--danger)] hover:bg-[rgba(248,113,113,0.18)]"
              : "bg-[var(--surface-accent)] text-[var(--accent-strong)] hover:bg-[var(--accent-soft-hover)]"
          }`}
        >
          <span>{isOwe ? `Pay ${item.toName}` : `Request`}</span>
          <ArrowIcon />
        </button>
      </div>
    </div>
  );
}

export default function SettlementCard({ summary, onAction }) {
  const hasItems = summary?.youOwe?.length || summary?.owedToYou?.length;

  return (
    <section className="mt-6 rounded-[28px] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">Settle up</div>

      {hasItems ? (
        <div className="mt-4 space-y-3">
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
