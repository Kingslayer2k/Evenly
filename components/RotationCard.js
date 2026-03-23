"use client";

import { motion } from "framer-motion";
import { formatRelativeTimeShort } from "../lib/utils";

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}

export default function RotationCard({
  rotation,
  highlight = false,
  onMarkComplete,
  showGroupName = false,
}) {
  return (
    <motion.div
      layout
      className={`rounded-[22px] border px-4 py-4 shadow-[var(--shadow-soft)] ${
        highlight
          ? "border-[var(--accent)] bg-[var(--surface-accent)]"
          : "border-[var(--border)] bg-[var(--surface)]"
      }`}
      whileTap={{ scale: 0.985 }}
      transition={{ duration: 0.16 }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[18px] font-semibold tracking-[-0.03em] text-[var(--text)]">
            {rotation.name}
          </div>
          <div className="mt-1 text-[14px] text-[var(--text-muted)]">
            {showGroupName ? `${rotation.group_name} • ` : ""}
            {rotation.current_turn_name}&apos;s turn
          </div>
        </div>
        <div
          className={`rounded-full px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.08em] ${
            highlight
              ? "bg-[var(--accent)] text-white"
              : "bg-[var(--surface-muted)] text-[var(--text-muted)]"
          }`}
        >
          {rotation.frequency}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="text-[13px] text-[var(--text-muted)]">
          Last done {rotation.last_completed_at ? formatRelativeTimeShort(rotation.last_completed_at) : "never"}
        </div>
        {highlight ? (
          <button
            type="button"
            onClick={() => onMarkComplete?.(rotation)}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--accent)] px-4 text-[14px] font-semibold text-white"
          >
            <CheckIcon />
            Mark complete
          </button>
        ) : null}
      </div>
    </motion.div>
  );
}
