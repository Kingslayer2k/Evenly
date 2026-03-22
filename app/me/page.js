"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import ActivityFeed from "../../components/ActivityFeed";
import MeStats from "../../components/MeStats";
import useActivityFeed from "../../hooks/useActivityFeed";
import useLowPerformanceMode from "../../hooks/useLowPerformanceMode";
import useNetPosition from "../../hooks/useNetPosition";
import useTheme from "../../hooks/useTheme";
import { pageTransition } from "../../lib/animations";
import { readRuntimeCache, writeRuntimeCache } from "../../lib/runtimeCache";
import { supabase } from "../../lib/supabase";

function ThemeIcon({ isDark }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
      {isDark ? (
        <>
          <path d="M12 3v2.5" />
          <path d="M12 18.5V21" />
          <path d="M3 12h2.5" />
          <path d="M18.5 12H21" />
          <path d="m5.6 5.6 1.8 1.8" />
          <path d="m16.6 16.6 1.8 1.8" />
          <path d="m18.4 5.6-1.8 1.8" />
          <path d="m7.4 16.6-1.8 1.8" />
          <circle cx="12" cy="12" r="4" />
        </>
      ) : (
        <path d="M20 15.2A7.5 7.5 0 1 1 8.8 4a6.4 6.4 0 0 0 11.2 11.2Z" />
      )}
    </svg>
  );
}

function formatCurrency(value) {
  const amount = Number(value || 0);
  const prefix = amount > 0 ? "+" : amount < 0 ? "-" : "";
  return `${prefix}$${Math.abs(amount).toFixed(2)}`;
}

function CountUpCurrency({ value }) {
  const reduceMotion = useLowPerformanceMode();
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;

    const startedAt = performance.now();
    const duration = 1000;
    let frameId = 0;

    function tick(now) {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setDisplayValue(value * eased);

      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick);
      }
    }

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [reduceMotion, value]);

  return <span>{formatCurrency(reduceMotion ? value : displayValue)}</span>;
}

function defaultStats() {
  return {
    groupCount: 0,
    totalSpent: 0,
    peopleCount: 0,
    expenseCount: 0,
  };
}

