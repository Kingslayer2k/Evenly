"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { formatCurrency, formatSignedCurrency } from "../lib/utils";

const SLIDE_DURATION_MS = 5000;

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

function buildSlides({ group, members, expenses, paidByMember }) {
  const slides = [];

  const dateRange = formatDateRange(
    group?.start_date || group?.starts_at,
    group?.end_date || group?.ends_at,
  );

  // Slide 1 — Cover
  slides.push({ id: "cover", type: "cover", dateRange });

  // Slide 2 — Total spent
  slides.push({ id: "total", type: "total" });

  // Slide 3 — Who paid most (MVP)
  const mvp = members.reduce(
    (best, m) => {
      const paid = paidByMember[m.id] ?? 0;
      return paid > (best.paid ?? 0) ? { member: m, paid } : best;
    },
    { member: null, paid: 0 },
  );
  if (mvp.member && mvp.paid > 0) {
    slides.push({ id: "mvp", type: "mvp", member: mvp.member, paid: mvp.paid });
  }

  // Slide 4 — Biggest expense
  const biggest = expenses.reduce(
    (best, e) => {
      const amt = Number(e.amount_cents || 0) + Number(e.round_up_cents || 0);
      return amt > (best.amt ?? 0) ? { expense: e, amt } : best;
    },
    { expense: null, amt: 0 },
  );
  if (biggest.expense) {
    slides.push({ id: "biggest", type: "biggest", expense: biggest.expense, amt: biggest.amt });
  }

  // Slide 5 — Per-person breakdown
  if (members.length > 0) {
    slides.push({ id: "breakdown", type: "breakdown" });
  }

  // Slide 6 — Settlements or all-clear
  slides.push({ id: "settlements", type: "settlements" });

  // Slide 7 — Closing
  slides.push({ id: "close", type: "close" });

  return slides;
}

const GRADIENTS = [
  "from-[#1a2e22] via-[#2d4a35] to-[#1a2e22]",   // cover — deep green
  "from-[#1c1f3a] via-[#2a3060] to-[#1c1f3a]",   // total — midnight blue
  "from-[#2d1f3a] via-[#4a2d60] to-[#2d1f3a]",   // mvp — purple
  "from-[#3a1f1a] via-[#602d25] to-[#3a1f1a]",   // biggest — warm dark red
  "from-[#1a2e3a] via-[#2d4a60] to-[#1a2e3a]",   // breakdown — teal
  "from-[#1a2e22] via-[#2d4a35] to-[#1a2e22]",   // settlements
  "from-[#1c1f3a] via-[#2a3060] to-[#1c1f3a]",   // close
];

function getGradient(index) {
  return GRADIENTS[index % GRADIENTS.length];
}

function getExpenseLabel(expense) {
  return expense?.description || expense?.title || expense?.name || "An expense";
}

function getMemberInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ProgressBars
function ProgressBars({ total, current, elapsed, paused }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
          {i < current ? (
            <div className="absolute inset-0 bg-white" />
          ) : i === current ? (
            <motion.div
              className="absolute inset-0 origin-left bg-white"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: paused ? undefined : 1 }}
              transition={{
                duration: (SLIDE_DURATION_MS - elapsed) / 1000,
                ease: "linear",
              }}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}

