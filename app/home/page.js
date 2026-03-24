"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import useLowPerformanceMode from "../../hooks/useLowPerformanceMode";
import usePersonBalances from "../../hooks/usePersonBalances";
import { loadUserTurnRotations } from "../../lib/groupData";
import { formatBalance, getDisplayNameFromUser } from "../../lib/utils";
import { pageTransition } from "../../lib/animations";
import { supabase } from "../../lib/supabase";

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.3 2.8h3.4l.6 2.2a7.8 7.8 0 0 1 1.8.8l2-1.2 2.4 2.4-1.2 2c.3.6.6 1.2.8 1.8l2.2.6v3.4l-2.2.6c-.2.6-.5 1.2-.8 1.8l1.2 2-2.4 2.4-2-1.2c-.6.3-1.2.6-1.8.8l-.6 2.2h-3.4l-.6-2.2a7.8 7.8 0 0 1-1.8-.8l-2 1.2-2.4-2.4 1.2-2a7.8 7.8 0 0 1-.8-1.8l-2.2-.6v-3.4l2.2-.6c.2-.6.5-1.2.8-1.8l-1.2-2 2.4-2.4 2 1.2c.6-.3 1.2-.6 1.8-.8l.6-2.2Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function HomeSkeleton() {
  return (
    <div className="space-y-4 px-5">
      <div className="h-40 animate-pulse rounded-[28px] border border-[var(--border)] bg-[var(--surface)]" />
      <div className="h-28 animate-pulse rounded-[28px] border border-[var(--border)] bg-[var(--surface-muted)]" />
      <div className="h-28 animate-pulse rounded-[28px] border border-[var(--border)] bg-[var(--surface-muted)]" />
    </div>
  );
}

function BalanceRow({ person, onTap }) {
  const absBalance = Math.abs(person.balance);
  const isNegative = person.balance < 0;

  return (
    <button
      type="button"
      onClick={() => onTap(person.id)}
      className="flex w-full items-center justify-between gap-3 rounded-[16px] bg-[var(--surface-muted)] px-4 py-3.5 text-left transition active:scale-[0.99] active:bg-[var(--border)]"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-accent)] text-[14px] font-semibold text-[var(--accent-strong)]">
          {person.displayName.slice(0, 1).toUpperCase()}
        </div>
        <span className="truncate text-[15px] font-medium text-[var(--text)]">{person.displayName}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-[16px] font-bold ${isNegative ? "text-[var(--danger)]" : "text-[var(--success)]"}`}>
          {formatBalance(absBalance)}
        </span>
        <span className="text-[var(--text-soft)]"><ArrowIcon /></span>
      </div>
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

  const netBalance = useMemo(
    () => people.reduce((sum, p) => sum + Number(p.balanceCents || 0), 0) / 100,
    [people],
  );

  const youOwe = useMemo(
    () => people.filter((p) => p.balance < 0).slice(0, 5),
    [people],
  );

  const owedToYou = useMemo(
    () => people.filter((p) => p.balance > 0).slice(0, 5),
    [people],
  );

  useEffect(() => {
    if (!supabase) {
      // No supabase — defer state update out of effect body
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
        const profile = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", nextUser.id)
          .maybeSingle();
        if (isMounted && profile.data?.display_name) {
          setProfileName(profile.data.display_name);
        }

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

  const handlePersonTap = useCallback(
    (personId) => router.push(`/people/${personId}`),
    [router],
  );

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const balanceContext = useMemo(() => {
    if (netBalance > 0) return "You're owed overall";
    if (netBalance < 0) return "You owe overall";
    return people.length > 0 ? "All settled up" : "No activity yet";
  }, [netBalance, people.length]);

  const displayName = profileName || getDisplayNameFromUser(user, "") || "there";

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
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)] transition hover:bg-[var(--surface-soft)] active:scale-[0.98]"
          >
            <SettingsIcon />
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[460px] px-5 pt-5 pb-28 space-y-4">
        {!authReady || isLoading ? (
          <HomeSkeleton />
        ) : !user ? (
          <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] px-6 py-8 text-center shadow-[var(--shadow-soft)]">
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
            {/* Balance hero */}
            <section className="rounded-[28px] border border-[var(--border)] bg-[linear-gradient(160deg,var(--surface)_0%,var(--surface-soft)_100%)] px-6 py-7 shadow-[var(--shadow-soft)]">
              <div className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                {greeting}, {displayName}
              </div>
              <div
                className={`mt-3 text-[52px] font-bold leading-none tracking-[-0.06em] ${
                  netBalance > 0
                    ? "text-[var(--success)]"
                    : netBalance < 0
                      ? "text-[var(--danger)]"
                      : "text-[var(--text)]"
                }`}
              >
                {netBalance === 0 ? "$0.00" : formatBalance(Math.abs(netBalance))}
              </div>
              <div className="mt-2 text-[15px] text-[var(--text-soft)]">{balanceContext}</div>
            </section>

            {/* You owe */}
            {youOwe.length > 0 && (
              <section>
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                  You owe
                </div>
                <div className="space-y-2">
                  {youOwe.map((person) => (
                    <BalanceRow key={person.id} person={person} onTap={handlePersonTap} />
                  ))}
                </div>
              </section>
            )}

            {/* Owed to you */}
            {owedToYou.length > 0 && (
              <section>
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                  Owed to you
                </div>
                <div className="space-y-2">
                  {owedToYou.map((person) => (
                    <BalanceRow key={person.id} person={person} onTap={handlePersonTap} />
                  ))}
                </div>
              </section>
            )}

            {/* All settled */}
            {people.length > 0 && youOwe.length === 0 && owedToYou.length === 0 && (
              <section className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] px-5 py-8 text-center shadow-[var(--shadow-soft)]">
                <div className="text-[36px]">✓</div>
                <div className="mt-3 text-[18px] font-semibold text-[var(--text)]">All settled up!</div>
                <div className="mt-1 text-[14px] text-[var(--text-muted)]">You&apos;re even with everyone.</div>
              </section>
            )}

            {/* Your turn rotations */}
            {turnRotations.length > 0 && (
              <section>
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                  Your turn
                </div>
                <div className="space-y-2">
                  {turnRotations.slice(0, 3).map((rotation) => (
                    <button
                      key={rotation.id}
                      type="button"
                      onClick={() => router.push(`/groups/${rotation.group_id}`)}
                      className="flex w-full items-center justify-between gap-3 rounded-[16px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 text-left transition hover:bg-[var(--surface-soft)] active:scale-[0.99]"
                    >
                      <div className="min-w-0">
                        <div className="text-[15px] font-semibold text-[var(--text)]">{rotation.name}</div>
                        <div className="mt-0.5 text-[13px] text-[var(--text-muted)]">It&apos;s your turn</div>
                      </div>
                      <span className="shrink-0 text-[var(--accent)]"><ArrowIcon /></span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Empty state */}
            {people.length === 0 && (
              <section className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] px-5 py-8 text-center shadow-[var(--shadow-soft)]">
                <div className="text-[36px]">👋</div>
                <div className="mt-3 text-[18px] font-semibold text-[var(--text)]">Welcome to Evenly</div>
                <div className="mt-2 text-[14px] leading-6 text-[var(--text-muted)]">
                  Create or join a group to start splitting expenses.
                </div>
                <button
                  type="button"
                  onClick={() => router.push("/groups")}
                  className="mt-5 rounded-full bg-[var(--accent)] px-6 py-3 text-[15px] font-medium text-white transition hover:opacity-90"
                >
                  Go to Groups
                </button>
              </section>
            )}
          </>
        )}
      </div>
    </motion.main>
  );
}
