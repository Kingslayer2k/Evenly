"use client";

import { motion, useReducedMotion } from "framer-motion";

function Stat({ value, label }) {
  return (
    <div className="text-center">
      <div className="text-[32px] font-bold tracking-[-0.05em] text-[var(--text)]">{value}</div>
      <div className="mt-1 text-[13px] font-medium text-[var(--text-muted)]">{label}</div>
    </div>
  );
}

export default function MeStats({ stats }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-[16px] border border-[var(--border)] bg-[var(--surface)] px-5 py-5"
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">This month</div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <Stat value={stats.groupCount} label="Groups" />
        <Stat value={`$${Math.round(stats.totalSpent)}`} label="Spent" />
        <Stat value={stats.peopleCount} label="People" />
      </div>

      <div className="mt-4 border-t border-[var(--border-soft)] pt-4 text-center text-[14px] font-medium text-[var(--text-muted)]">
        {stats.expenseCount} {stats.expenseCount === 1 ? "expense" : "expenses"} added
      </div>
    </motion.section>
  );
}