// Individual slide content
function SlideContent({ slide, group, members, expenses, summary, paidByMember, totalSpentCents }) {
  switch (slide.type) {
    case "cover":
      return (
        <div className="flex flex-col items-center justify-center gap-6 px-8 text-center">
          <div className="text-[80px] leading-none">✈️</div>
          <div>
            <div
              className="text-[42px] font-bold leading-[1.1] tracking-[-0.04em] text-white"
              style={{ fontFamily: "Tiempos Headline, Georgia, serif" }}
            >
              {group?.name || "The Trip"}
            </div>
            {slide.dateRange ? (
              <div className="mt-3 text-[18px] font-medium text-white/70">{slide.dateRange}</div>
            ) : null}
          </div>
          <div className="text-[16px] font-medium text-white/50">
            {members.length} {members.length === 1 ? "person" : "people"} •{" "}
            {expenses.length} {expenses.length === 1 ? "expense" : "expenses"}
          </div>
        </div>
      );

    case "total":
      return (
        <div className="flex flex-col items-center justify-center gap-4 px-8 text-center">
          <div className="text-[52px] leading-none">💸</div>
          <div className="text-[16px] font-semibold uppercase tracking-[0.18em] text-white/60">
            Total spent together
          </div>
          <div className="text-[72px] font-bold leading-none tracking-[-0.04em] text-white">
            {formatCurrency(totalSpentCents / 100)}
          </div>
          <div className="mt-2 text-[15px] text-white/55">
            across {expenses.length} {expenses.length === 1 ? "expense" : "expenses"}
          </div>
        </div>
      );

    case "mvp": {
      const initials = getMemberInitials(slide.member?.display_name);
      return (
        <div className="flex flex-col items-center justify-center gap-5 px-8 text-center">
          <div className="text-[52px] leading-none">🏆</div>
          <div className="text-[16px] font-semibold uppercase tracking-[0.18em] text-white/60">
            Top payer
          </div>
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/15 text-[36px] font-bold text-white ring-4 ring-white/30">
            {initials}
          </div>
          <div className="text-[36px] font-bold tracking-[-0.03em] text-white">
            {slide.member?.display_name || "Someone"}
          </div>
          <div className="text-[20px] font-medium text-white/70">
            covered {formatCurrency(slide.paid / 100)}
          </div>
        </div>
      );
    }

    case "biggest": {
      const label = getExpenseLabel(slide.expense);
      const payer = members.find((m) => m.id === slide.expense?.paid_by);
      return (
        <div className="flex flex-col items-center justify-center gap-5 px-8 text-center">
          <div className="text-[52px] leading-none">🔥</div>
          <div className="text-[16px] font-semibold uppercase tracking-[0.18em] text-white/60">
            Biggest expense
          </div>
          <div
            className="text-[34px] font-bold leading-tight tracking-[-0.03em] text-white"
            style={{ fontFamily: "Tiempos Headline, Georgia, serif" }}
          >
            {label}
          </div>
          <div className="text-[52px] font-bold leading-none tracking-[-0.04em] text-white">
            {formatCurrency(slide.amt / 100)}
          </div>
          {payer ? (
            <div className="text-[15px] text-white/55">
              paid by {payer.display_name}
            </div>
          ) : null}
        </div>
      );
    }

    case "breakdown": {
      const sorted = [...members].sort((a, b) => {
        const aN = summary?.balancesByMember?.[a.id] ?? 0;
        const bN = summary?.balancesByMember?.[b.id] ?? 0;
        return bN - aN;
      });
      return (
        <div className="flex w-full flex-col gap-4 px-6">
          <div className="text-center">
            <div className="text-[16px] font-semibold uppercase tracking-[0.18em] text-white/60">
              How it shook out
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            {sorted.map((member) => {
              const netCents = summary?.balancesByMember?.[member.id] ?? 0;
              const paid = paidByMember[member.id] ?? 0;
              const isPositive = netCents > 0;
              const isNegative = netCents < 0;
              return (
                <div
                  key={member.id}
                  className="flex items-center gap-3 rounded-[18px] bg-white/10 px-4 py-3.5 backdrop-blur-sm"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-[14px] font-bold text-white">
                    {getMemberInitials(member.display_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-semibold text-white">
                      {member.display_name || "Unknown"}
                    </div>
                    <div className="text-[12px] text-white/55">
                      paid {formatCurrency(paid / 100)}
                    </div>
                  </div>
                  <div
                    className={`shrink-0 text-[16px] font-bold ${
                      isPositive ? "text-[#6ee7a0]" : isNegative ? "text-[#fca5a5]" : "text-white/50"
                    }`}
                  >
                    {netCents === 0 ? "Even" : formatSignedCurrency(netCents / 100)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    case "settlements":
      if (!summary?.settlements?.length) {
        return (
          <div className="flex flex-col items-center justify-center gap-5 px-8 text-center">
            <div className="text-[72px] leading-none">🎉</div>
            <div
              className="text-[36px] font-bold leading-tight tracking-[-0.03em] text-white"
              style={{ fontFamily: "Tiempos Headline, Georgia, serif" }}
            >
              Everyone&apos;s settled!
            </div>
            <div className="text-[16px] text-white/60">
              No outstanding balances — it all evened out.
            </div>
          </div>
        );
      }
      return (
        <div className="flex w-full flex-col gap-4 px-6">
          <div className="text-center">
            <div className="text-[52px] leading-none">💳</div>
            <div className="mt-3 text-[16px] font-semibold uppercase tracking-[0.18em] text-white/60">
              Who pays who
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            {summary.settlements.map((s) => (
              <div
                key={`${s.fromMemberId}-${s.toMemberId}`}
                className="flex items-center justify-between gap-3 rounded-[18px] bg-white/10 px-4 py-4 backdrop-blur-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold text-white">{s.fromName}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[13px] text-white/55">
                    <span>pays</span>
                    <span className="font-semibold text-white/80">{s.toName}</span>
                  </div>
                </div>
                <div className="shrink-0 text-[18px] font-bold text-white">
                  {formatCurrency(s.amount)}
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case "close":
      return (
        <div className="flex flex-col items-center justify-center gap-6 px-8 text-center">
          <div className="text-[72px] leading-none">🌅</div>
          <div
            className="text-[40px] font-bold leading-tight tracking-[-0.04em] text-white"
            style={{ fontFamily: "Tiempos Headline, Georgia, serif" }}
          >
            What a trip.
          </div>
          <div className="text-[16px] leading-7 text-white/60">
            Shared experiences. Shared costs.<br />Evenly keeps it fair.
          </div>
          <div className="mt-2 rounded-full border border-white/20 bg-white/10 px-5 py-2 text-[13px] font-semibold tracking-[0.06em] text-white/50">
            via Evenly
          </div>
        </div>
      );

    default:
      return null;
  }
}

function parseGradientColors(gradientClass) {
  const matches = gradientClass.match(/#[0-9a-fA-F]{6}/g) || [];
  if (matches.length >= 2) return [matches[0], matches[1]];
  if (matches.length === 1) return [matches[0], matches[0]];
  return ["#1a2e22", "#2d4a35"];
}

async function generateShareCard({ group, totalSpentCents, members, expenses, gradientClass }) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext("2d");

  const [colorFrom, colorVia] = parseGradientColors(gradientClass);

  const grad = ctx.createLinearGradient(0, 0, 0, 1080);
  grad.addColorStop(0, colorFrom);
  grad.addColorStop(0.5, colorVia);
  grad.addColorStop(1, colorFrom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1080, 1080);

  // Trip name
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.textAlign = "center";
  ctx.font = "bold 82px Georgia, serif";
  const tripName = group?.name || "The Trip";
  ctx.fillText(tripName, 540, 340);

  // Total spent label
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "600 28px -apple-system, sans-serif";
  ctx.fillText("TOTAL SPENT TOGETHER", 540, 430);

  // Total amount
  ctx.fillStyle = "rgba(255,255,255,1)";
  ctx.font = "bold 120px -apple-system, sans-serif";
  const dollars = (totalSpentCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
  ctx.fillText(dollars, 540, 580);

  // Subtitle
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "500 30px -apple-system, sans-serif";
  const subtitle = `${members.length} ${members.length === 1 ? "person" : "people"} · ${expenses.length} ${expenses.length === 1 ? "expense" : "expenses"}`;
  ctx.fillText(subtitle, 540, 650);

  // Branding
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.font = "600 24px -apple-system, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("made with Evenly", 1040, 1040);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

export default function TripStoryModal({ isOpen, group, members, expenses, summary, onClose }) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [direction, setDirection] = useState(1);
  const [elapsed, setElapsed] = useState(0);
  const [isSharing, setIsSharing] = useState(false);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const elapsedAtPauseRef = useRef(0);

  const totalSpentCents = useMemo(
    () => expenses.reduce((sum, e) => sum + Number(e.amount_cents || 0) + Number(e.round_up_cents || 0), 0),
    [expenses],
  );

  const paidByMember = useMemo(() => {
    const result = {};
    for (const member of members) result[member.id] = 0;
    for (const expense of expenses) {
      if (result[expense.paid_by] !== undefined) {
        result[expense.paid_by] += Number(expense.amount_cents || 0) + Number(expense.round_up_cents || 0);
      }
    }
    return result;
  }, [expenses, members]);

  const slides = useMemo(
    () => buildSlides({ group, members, expenses, summary, paidByMember, totalSpentCents }),
    [group, members, expenses, summary, paidByMember, totalSpentCents],
  );

  const goNext = useCallback(() => {
    setDirection(1);
    setCurrent((prev) => {
      if (prev < slides.length - 1) return prev + 1;
      onClose?.();
      return prev;
    });
    setElapsed(0);
    elapsedAtPauseRef.current = 0;
    startTimeRef.current = Date.now();
  }, [onClose, slides.length]);

  const goPrev = useCallback(() => {
    setDirection(-1);
    setCurrent((prev) => Math.max(0, prev - 1));
    setElapsed(0);
    elapsedAtPauseRef.current = 0;
    startTimeRef.current = Date.now();
  }, []);

  // Auto-advance timer
  useEffect(() => {
    if (!isOpen || paused) return;
    const remaining = SLIDE_DURATION_MS - elapsed;
    startTimeRef.current = Date.now();
    timerRef.current = window.setTimeout(() => {
      goNext();
    }, remaining);
    return () => window.clearTimeout(timerRef.current);
  }, [isOpen, paused, current, elapsed, goNext]);

  // Reset on open
  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => {
      setCurrent(0);
      setElapsed(0);
      setDirection(1);
      setPaused(false);
      elapsedAtPauseRef.current = 0;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  const handleTouchStart = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setPaused(true);
    elapsedAtPauseRef.current += startTimeRef.current ? Date.now() - startTimeRef.current : 0;
    startTimeRef.current = null;
  }, []);

  const handleTouchEnd = useCallback(() => {
    setElapsed(Math.min(elapsedAtPauseRef.current, SLIDE_DURATION_MS - 100));
    setPaused(false);
  }, []);

  const handleShare = useCallback(async () => {
    if (isSharing) return;
    setIsSharing(true);
    try {
      const gradientClass = getGradient(current);
      const blob = await generateShareCard({ group, totalSpentCents, members, expenses, gradientClass });
      if (!blob) return;
      const fileName = `${(group?.name || "trip").replace(/\s+/g, "-").toLowerCase()}-recap.png`;
      const file = new File([blob], fileName, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${group?.name || "Trip"} — recap` });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // User cancelled share or share not supported — silently ignore
    } finally {
      setIsSharing(false);
    }
  }, [isSharing, current, group, totalSpentCents, members, expenses]);

  if (!isOpen) return null;

  const gradient = getGradient(current);

  return (
    <div className="fixed inset-0 z-[80] flex items-stretch bg-black">
      {/* Background gradient */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`bg-${current}`}
          className={`absolute inset-0 bg-gradient-to-b ${gradient}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        />
      </AnimatePresence>

      {/* Content layer */}
      <div className="relative flex w-full flex-col">
        {/* Top bar */}
        <div className="relative z-10 px-4 pt-[env(safe-area-inset-top,16px)] pt-4">
          {/* Progress bars */}
          <ProgressBars
            total={slides.length}
            current={current}
            elapsed={elapsed}
            paused={paused}
          />

          {/* Header row */}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-[13px] font-bold text-white">
                {(group?.name || "T").charAt(0).toUpperCase()}
              </div>
              <div className="text-[14px] font-semibold text-white">{group?.name}</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleShare}
                disabled={isSharing}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 disabled:opacity-50"
                aria-label="Share trip recap"
              >
                {isSharing ? (
                  <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 12a8 8 0 1 1-2.34-5.66" /><path d="M20 4v6h-6" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                    <polyline points="16 6 12 2 8 6" />
                    <line x1="12" y1="2" x2="12" y2="15" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
                aria-label="Close story"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Slide area */}
        <div className="relative flex flex-1 items-center justify-center overflow-hidden">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={current}
              custom={direction}
              variants={{
                enter: (d) => ({ x: d > 0 ? 60 : -60, opacity: 0 }),
                center: { x: 0, opacity: 1 },
                exit: (d) => ({ x: d > 0 ? -60 : 60, opacity: 0 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: [0.32, 0, 0.67, 0] }}
              className="flex w-full items-center justify-center"
            >
              <SlideContent
                slide={slides[current]}
                group={group}
                members={members}
                expenses={expenses}
                summary={summary}
                paidByMember={paidByMember}
                totalSpentCents={totalSpentCents}
              />
            </motion.div>
          </AnimatePresence>

          {/* Tap zones */}
          <div
            className="absolute inset-y-0 left-0 w-[38%]"
            onMouseDown={handleTouchStart}
            onMouseUp={() => { handleTouchEnd(); goPrev(); }}
            onTouchStart={handleTouchStart}
            onTouchEnd={() => { handleTouchEnd(); goPrev(); }}
            aria-label="Previous slide"
          />
          <div
            className="absolute inset-y-0 right-0 w-[62%]"
            onMouseDown={handleTouchStart}
            onMouseUp={() => { handleTouchEnd(); goNext(); }}
            onTouchStart={handleTouchStart}
            onTouchEnd={() => { handleTouchEnd(); goNext(); }}
            aria-label="Next slide"
          />
        </div>

        {/* Slide counter hint */}
        <div className="relative z-10 pb-[env(safe-area-inset-bottom,24px)] pb-6 text-center">
          <div className="text-[12px] font-medium text-white/35">
            {current + 1} / {slides.length}
          </div>
        </div>
      </div>
    </div>
  );
}
