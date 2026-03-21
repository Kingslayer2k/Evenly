"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import ActivityFeed from "../../components/ActivityFeed";
import MeStats from "../../components/MeStats";
import ProfileSettings from "../../components/ProfileSettings";
import useActivityFeed from "../../hooks/useActivityFeed";
import useNetPosition from "../../hooks/useNetPosition";
import { pageTransition } from "../../lib/animations";
import { supabase } from "../../lib/supabase";

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v3" />
      <path d="M12 18v3" />
      <path d="M3 12h3" />
      <path d="M18 12h3" />
      <path d="m5.6 5.6 2.1 2.1" />
      <path d="m16.3 16.3 2.1 2.1" />
      <path d="m18.4 5.6-2.1 2.1" />
      <path d="m7.7 16.3-2.1 2.1" />
      <circle cx="12" cy="12" r="3.5" />
    </svg>
  );
}

function formatCurrency(value) {
  const amount = Number(value || 0);
  const prefix = amount > 0 ? "+" : amount < 0 ? "-" : "";
  return `${prefix}$${Math.abs(amount).toFixed(2)}`;
}

function CountUpCurrency({ value }) {
  const reduceMotion = useReducedMotion();
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
  const reduceMotion = useReducedMotion();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(defaultStats());
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const { netPosition, peopleCount } = useNetPosition(user);
  const activityFeed = useActivityFeed(user, 8);

  const loadStats = useCallback(async (currentUser) => {
    if (!supabase || !currentUser) {
      setStats(defaultStats());
      return;
    }

    const membershipsResponse = await supabase
      .from("group_members")
      .select("*")
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
      supabase.from("group_members").select("*").in("group_id", groupIds),
      supabase
        .from("expenses")
        .select("*")
        .in("group_id", groupIds)
        .gte("created_at", startOfMonth.toISOString()),
      supabase.from("profiles").select("*").eq("user_id", currentUser.id).maybeSingle(),
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

    setStats({
      groupCount: groupIds.length,
      totalSpent,
      peopleCount: uniquePeople.size || peopleCount,
      expenseCount: (expensesResponse.data || []).length,
    });
  }, [peopleCount]);

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
      { label: "Profile", action: () => setIsProfileOpen(true) },
      { label: "Notifications", action: () => {} },
      { label: "Payment Methods", action: () => setIsProfileOpen(true) },
      { label: "Privacy & Security", action: () => {} },
      { label: "Help & Support", action: () => {} },
      { label: "About Evenly", action: () => {} },
    ],
    [],
  );

  return (
    <motion.main
      className="min-h-screen bg-[#F7F7F5] pb-28"
      initial={reduceMotion ? false : pageTransition.initial}
      animate={reduceMotion ? undefined : pageTransition.animate}
      transition={pageTransition.transition}
    >
      <div className="mx-auto w-full max-w-[460px] px-6 pt-6">
        <section className="rounded-[28px] bg-[linear-gradient(180deg,#F7F7F5_0%,#FFFFFF_100%)] px-6 py-6">
          <div className="flex items-start justify-between">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#E1F9D8] text-[22px] font-semibold text-[#3A4E43]">
              {(profile?.display_name || user?.email || "E").slice(0, 1).toUpperCase()}
            </div>
            <button
              type="button"
              onClick={() => setIsProfileOpen(true)}
              className="text-[#6B7280] transition hover:text-[#1C1917]"
              aria-label="Open settings"
            >
              <SettingsIcon />
            </button>
          </div>

          <div className="mt-4 text-[28px] font-bold tracking-[-0.04em] text-[#1C1917]">
            {profile?.display_name || user?.user_metadata?.display_name || user?.email?.split("@")[0] || "You"}
          </div>
          <div className="mt-1 text-[15px] text-[#6B7280]">
            @{profile?.username || user?.email?.split("@")[0] || "evenly"}
          </div>

          <div className={`mt-6 text-[56px] leading-none font-bold tracking-[-0.06em] ${netPosition > 0 ? "text-[#10B981]" : netPosition < 0 ? "text-[#DC2626]" : "text-[#6B7280]"}`}>
            <CountUpCurrency value={netPosition} />
          </div>
          <div className="mt-2 text-[14px] font-medium text-[#6B7280]">net across all groups</div>
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

        <section className="mt-4 rounded-[16px] border border-[#E5E7EB] bg-white">
          {settingsRows.map((row) => (
            <button
              key={row.label}
              type="button"
              onClick={row.action}
              className="flex h-[52px] w-full items-center justify-between border-b border-[#F3F4F6] px-5 text-left last:border-b-0 hover:bg-[#F9FAFB]"
            >
              <span className="text-[16px] font-medium text-[#1C1917]">{row.label}</span>
              <span className="text-[#9CA3AF]">&gt;</span>
            </button>
          ))}

          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              router.replace("/");
            }}
            className="mt-2 flex h-[52px] w-full items-center px-5 text-left text-[16px] font-medium text-[#DC2626] hover:bg-[#F9FAFB]"
          >
            Log out
          </button>
        </section>
      </div>

      {isProfileOpen ? (
        <ProfileSettings
          isOpen={isProfileOpen}
          user={user}
          initialProfile={profile}
          onClose={() => setIsProfileOpen(false)}
          onSaved={(nextProfile) => {
            setProfile((previous) => ({ ...(previous || {}), ...nextProfile }));
          }}
        />
      ) : null}
    </motion.main>
  );
}
