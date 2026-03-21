"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { formatBalance } from "../lib/utils";

const AVATAR_COLORS = ["#8BA888", "#5F7D6A", "#D4A574", "#89CFF0"];

function getInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

function formatLastActivity(value) {
  if (!value) return "No activity yet";

  const delta = Date.now() - new Date(value).getTime();
  const hours = Math.floor(delta / (1000 * 60 * 60));
  const days = Math.floor(delta / (1000 * 60 * 60 * 24));

  if (hours < 1) return "Last: just now";
  if (hours < 24) return `Last: ${hours}h ago`;
  if (days < 7) return `Last: ${days}d ago`;

  return `Last: ${new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(value))}`;
}

function CountUpBalance({ value }) {
  const reduceMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;

    const startedAt = performance.now();
    const duration = 850;
    const initial = 0;
    let frameId = 0;

    function tick(now) {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      const next = initial + (value - initial) * eased;
      setDisplayValue(next);

      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick);
      }
    }

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [reduceMotion, value]);

  return <span>{formatBalance(reduceMotion ? value : displayValue)}</span>;
}

export default function PersonCard({ person, index = 0, onOpen }) {
  const isPositive = person.balance > 0;
  const isNegative = person.balance < 0;
  const arrow = isPositive ? "↑" : isNegative ? "↓" : "•";
  const arrowTone = isPositive
    ? "bg-[rgba(16,185,129,0.1)] text-[#10B981]"
    : isNegative
      ? "bg-[rgba(220,38,38,0.1)] text-[#DC2626]"
      : "bg-[#F3F4F6] text-[#9CA3AF]";
  const buttonTone = isPositive
    ? "bg-[#E1F9D8] text-[#3A4E43] hover:bg-[#CFEEC1]"
    : isNegative
      ? "bg-[#5F7D6A] text-white hover:bg-[#3A4E43]"
      : "bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]";
  const buttonLabel = !person.isOnEvenly
    ? person.balance !== 0
      ? "Track outside app"
      : "Invite"
    : isPositive
      ? "Request payment"
      : isNegative
        ? "Settle up"
        : "Add expense";
  const statusLabel = isPositive ? "they owe you" : isNegative ? "you owe" : "settled up";

  return (
    <motion.button
      type="button"
      onClick={() => onOpen?.(person)}
      initial={{ opacity: 0, y: 18 }}
      animate={{
        opacity: 1,
        y: 0,
        transition: {
          delay: Math.min(index, 7) * 0.08,
          duration: 0.42,
          ease: [0.22, 1, 0.36, 1],
        },
      }}
      whileTap={{ scale: 0.985 }}
      className="w-full rounded-[16px] border border-[#E5E7EB] bg-white p-5 text-left shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-full text-[14px] font-semibold text-white"
            style={{ backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] }}
          >
            {getInitials(person.displayName)}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="truncate text-[20px] font-semibold tracking-[-0.03em] text-[#1C1917]">
                {person.displayName}
              </div>
              {!person.isOnEvenly ? (
                <span className="rounded-[6px] bg-[#FEF3C7] px-2 py-1 text-[11px] font-semibold text-[#92400E]">
                  Not on Evenly
                </span>
              ) : null}
            </div>
            <div className="mt-1 text-[13px] text-[#6B7280]">
              {person.sharedGroupCount} {person.sharedGroupCount === 1 ? "group" : "groups"} • {formatLastActivity(person.lastActivityAt)}
            </div>
          </div>
        </div>

        <div className={`flex h-9 w-9 items-center justify-center rounded-full text-[20px] ${arrowTone}`}>
          {arrow}
        </div>
      </div>

      <div className="mt-4 border-t border-[#F3F4F6] pt-4">
        <div className={`text-[36px] font-bold tracking-[-0.05em] ${isPositive ? "text-[#10B981]" : isNegative ? "text-[#DC2626]" : "text-[#6B7280]"}`}>
          <CountUpBalance value={person.balance} />
        </div>
        <div className="mt-1 text-[14px] font-medium text-[#6B7280]">{statusLabel}</div>
      </div>

      <div className="mt-4">
        <div className={`flex min-h-11 items-center justify-center rounded-[10px] text-[15px] font-medium transition ${buttonTone}`}>
          {buttonLabel}
        </div>
      </div>
    </motion.button>
  );
}
