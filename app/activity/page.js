"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import useActivityFeed from "../../hooks/useActivityFeed";
import useLowPerformanceMode from "../../hooks/useLowPerformanceMode";
import { pageTransition } from "../../lib/animations";
import { supabase } from "../../lib/supabase";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "expense", label: "Expenses" },
  { id: "settlement", label: "Settled" },
  { id: "yours", label: "Yours" },
];

function bucketActivityDate(value) {
  if (!value) return "Earlier";

  const now = new Date();
  const current = new Date(value);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfCurrent = new Date(current.getFullYear(), current.getMonth(), current.getDate());
  const diffDays = Math.round((startOfToday.getTime() - startOfCurrent.getTime()) / 86400000);

  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return "This week";
  return "Earlier";
}

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

function FilterPill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-10 shrink-0 rounded-full px-4 text-[13px] font-semibold whitespace-nowrap transition active:scale-[0.97] ${
        active
          ? "bg-[var(--accent)] text-white"
          : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)]"
      }`}
    >
      {children}
    </button>
  );
}

export default function ActivityPage() {
  const router = useRouter();
  const reduceMotion = useLowPerformanceMode();
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const { items, isLoading, error } = useActivityFeed(user, 40);

  useEffect(() => {
    if (!supabase) return;

    let isMounted = true;

    async function bootstrapAuth() {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;
      setUser(data.session?.user || null);
      setAuthReady(true);
    }

    void bootstrapAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      setAuthReady(true);
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    router.prefetch("/groups");
    router.prefetch("/people");
    router.prefetch("/settings");
  }, [router]);

  const filteredItems = useMemo(() => {
    return (items || []).filter((item) => {
      if (activeFilter === "all") return true;
      if (activeFilter === "yours") return item.title?.startsWith("You ");
      return item.type === activeFilter;
    });
  }, [activeFilter, items]);

  const groupedItems = useMemo(() => {
    const sections = new Map();

    for (const item of filteredItems) {
      const bucket = bucketActivityDate(item.createdAt);
      if (!sections.has(bucket)) {
        sections.set(bucket, []);
      }
      sections.get(bucket).push(item);
    }

    return Array.from(sections.entries());
  }, [filteredItems]);

  return (
    <motion.main
      className="min-h-screen max-w-[100vw] overflow-x-hidden bg-[var(--bg)] pb-28"
      initial={reduceMotion ? false : pageTransition.initial}
      animate={reduceMotion ? undefined : pageTransition.animate}
      transition={pageTransition.transition}
    >
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[color:var(--surface)]/94 px-6 pt-5 pb-4 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-[460px]">
          <div className="text-[28px] font-bold tracking-[-0.05em] text-[var(--text)]">Activity</div>
          <p className="mt-1 text-[14px] text-[var(--text-muted)]">
            A shared timeline across trips, homes, and every balance shift.
          </p>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [-webkit-overflow-scrolling:touch]">
            {FILTERS.map((filter) => (
              <FilterPill
                key={filter.id}
                active={activeFilter === filter.id}
                onClick={() => setActiveFilter(filter.id)}
              >
                {filter.label}
              </FilterPill>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[460px] px-6 pt-5">
        {!authReady || isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="h-[92px] rounded-[18px] border border-[var(--border)] bg-[linear-gradient(90deg,var(--surface-muted)_0%,var(--border)_50%,var(--surface-muted)_100%)] bg-[length:200%_100%] animate-[shimmer_1.8s_linear_infinite]"
              />
            ))}
          </div>
        ) : null}

        {authReady && !user ? (
          <section className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] px-5 py-6">
            <div className="text-[20px] font-semibold tracking-[-0.03em] text-[var(--text)]">
              Sign in to see activity
            </div>
            <p className="mt-2 text-[14px] leading-6 text-[var(--text-muted)]">
              Your shared timeline appears here once you’re signed in and splitting with a group.
            </p>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="mt-5 min-h-11 rounded-full bg-[var(--accent)] px-5 text-[15px] font-semibold text-white"
            >
              Go to welcome
            </button>
          </section>
        ) : null}

        {authReady && user && error ? (
          <div className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-[14px] font-medium text-[var(--danger)]">
            {error}
          </div>
        ) : null}

        {authReady && user && !error && !isLoading && !filteredItems.length ? (
          <section className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] px-5 py-8 text-center">
            <div className="text-[42px]">⏱️</div>
            <div className="mt-3 text-[20px] font-semibold tracking-[-0.03em] text-[var(--text)]">
              No activity yet
            </div>
            <p className="mt-2 text-[14px] leading-6 text-[var(--text-muted)]">
              Add a few expenses or settlements and this feed will start telling the story.
            </p>
          </section>
        ) : null}

        {authReady && user && !error && !isLoading && filteredItems.length ? (
          <div className="space-y-6">
            {groupedItems.map(([section, sectionItems]) => (
              <section key={section}>
                <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  {section}
                </div>
                <div className="mt-3 space-y-3">
                  {sectionItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => item.groupId && router.push(`/groups/${item.groupId}`)}
                      className="w-full rounded-[20px] border border-[var(--border)] bg-[var(--surface)] px-4 py-4 shadow-[var(--shadow-soft)] text-left transition active:scale-[0.99] active:bg-[var(--surface-muted)]"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[var(--surface-accent)] text-[18px]">
                          {item.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[15px] font-semibold text-[var(--text)]">{item.title}</div>
                          <div className="mt-1 text-[13px] leading-5 text-[var(--text-muted)]">
                            {item.meta}
                          </div>
                        </div>
                        <div className="shrink-0 text-[12px] font-medium text-[var(--text-soft)]">
                          {formatRelativeTime(item.createdAt)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : null}
      </div>
    </motion.main>
  );
}
