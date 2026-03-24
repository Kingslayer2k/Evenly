"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import useLowPerformanceMode from "../../hooks/useLowPerformanceMode";
import usePersonBalances from "../../hooks/usePersonBalances";
import useActivityFeed from "../../hooks/useActivityFeed";
import { loadUserTurnRotations } from "../../lib/groupData";
import { getDisplayNameFromUser } from "../../lib/utils";
import { pageTransition } from "../../lib/animations";
import { supabase } from "../../lib/supabase";

// Stable color palette for avatars
const AVATAR_COLORS = [
  ["#2d4a35", "#6ee7a0"],
  ["#1c2a4a", "#93c5fd"],
  ["#3a1f2d", "#f9a8d4"],
  ["#2d2a1a", "#fde68a"],
  ["#1a2d3a", "#67e8f9"],
  ["#3a2a1a", "#fdba74"],
];
function getAvatarColors(name) {
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function formatRelativeTime(value) {
  if (!value) return "";
  const delta = Date.now() - new Date(value).getTime();
  const hours = Math.floor(delta / 3600000);
  const days = Math.floor(delta / 86400000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

// Animated counter for the big balance number
function AnimatedBalance({ value, isPositive, isNegative }) {
  const [displayed, setDisplayed] = useState(value);
  const prevRef = useRef(value);
  const frameRef = useRef(null);

  useEffect(() => {
    const start = prevRef.current;
    const end = value;
    if (start === end) return;

    const duration = 600;
    const startTime = performance.now();

    function tick(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(start + (end - start) * eased);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        prevRef.current = end;
      }
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [value]);

  const abs = Math.abs(displayed);
  const formatted = `$${abs.toFixed(2)}`;

  return (
    <span
      className={
        isPositive ? "text-[#6ee7a0]" : isNegative ? "text-[#fca5a5]" : "text-white/90"
      }
    >
      {isNegative ? "-" : isPositive ? "+" : ""}{formatted}
    </span>
  );
}

function HomeSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-56 animate-pulse rounded-[32px] bg-[var(--surface)]" />
      <div className="h-20 animate-pulse rounded-[24px] bg-[var(--surface-muted)]" />
      <div className="h-20 animate-pulse rounded-[24px] bg-[var(--surface-muted)]" />
    </div>
  );
}

function BalanceRow({ person, onTap }) {
  const [bg, fg] = getAvatarColors(person.displayName);
  const isNegative = person.balance < 0;

  return (
    <button
      type="button"
      onClick={() => onTap(person.id)}
      className="flex w-full items-center gap-3 rounded-[20px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 text-left shadow-[var(--shadow-soft)] transition active:scale-[0.98]"
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[14px] font-bold"
        style={{ backgroundColor: bg, color: fg }}
      >
        {person.displayName.slice(0, 1).toUpperCase()}
      </div>
      <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-[var(--text)]">
        {person.displayName}
      </span>
      <div className="flex shrink-0 items-center gap-1">
        <span
          className={`text-[15px] font-bold tabular-nums ${isNegative ? "text-[var(--danger)]" : "text-[var(--success)]"}`}
        >
          {isNegative ? "-" : "+"}${Math.abs(person.balance).toFixed(2)}
        </span>
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-[var(--text-soft)]" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 3l5 5-5 5" />
        </svg>
      </div>
    </button>
  );
}

function ActivityItem({ item, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-[18px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-left transition active:scale-[0.99]"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[var(--surface-accent)] text-[16px]">
        {item.icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold text-[var(--text)]">{item.title}</div>
        <div className="truncate text-[12px] text-[var(--text-muted)]">{item.meta}</div>
      </div>
      <div className="shrink-0 text-[11px] text-[var(--text-soft)]">{formatRelativeTime(item.createdAt)}</div>
    </button>
  );
}

export default function HomePage() {
  const router = useRouter();
  const reduceMotion = useLowPerformanceMode();
  const [user, setUser] = useState(null);
  const [profileName, setProfileName] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [turnRotations, setTurnRotations] = useState([]);
  const { people, isLoading } = usePersonBalances(user);
  const { items: activityItems } = useActivityFeed(user, 6);

  const netBalanceCents = useMemo(
    () => people.reduce((sum, p) => sum + Number(p.balanceCents || 0), 0),
    [people],
  );
  const netBalance = netBalanceCents / 100;

  const youOwe = useMemo(() => people.filter((p) => p.balance < 0).slice(0, 4), [people]);
  const owedToYou = useMemo(() => people.filter((p) => p.balance > 0).slice(0, 4), [people]);

  const totalOwe = useMemo(() => youOwe.reduce((sum, p) => sum + Math.abs(p.balance), 0), [youOwe]);
  const totalOwed = useMemo(() => owedToYou.reduce((sum, p) => sum + p.balance, 0), [owedToYou]);

  useEffect(() => {
    if (!supabase) {
      const t = setTimeout(() => setAuthReady(true), 0);
      return () => clearTimeout(t);
    }

    let isMounted = true;

    async function bootstrap() {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;

      const nextUser = data.session?.user || null;
      setUser(nextUser);

      if (nextUser) {
        supabase
          .from("profiles")
          .select("display_name")
          .eq("id", nextUser.id)
          .maybeSingle()
          .then(({ data: profile }) => {
            if (isMounted && profile?.display_name) setProfileName(profile.display_name);
          })
          .catch(() => {});

        loadUserTurnRotations(supabase, nextUser)
          .then((rotations) => { if (isMounted) setTurnRotations(rotations); })
          .catch(() => {});
      }

      if (isMounted) setAuthReady(true);
    }

    void bootstrap();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user || null;
      setUser(nextUser);
      if (!nextUser) setTurnRotations([]);
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    router.prefetch("/groups");
    router.prefetch("/activity");
    router.prefetch("/people");
    router.prefetch("/settings");
  }, [router]);

  const handlePersonTap = useCallback((personId) => router.push(`/people/${personId}`), [router]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 5) return "Up late";
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const displayName = profileName || getDisplayNameFromUser(user, "") || "there";
  const hasBalances = youOwe.length > 0 || owedToYou.length > 0;
  const recentActivity = activityItems.slice(0, 3);

  // Hero gradient based on net balance
  const heroGradient = netBalance > 0
    ? "linear-gradient(145deg, #1a2e22 0%, #2d4a35 40%, #1e3828 100%)"
    : netBalance < 0
      ? "linear-gradient(145deg, #2d1a1a 0%, #4a2424 40%, #381e1e 100%)"
      : "linear-gradient(145deg, #1a1f2e 0%, #242a40 40%, #1e2236 100%)";

  return (
    <motion.main
      className="min-h-screen max-w-[100vw] overflow-x-hidden bg-[var(--bg)]"
      initial={reduceMotion ? false : pageTransition.initial}
      animate={reduceMotion ? undefined : pageTransition.animate}
      transition={pageTransition.transition}
    >
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[color:var(--surface)]/94 px-5 py-3 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-[460px] items-center justify-between">
          <div
            className="text-[24px] font-semibold leading-none tracking-[-0.04em] text-[var(--accent-strong)]"
            style={{ fontFamily: "Tiempos Headline, Georgia, 'Times New Roman', serif" }}
          >
            Evenly
          </div>
          <button
            type="button"
            onClick={() => router.push("/settings")}
            aria-label="Settings"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)] transition active:scale-[0.98]"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.3 2.8h3.4l.6 2.2a7.8 7.8 0 0 1 1.8.8l2-1.2 2.4 2.4-1.2 2c.3.6.6 1.2.8 1.8l2.2.6v3.4l-2.2.6c-.2.6-.5 1.2-.8 1.8l1.2 2-2.4 2.4-2-1.2c-.6.3-1.2.6-1.8.8l-.6 2.2h-3.4l-.6-2.2a7.8 7.8 0 0 1-1.8-.8l-2 1.2-2.4-2.4 1.2-2a7.8 7.8 0 0 1-.8-1.8l-2.2-.6v-3.4l2.2-.6c.2-.6.5-1.2.8-1.8l-1.2-2 2.4-2.4 2 1.2c.6-.3 1.2-.6 1.8-.8l.6-2.2Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[460px] space-y-4 px-5 pt-5 pb-28">
        {!authReady || isLoading ? (
          <HomeSkeleton />
        ) : !user ? (
          <div className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] px-6 py-10 text-center shadow-[var(--shadow-soft)]">
            <div className="text-[20px] font-semibold text-[var(--text)]">Sign in to get started</div>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="mt-5 rounded-full bg-[var(--accent)] px-6 py-3 text-[15px] font-medium text-white"
            >
              Sign in
            </button>
          </div>
        ) : (
          <>
            {/* ── Hero card ── */}
            <section
              className="relative overflow-hidden rounded-[32px] px-6 pb-6 pt-7 shadow-[0_16px_48px_rgba(0,0,0,0.28)]"
              style={{ background: heroGradient }}
            >
              {/* Decorative blobs */}
              <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
              <div className="pointer-events-none absolute -bottom-10 -left-6 h-36 w-36 rounded-full bg-white/4 blur-2xl" />

              <div className="relative">
                <div className="text-[13px] font-semibold tracking-[0.06em] text-white/55">
                  {greeting}, {displayName}
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={netBalance > 0 ? "pos" : netBalance < 0 ? "neg" : "zero"}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.3 }}
                    className="mt-3 text-[56px] font-bold leading-none tracking-[-0.06em]"
                  >
                    <AnimatedBalance
                      value={netBalance}
                      isPositive={netBalance > 0}
                      isNegative={netBalance < 0}
                    />
                  </motion.div>
                </AnimatePresence>

                <div className="mt-2 text-[14px] font-medium text-white/55">
                  {netBalance > 0
                    ? "owed to you across all groups"
                    : netBalance < 0
                      ? "you owe across all groups"
                      : people.length > 0
                        ? "all settled up"
                        : "no active balances"}
                </div>

                {/* Inline owe/owed pills */}
                {hasBalances && (
                  <div className="mt-5 flex gap-2.5">
                    {totalOwed > 0 && (
                      <div className="flex flex-1 items-center gap-2 rounded-[14px] bg-white/10 px-3.5 py-2.5">
                        <div className="h-2 w-2 shrink-0 rounded-full bg-[#6ee7a0]" />
                        <div>
                          <div className="text-[13px] font-bold leading-none text-white">
                            +${totalOwed.toFixed(2)}
                          </div>
                          <div className="mt-0.5 text-[11px] text-white/50">owed to you</div>
                        </div>
                      </div>
                    )}
                    {totalOwe > 0 && (
                      <div className="flex flex-1 items-center gap-2 rounded-[14px] bg-white/10 px-3.5 py-2.5">
                        <div className="h-2 w-2 shrink-0 rounded-full bg-[#fca5a5]" />
                        <div>
                          <div className="text-[13px] font-bold leading-none text-white">
                            -${totalOwe.toFixed(2)}
                          </div>
                          <div className="mt-0.5 text-[11px] text-white/50">you owe</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Quick action buttons */}
                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => router.push("/groups")}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white/15 px-3 py-2.5 text-[13px] font-semibold text-white transition active:bg-white/25"
                  >
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M8 2v12M2 8h12" />
                    </svg>
                    Expense
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/people")}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white/15 px-3 py-2.5 text-[13px] font-semibold text-white transition active:bg-white/25"
                  >
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M13 13v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1" />
                      <circle cx="8" cy="5" r="2.5" />
                    </svg>
                    Settle up
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/activity")}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white/15 px-3 py-2.5 text-[13px] font-semibold text-white transition active:bg-white/25"
                  >
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M2 8h3l2-5 3 10 2-5h2" />
                    </svg>
                    Activity
                  </button>
                </div>
              </div>
            </section>

            {/* ── You owe ── */}
            {youOwe.length > 0 && (
              <section>
                <div className="mb-2.5 flex items-center justify-between">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    You owe
                  </div>
                  {youOwe.length >= 4 && (
                    <button type="button" onClick={() => router.push("/people")} className="text-[12px] font-semibold text-[var(--accent)]">
                      See all
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {youOwe.map((person) => (
                    <BalanceRow key={person.id} person={person} onTap={handlePersonTap} />
                  ))}
                </div>
              </section>
            )}

            {/* ── Owed to you ── */}
            {owedToYou.length > 0 && (
              <section>
                <div className="mb-2.5 flex items-center justify-between">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    Owed to you
                  </div>
                  {owedToYou.length >= 4 && (
                    <button type="button" onClick={() => router.push("/people")} className="text-[12px] font-semibold text-[var(--accent)]">
                      See all
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {owedToYou.map((person) => (
                    <BalanceRow key={person.id} person={person} onTap={handlePersonTap} />
                  ))}
                </div>
              </section>
            )}

            {/* ── All settled up ── */}
            {people.length > 0 && !hasBalances && (
              <section
                className="relative overflow-hidden rounded-[28px] px-6 py-8 text-center"
                style={{ background: "linear-gradient(145deg, #1a2e22 0%, #2d4a35 100%)" }}
              >
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
                <div className="relative">
                  <div className="text-[44px] leading-none">✓</div>
                  <div className="mt-3 text-[20px] font-bold tracking-[-0.03em] text-white">
                    All settled up
                  </div>
                  <div className="mt-1.5 text-[14px] text-white/60">
                    You&apos;re even with everyone right now.
                  </div>
                </div>
              </section>
            )}

            {/* ── Your turn rotations ── */}
            {turnRotations.length > 0 && (
              <section>
                <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Your turn
                </div>
                <div className="space-y-2">
                  {turnRotations.slice(0, 3).map((rotation) => (
                    <button
                      key={rotation.id}
                      type="button"
                      onClick={() => router.push(`/groups/${rotation.group_id}`)}
                      className="flex w-full items-center justify-between gap-3 rounded-[20px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 text-left shadow-[var(--shadow-soft)] transition active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-accent)] text-[16px]">
                          🔄
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-[15px] font-semibold text-[var(--text)]">
                            {rotation.name}
                          </div>
                          <div className="text-[12px] text-[var(--accent)]">It&apos;s your turn</div>
                        </div>
                      </div>
                      <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-[var(--text-soft)]" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M6 3l5 5-5 5" />
                      </svg>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* ── Recent activity ── */}
            {recentActivity.length > 0 && (
              <section>
                <div className="mb-2.5 flex items-center justify-between">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    Recent
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push("/activity")}
                    className="text-[12px] font-semibold text-[var(--accent)]"
                  >
                    See all
                  </button>
                </div>
                <div className="space-y-2">
                  {recentActivity.map((item) => (
                    <ActivityItem
                      key={item.id}
                      item={item}
                      onClick={() => item.groupId && router.push(`/groups/${item.groupId}`)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* ── Empty state ── */}
            {people.length === 0 && (
              <section
                className="relative overflow-hidden rounded-[32px] px-6 py-10 text-center shadow-[0_16px_48px_rgba(0,0,0,0.18)]"
                style={{ background: "linear-gradient(145deg, #1a1f2e 0%, #242a40 50%, #1e2236 100%)" }}
              >
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
                <div className="relative">
                  <div className="text-[52px] leading-none">✌️</div>
                  <div className="mt-4 text-[22px] font-bold tracking-[-0.03em] text-white">
                    Welcome to Evenly
                  </div>
                  <div className="mt-2 text-[14px] leading-6 text-white/60">
                    Create a group or join one to start splitting expenses fairly.
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push("/groups")}
                    className="mt-6 rounded-full bg-white/15 px-7 py-3 text-[15px] font-semibold text-white transition active:bg-white/25"
                  >
                    Get started
                  </button>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </motion.main>
  );
}
