"use client";

import { motion, AnimatePresence } from "framer-motion";
import { bottomSheet, overlayFade } from "../lib/animations";
import { formatCurrency } from "../lib/utils";
import useBodyScrollLock from "../hooks/useBodyScrollLock";

function ConfidenceBadge({ confidence }) {
  const labels = { low: "Learning", medium: "Good data", high: "Strong data" };
  const colors = {
    low: "text-[var(--text-muted)] bg-[var(--surface-muted)]",
    medium: "text-[var(--accent-strong)] bg-[var(--surface-accent)]",
    high: "text-[var(--accent-strong)] bg-[var(--surface-accent)]",
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${colors[confidence] || colors.low}`}>
      {labels[confidence] || "Learning"}
    </span>
  );
}

export default function SmartSplitModal({
  isOpen,
  onClose,
  result,
  members = [],
  onApply,
}) {
  useBodyScrollLock();

  if (!isOpen || !result) return null;

  const { shares, explanation, confidence } = result;
  const totalShare = Object.values(shares).reduce((sum, c) => sum + Number(c || 0), 0);
  const maxShare = Math.max(...Object.values(shares).map(Number), 1);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[80] bg-[var(--overlay)]"
        initial={overlayFade.initial}
        animate={overlayFade.animate}
        exit={overlayFade.exit}
        transition={overlayFade.transition}
        onClick={onClose}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Smart Split breakdown"
          className="scroll-sheet fixed inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-[28px] border border-[var(--border)] bg-[var(--surface)] px-5 pt-5 pb-[calc(var(--safe-bottom)+24px)] shadow-[0_-8px_28px_rgba(28,25,23,0.12)]"
          initial={bottomSheet.initial}
          animate={bottomSheet.animate}
          exit={bottomSheet.exit}
          transition={bottomSheet.transition}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-[var(--border)]" />

          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[16px] text-[var(--accent-strong)]">✦</span>
                <h3 className="text-[24px] font-bold tracking-[-0.04em] text-[var(--text)]">Smart Split</h3>
              </div>
              <p className="mt-2 text-[14px] leading-5 text-[var(--text-muted)]">
                Suggested breakdown based on your group&apos;s history.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--text)]"
              aria-label="Close Smart Split"
            >
              ×
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {members.map((member) => {
              const cents = Number(shares[member.id] || 0);
              const pct = totalShare > 0 ? Math.round((cents / totalShare) * 100) : 0;
              const barWidth = maxShare > 0 ? (cents / maxShare) * 100 : 0;
              return (
                <div
                  key={member.id}
                  className="rounded-[20px] border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-[15px] font-semibold text-[var(--text)]">{member.display_name}</div>
                    <div className="text-[16px] font-bold text-[var(--text)]">{formatCurrency(cents / 100)}</div>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                      <div
                        className="h-full rounded-full bg-[var(--accent)]"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <div className="w-8 text-right text-[12px] font-medium text-[var(--text-muted)]">{pct}%</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 rounded-[16px] bg-[var(--surface-muted)] px-4 py-3">
            <div className="text-[13px] text-[var(--text-muted)]">{explanation}</div>
            <ConfidenceBadge confidence={confidence} />
          </div>

          <button
            type="button"
            onClick={() => onApply?.(result)}
            className="mt-5 flex min-h-[52px] w-full items-center justify-center rounded-full bg-[var(--accent)] px-5 text-[16px] font-semibold text-white transition hover:opacity-90"
          >
            Apply Smart Split
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
