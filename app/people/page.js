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

/*
visual thesis: editorial contact ledger with calm white space, sharp type, and relationship cards that feel precise rather than dashboard-y.
content plan: header orientation, searchable people list, balance-first cards, then an empty state that points back to the shared-group workflow.
interaction thesis: page slides in gently, people cards reveal with short stagger, and balance figures count up to make scanning feel alive without breaking restraint.
*/

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
          className="h-[184px] rounded-[16px] border border-[#E5E7EB] bg-[linear-gradient(90deg,#F3F4F6_0%,#E5E7EB_50%,#F3F4F6_100%)] bg-[length:200%_100%] animate-[shimmer_1.8s_linear_infinite]"
        />
      ))}
    </div>
  );
}

export default function PeoplePage() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [user, setUser] = useState(null);
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
    }

    void bootstrapAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
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
      className="min-h-screen bg-[#F7F7F5]"
      initial={reduceMotion ? false : pageTransition.initial}
      animate={reduceMotion ? undefined : pageTransition.animate}
      transition={pageTransition.transition}
    >
      <header className="sticky top-0 z-20 border-b border-[#E5E7EB] bg-white/95 px-6 pt-5 pb-4 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-[460px]">
          <h1 className="text-[32px] font-bold tracking-[-0.05em] text-[#1C1917]">People</h1>
          <p className="mt-1 text-[14px] text-[#6B7280]">Track who you split with</p>

          <div className="mt-4 flex h-11 items-center rounded-[12px] border border-[#E5E7EB] bg-[#F9FAFB] px-4">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search people..."
              className="w-full bg-transparent text-[15px] text-[#1C1917] outline-none placeholder:text-[#9CA3AF]"
            />
            <div className="text-[#9CA3AF]">
              <SearchIcon />
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[460px] pt-4 pb-28">
        {isLoading ? <PeopleSkeleton /> : null}

        {!isLoading && !user ? (
          <div className="px-6">
            <div className="rounded-[20px] border border-[#E5E7EB] bg-white px-5 py-6">
              <div className="text-[20px] font-semibold tracking-[-0.03em] text-[#1C1917]">Sign in first</div>
              <p className="mt-2 text-[14px] leading-6 text-[#6B7280]">
                Jump back to the welcome screen, sign in, and your people ledger will appear here.
              </p>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="mt-5 rounded-full bg-[#5F7D6A] px-5 py-3 text-[15px] font-medium text-white transition hover:bg-[#3A4E43]"
              >
                Go to welcome
              </button>
            </div>
          </div>
        ) : null}

        {!isLoading && user && error ? (
          <div className="px-6">
            <div className="rounded-[20px] border border-[#E5E7EB] bg-white px-5 py-4 text-[14px] font-medium text-[#DC2626]">
              {error}
            </div>
          </div>
        ) : null}

        {!isLoading && user && !error && !filteredPeople.length ? (
          <div className="px-6">
            <div className="rounded-[20px] border border-[#E5E7EB] bg-white px-5 py-8 text-center">
              <div className="text-[44px]">👥</div>
              <div className="mt-3 text-[20px] font-semibold tracking-[-0.03em] text-[#1C1917]">
                No people yet
              </div>
              <p className="mt-2 text-[14px] leading-6 text-[#6B7280]">
                Add expenses inside your groups and the people you split with will show up here automatically.
              </p>
              <button
                type="button"
                onClick={() => router.push("/groups")}
                className="mt-5 rounded-full bg-[#E1F9D8] px-5 py-3 text-[15px] font-medium text-[#3A4E43] transition hover:bg-[#CFEEC1]"
              >
                Go to groups
              </button>
            </div>
          </div>
        ) : null}

        {!isLoading && user && !error && filteredPeople.length ? (
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
          className="fixed right-6 bottom-[92px] z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#5F7D6A] text-[28px] text-white shadow-[0_4px_12px_rgba(95,125,106,0.3)] transition hover:bg-[#3A4E43] active:scale-[0.97]"
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