export default function MePage() {
  const router = useRouter();
  const reduceMotion = useLowPerformanceMode();
  const { isDark, toggleTheme } = useTheme();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(defaultStats());
  const { netPosition, peopleCount } = useNetPosition(user);
  const activityFeed = useActivityFeed(user, 8);

  const loadStats = useCallback(async (currentUser) => {
    if (!supabase || !currentUser) {
      setStats(defaultStats());
      return;
    }

    const cacheKey = `me-stats:${currentUser.id}`;
    const cachedStats = readRuntimeCache(cacheKey, 20000);
    if (cachedStats) {
      setStats(cachedStats);
    }

    const membershipsResponse = await supabase
      .from("group_members")
      .select("id, group_id")
      .eq("user_id", currentUser.id);

    if (membershipsResponse.error) {
      console.error(membershipsResponse.error);
      return;
    }

    const memberships = membershipsResponse.data || [];
    const groupIds = [...new Set(memberships.map((membership) => membership.group_id).filter(Boolean))];

    if (!groupIds.length) {
      setStats(defaultStats());
      return;
    }

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [membersResponse, expensesResponse, profileResponse] = await Promise.all([
      supabase.from("group_members").select("id, user_id").in("group_id", groupIds),
      supabase
        .from("expenses")
        .select("group_id, participants, amount_cents, round_up_cents, created_at")
        .in("group_id", groupIds)
        .gte("created_at", startOfMonth.toISOString()),
      supabase.from("profiles").select("display_name, username").eq("user_id", currentUser.id).maybeSingle(),
    ]);

    if (membersResponse.error) {
      console.error(membersResponse.error);
      return;
    }
    if (expensesResponse.error) {
      console.error(expensesResponse.error);
      return;
    }

    setProfile(profileResponse.data || null);

    const membershipsByGroup = new Map(memberships.map((membership) => [membership.group_id, membership.id]));
    const memberById = new Map((membersResponse.data || []).map((member) => [member.id, member]));
    const uniquePeople = new Set();

    let totalSpent = 0;

    for (const expense of expensesResponse.data || []) {
      const membershipId = membershipsByGroup.get(expense.group_id);
      const participantIds = Array.isArray(expense.participants) ? expense.participants : [];

      for (const participantId of participantIds) {
        const participant = memberById.get(participantId);
        if (participant?.user_id && participant.user_id !== currentUser.id) {
          uniquePeople.add(participant.user_id);
        }
      }

      if (participantIds.includes(membershipId)) {
        const total = Number(expense.amount_cents || 0) + Number(expense.round_up_cents || 0);
        totalSpent += participantIds.length ? total / participantIds.length / 100 : 0;
      }
    }

    const nextStats = {
      groupCount: groupIds.length,
      totalSpent,
      peopleCount: uniquePeople.size || peopleCount,
      expenseCount: (expensesResponse.data || []).length,
    };

    writeRuntimeCache(cacheKey, nextStats);
    setStats(nextStats);
  }, [peopleCount]);

  useEffect(() => {
    router.prefetch("/groups");
    router.prefetch("/people");
  }, [router]);

  useEffect(() => {
    if (!supabase) return;

    let isMounted = true;

    async function bootstrapAuth() {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;
      const nextUser = data.session?.user || null;
      setUser(nextUser);
      if (nextUser) {
        await loadStats(nextUser);
      }
    }

    void bootstrapAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user || null;
      setUser(nextUser);
      if (nextUser) {
        void loadStats(nextUser);
      }
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [loadStats]);

  const settingsRows = useMemo(
    () => [
      { label: "Notifications", action: () => {} },
      { label: "Help & Support", action: () => {} },
      { label: "About Evenly", action: () => {} },
    ],
    [],
  );

  const handleLogout = useCallback(async () => {
    await supabase?.auth.signOut();
    router.replace("/");
  }, [router]);

  return (
    <motion.main
      className="min-h-screen max-w-[100vw] overflow-x-hidden bg-[var(--bg)] pb-28"
      initial={reduceMotion ? false : pageTransition.initial}
      animate={reduceMotion ? undefined : pageTransition.animate}
      transition={pageTransition.transition}
    >
      <div className="mx-auto w-full max-w-[460px] px-6 pt-6">
        <section className="rounded-[28px] border border-[var(--border)] bg-[linear-gradient(180deg,var(--bg)_0%,var(--surface)_100%)] px-6 py-6">
          <div className="flex items-start justify-between">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface-accent)] text-[22px] font-semibold text-[var(--accent-strong)]">
              {(profile?.display_name || user?.email || "E").slice(0, 1).toUpperCase()}
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className="text-[var(--text-muted)] transition hover:text-[var(--text)]"
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              <ThemeIcon isDark={isDark} />
            </button>
          </div>

          <div className="mt-4 text-[28px] font-bold tracking-[-0.04em] text-[var(--text)]">
            {profile?.display_name || user?.user_metadata?.display_name || user?.email?.split("@")[0] || "You"}
          </div>
          <div className="mt-1 text-[15px] text-[var(--text-muted)]">
            @{profile?.username || user?.email?.split("@")[0] || "evenly"}
          </div>

          <div
            className={`mt-6 text-[56px] leading-none font-bold tracking-[-0.06em] ${
              netPosition > 0 ? "text-[var(--success)]" : netPosition < 0 ? "text-[var(--danger)]" : "text-[var(--text-muted)]"
            }`}
          >
            <CountUpCurrency value={netPosition} />
          </div>
          <div className="mt-2 text-[14px] font-medium text-[var(--text-muted)]">net across all groups</div>
        </section>

        <div className="mt-4">
          <MeStats stats={stats} />
        </div>

        <div className="mt-4">
          <ActivityFeed
            title="Recent activity"
            items={activityFeed.items}
            emptyTitle="No activity yet"
            emptyCopy="Your expenses and settlements will start building a timeline here."
          />
        </div>

        <section className="mt-4 rounded-[16px] border border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-5 py-4">
            <div>
              <div className="text-[16px] font-medium text-[var(--text)]">Dark mode</div>
              <div className="mt-1 text-[13px] text-[var(--text-muted)]">
                {isDark ? "On for calmer nighttime testing" : "Currently using light mode"}
              </div>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className={`relative h-8 w-14 rounded-full transition ${isDark ? "bg-[var(--accent)]" : "bg-[var(--surface-muted)]"}`}
              aria-label={isDark ? "Disable dark mode" : "Enable dark mode"}
            >
              <span className={`absolute top-1 h-6 w-6 rounded-full bg-white transition ${isDark ? "left-7" : "left-1"}`} />
            </button>
          </div>

          {settingsRows.map((row) => (
            <button
              key={row.label}
              type="button"
              onClick={row.action}
              className="flex h-[52px] w-full items-center justify-between border-b border-[var(--border-soft)] px-5 text-left last:border-b-0 hover:bg-[var(--surface-muted)]"
            >
              <span className="text-[16px] font-medium text-[var(--text)]">{row.label}</span>
              <span className="text-[var(--text-soft)]">&gt;</span>
            </button>
          ))}

          <button
            type="button"
            onClick={handleLogout}
            className="mt-2 flex h-[52px] w-full items-center px-5 text-left text-[16px] font-medium text-[var(--danger)] hover:bg-[var(--surface-muted)]"
          >
            Log out
          </button>
        </section>
      </div>
    </motion.main>
  );
}
