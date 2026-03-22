"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import AddPersonModal from "../../components/AddPersonModal";
import PersonCard from "../../components/PersonCard";
import usePersonBalances from "../../hooks/usePersonBalances";
import { createContactRecord } from "../../lib/groupData";
import { supabase } from "../../lib/supabase";
import { pageTransition } from "../../lib/animations";

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function PeopleSkeleton() {
  return (
    <div className="space-y-3 px-6 pb-28">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="h-[184px] rounded-[16px] border border-[var(--border)] bg-[linear-gradient(90deg,var(--surface-muted)_0%,var(--border)_50%,var(--surface-muted)_100%)] bg-[length:200%_100%] animate-[shimmer_1.8s_linear_infinite]"
        />
      ))}
    </div>
  );
}

export default function PeoplePage() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [query, setQuery] = useState("");
  const [isAddPersonOpen, setIsAddPersonOpen] = useState(false);
  const { people, isLoading, error } = usePersonBalances(user);

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

  const filteredPeople = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return people;

    return people.filter((person) => {
      return (
        person.displayName.toLowerCase().includes(normalizedQuery) ||
        person.sharedGroups.some((group) => group.name.toLowerCase().includes(normalizedQuery))
      );
    });
  }, [people, query]);

  return (
    <motion.main
      className="min-h-screen bg-[var(--bg)]"
      initial={reduceMotion ? false : pageTransition.initial}
      animate={reduceMotion ? undefined : pageTransition.animate}
      transition={pageTransition.transition}
    >
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[color:var(--surface)]/95 px-6 pt-5 pb-4 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-[460px]">
          <h1 className="text-[32px] font-bold tracking-[-0.05em] text-[var(--text)]">People</h1>
          <p className="mt-1 text-[14px] text-[var(--text-muted)]">Track who you split with</p>

          <div className="mt-4 flex h-11 items-center rounded-[12px] border border-[var(--border)] bg-[var(--surface-muted)] px-4">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search people..."
              className="w-full bg-transparent text-[15px] text-[var(--text)] outline-none placeholder:text-[var(--text-soft)]"
            />
            <div className="text-[var(--text-soft)]">
              <SearchIcon />
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[460px] pt-4 pb-28">
        {isLoading || !authReady ? <PeopleSkeleton /> : null}

        {!isLoading && authReady && !user ? (
          <div className="px-6">
            <div className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)] px-5 py-6">
              <div className="text-[20px] font-semibold tracking-[-0.03em] text-[var(--text)]">Sign in first</div>
              <p className="mt-2 text-[14px] leading-6 text-[var(--text-muted)]">
                Jump back to the welcome screen, sign in, and your people ledger will appear here.
              </p>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="mt-5 rounded-full bg-[var(--accent)] px-5 py-3 text-[15px] font-medium text-white transition hover:opacity-90"
              >
                Go to welcome
              </button>
            </div>
          </div>
        ) : null}

        {!isLoading && authReady && user && error ? (
          <div className="px-6">
            <div className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)] px-5 py-4 text-[14px] font-medium text-[var(--danger)]">
              {error}
            </div>
          </div>
        ) : null}

        {!isLoading && authReady && user && !error && !filteredPeople.length ? (
          <div className="px-6">
            <div className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)] px-5 py-8 text-center">
              <div className="text-[44px]">👥</div>
              <div className="mt-3 text-[20px] font-semibold tracking-[-0.03em] text-[var(--text)]">
                No people yet
              </div>
              <p className="mt-2 text-[14px] leading-6 text-[var(--text-muted)]">
                Add expenses inside your groups and the people you split with will show up here automatically.
              </p>
              <button
                type="button"
                onClick={() => router.push("/groups")}
                className="mt-5 rounded-full bg-[var(--surface-accent)] px-5 py-3 text-[15px] font-medium text-[var(--accent-strong)] transition hover:bg-[var(--accent-soft-hover)]"
              >
                Go to groups
              </button>
            </div>
          </div>
        ) : null}

        {!isLoading && authReady && user && !error && filteredPeople.length ? (
          <div className="space-y-3 px-6">
            {filteredPeople.map((person, index) => (
              <PersonCard
                key={person.id}
                person={person}
                index={index}
                onOpen={() => router.push(`/people/${person.id}`)}
              />
            ))}
          </div>
        ) : null}
      </div>

      {user ? (
        <button
          type="button"
          onClick={() => setIsAddPersonOpen(true)}
          className="fixed right-6 bottom-[92px] z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)] text-[28px] text-white shadow-[0_4px_12px_rgba(95,125,106,0.3)] transition hover:opacity-90 active:scale-[0.97]"
          aria-label="Add person"
        >
          +
        </button>
      ) : null}

      <AddPersonModal
        isOpen={isAddPersonOpen}
        onClose={() => setIsAddPersonOpen(false)}
        onCreate={async (payload) => {
          try {
            await createContactRecord(supabase, user, payload);
            window.location.reload();
            return { ok: true };
          } catch (createError) {
            console.error(createError);
            return {
              ok: false,
              message: createError.message || "Could not add that person.",
            };
          }
        }}
      />
    </motion.main>
  );
}
