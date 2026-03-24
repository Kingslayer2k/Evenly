"use client";

import { useMemo, useState } from "react";
import { copyToClipboard, formatCurrency, formatSignedCurrency } from "../lib/utils";

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

function formatDateRange(startDate, endDate) {
  if (!startDate && !endDate) return null;
  const opts = { month: "short", day: "numeric" };
  const start = startDate ? new Date(startDate).toLocaleDateString("en-US", opts) : null;
  const end = endDate ? new Date(endDate).toLocaleDateString("en-US", opts) : null;
  if (start && end) return `${start} \u2013 ${end}`;
  if (start) return `From ${start}`;
  if (end) return `Until ${end}`;
  return null;
}

function buildSummaryText({ group, members, expenses, summary, paidByMember }) {
  const dateRange = formatDateRange(
    group?.start_date || group?.starts_at,
    group?.end_date || group?.ends_at,
  );

  const totalSpentCents = expenses.reduce(
    (sum, e) => sum + Number(e.amount_cents || 0) + Number(e.round_up_cents || 0),
    0,
  );

  const lines = [];
  lines.push(`${group?.name || "Trip"} — Summary`);
  if (dateRange) lines.push(dateRange);
  lines.push("");
  lines.push(`Total spent:  ${formatCurrency(totalSpentCents / 100)}`);
  lines.push(`Expenses:     ${expenses.length}`);
  lines.push(`Members:      ${members.length}`);
  lines.push("");
  lines.push("─".repeat(36));
  lines.push("MEMBER BREAKDOWN");
  lines.push("─".repeat(36));

  const maxNameLen = Math.max(...members.map((m) => (m.display_name || "Unknown").length));
  for (const member of members) {
    const name = (member.display_name || "Unknown").padEnd(maxNameLen);
    const paid = formatCurrency(paidByMember[member.id] / 100).padStart(8);
    const net = formatSignedCurrency((summary.balancesByMember[member.id] ?? 0) / 100).padStart(8);
    const netLabel = (summary.balancesByMember[member.id] ?? 0) > 0 ? "owed" : (summary.balancesByMember[member.id] ?? 0) < 0 ? "owes" : "even";
    lines.push(`${name}  paid ${paid}   net ${net} (${netLabel})`);
  }

  if (summary?.settlements?.length) {
    lines.push("");
    lines.push("─".repeat(36));
    lines.push("SETTLEMENTS");
    lines.push("─".repeat(36));
    for (const s of summary.settlements) {
      lines.push(`${s.fromName} pays ${s.toName}: ${formatCurrency(s.amount)}`);
    }
  }

  lines.push("");
  lines.push("via Evenly");

  return lines.join("\n");
}

