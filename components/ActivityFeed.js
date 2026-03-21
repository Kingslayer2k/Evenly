"use client";

import { motion, useReducedMotion } from "framer-motion";

function formatRelativeTime(value) {
  if (!value) return "Just now";
  const delta = Date.now() - new Date(value).getTime();
  const hours = Math.floor(delta / (1000 * 60 * 60));
  const days = Math.floor(delta / (1000 * 60 * 60 * 24));

  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export default function ActivityFeed({
  items,
  title = "Recent activity",
  emptyTitle = "No activity yet",
  emptyCopy = "Once expenses and settlements start moving, they’ll show up here.",
  onViewAll,
}) {
  const reduceMotion = useReducedMotion();

  return (
    <section className="rounded-[16px] border border-[#E5E7EB] bg-white px-5 py-5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6B7280]">{title}</div>

      {items?.length ? (
        <div className="mt-4">
          {items.map((item, index) => (
            <motion.div
              key={item.id}
              initial={reduceMotion ? false : { opacity: 0, x: 20 }}
              animate={reduceMotion ? undefined : { opacity: 1, x: 0 }}
              transition={{ delay: Math.min(index, 7) * 0.05, duration: 0.3 }}
              className="border-b border-[#F3F4F6] py-3 last:border-b-0"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[rgba(95,125,106,0.1)] text-[18px]">
                  {item.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-[15px] font-medium text-[#1C1917]">{item.title}</div>
                  <div className="mt-1 text-[13px] text-[#6B7280]">
                    {item.meta} • {formatRelativeTime(item.createdAt)}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-[14px] bg-[#F7F7F5] px-4 py-5 text-center">
          <div className="text-[18px] font-medium text-[#1C1917]">{emptyTitle}</div>
          <div className="mt-2 text-[14px] leading-6 text-[#6B7280]">{emptyCopy}</div>
        </div>
      )}

      {onViewAll ? (
        <button
          type="button"
          onClick={onViewAll}
          className="mt-4 min-h-10 w-full rounded-[8px] border border-[#E5E7EB] bg-[#F9FAFB] text-[14px] font-medium text-[#5F7D6A] transition hover:bg-[#F3F4F6]"
        >
          View all activity
        </button>
      ) : null}
    </section>
  );
}