export default function TripSummaryModal({ isOpen, group, members, expenses, summary, onClose }) {
  const [copied, setCopied] = useState(false);

  const dateRange = formatDateRange(
    group?.start_date || group?.starts_at,
    group?.end_date || group?.ends_at,
  );

  const totalSpentCents = useMemo(
    () =>
      expenses.reduce(
        (sum, e) => sum + Number(e.amount_cents || 0) + Number(e.round_up_cents || 0),
        0,
      ),
    [expenses],
  );

  const paidByMember = useMemo(() => {
    const result = {};
    for (const member of members) result[member.id] = 0;
    for (const expense of expenses) {
      if (result[expense.paid_by] !== undefined) {
        result[expense.paid_by] +=
          Number(expense.amount_cents || 0) + Number(expense.round_up_cents || 0);
      }
    }
    return result;
  }, [expenses, members]);

  const summaryText = useMemo(
    () =>
      buildSummaryText({ group, members, expenses, summary, paidByMember }),
    [group, members, expenses, summary, paidByMember],
  );

  async function handleCopy() {
    const ok = await copyToClipboard(summaryText);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleShare() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${group?.name || "Trip"} Summary`,
          text: summaryText,
        });
      } else {
        await handleCopy();
      }
    } catch (error) {
      console.error("Share cancelled:", error);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[65] bg-[var(--overlay)]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Trip summary"
        className="fixed inset-x-0 bottom-0 flex max-h-[90dvh] flex-col rounded-t-[28px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_-16px_48px_rgba(28,25,23,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="mx-auto mt-4 h-1.5 w-12 shrink-0 rounded-full bg-[var(--border)]" />

        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-4 px-6 pt-4 pb-2">
          <div>
            <h2 className="text-[24px] font-bold tracking-[-0.04em] text-[var(--text)]">
              Trip summary
            </h2>
            {dateRange ? (
              <div className="mt-1 text-[14px] text-[var(--text-muted)]">{dateRange}</div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--text-muted)]"
          >
            <XIcon />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {/* Overview */}
          <div className="mt-3 grid grid-cols-3 gap-3">
            <div className="rounded-[20px] bg-[var(--surface-soft)] p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                Total
              </div>
              <div className="mt-1.5 text-[22px] font-bold tracking-[-0.04em] text-[var(--text)]">
                {formatCurrency(totalSpentCents / 100)}
              </div>
            </div>
            <div className="rounded-[20px] bg-[var(--surface-soft)] p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                Expenses
              </div>
              <div className="mt-1.5 text-[22px] font-bold tracking-[-0.04em] text-[var(--text)]">
                {expenses.length}
              </div>
            </div>
            <div className="rounded-[20px] bg-[var(--surface-soft)] p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                People
              </div>
              <div className="mt-1.5 text-[22px] font-bold tracking-[-0.04em] text-[var(--text)]">
                {members.length}
              </div>
            </div>
          </div>

          {/* Per-person breakdown */}
          <div className="mt-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
              Member breakdown
            </div>
            <div className="mt-3 space-y-2.5">
              {members.map((member) => {
                const paid = paidByMember[member.id] ?? 0;
                const netCents = summary?.balancesByMember?.[member.id] ?? 0;
                const shareCents = paid - netCents;
                return (
                  <div
                    key={member.id}
                    className="rounded-[20px] border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3.5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-accent)] text-[13px] font-bold text-[var(--text)]">
                          {(member.display_name || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="text-[15px] font-semibold text-[var(--text)]">
                          {member.display_name || "Unknown"}
                        </div>
                      </div>
                      <div
                        className={`text-[15px] font-bold tabular-nums ${
                          netCents > 0
                            ? "text-[#3D7A5C]"
                            : netCents < 0
                              ? "text-[var(--danger)]"
                              : "text-[var(--text-muted)]"
                        }`}
                      >
                        {netCents === 0 ? "Settled" : formatSignedCurrency(netCents / 100)}
                      </div>
                    </div>
                    <div className="mt-2.5 flex gap-4 text-[13px] text-[var(--text-muted)]">
                      <span>
                        Paid{" "}
                        <span className="font-semibold text-[var(--text)]">
                          {formatCurrency(paid / 100)}
                        </span>
                      </span>
                      <span>
                        Share{" "}
                        <span className="font-semibold text-[var(--text)]">
                          {formatCurrency(shareCents / 100)}
                        </span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Settlements */}
          {summary?.settlements?.length ? (
            <div className="mt-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                Recommended settlements
              </div>
              <div className="mt-3 space-y-2.5">
                {summary.settlements.map((s) => (
                  <div
                    key={`${s.fromMemberId}-${s.toMemberId}`}
                    className="flex items-center justify-between gap-4 rounded-[18px] border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3"
                  >
                    <div className="text-[14px] text-[var(--text)]">
                      <span className="font-semibold">{s.fromName}</span>
                      <span className="mx-1.5 text-[var(--text-muted)]">pays</span>
                      <span className="font-semibold">{s.toName}</span>
                    </div>
                    <div className="shrink-0 text-[15px] font-bold text-[var(--text)]">
                      {formatCurrency(s.amount)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-[20px] bg-[var(--surface-soft)] px-4 py-4 text-center">
              <div className="text-[28px]">✓</div>
              <div className="mt-1.5 text-[16px] font-semibold text-[var(--text)]">
                Everyone&apos;s settled!
              </div>
            </div>
          )}

          {/* Copy/Share */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-4 text-[14px] font-semibold text-[var(--text)] transition hover:opacity-90"
            >
              <CopyIcon />
              {copied ? "Copied!" : "Copy text"}
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-4 text-[14px] font-semibold text-white transition hover:opacity-90"
            >
              <ShareIcon />
              Share
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
