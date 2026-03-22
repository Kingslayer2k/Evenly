"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import PersonDetail from "./PersonDetail";
import useActivityFeed from "../hooks/useActivityFeed";
import usePersonBalances from "../hooks/usePersonBalances";
import { pageTransition } from "../lib/animations";
import { supabase } from "../lib/supabase";

export default function PersonDetailPage({ personId }) {
  const reduceMotion = useReducedMotion();
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const { people, isLoading } = usePersonBalances(user);
  const activityFeed = useActivityFeed(user, 30);

  const person = useMemo(
    () => people.find((entry) => entry.id === personId) || null,
    [people, personId],
  );

  const personActivity = useMemo(
    () => activityFeed.items.filter((item) => item.relatedUserIds?.includes(personId)),
    [activityFeed.items, personId],
  );

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

  if (!authReady || isLoading) {
    return (
      <motion.main
        className="min-h-screen bg-[var(--bg)] px-6 pt-6"
        initial={reduceMotion ? false : pageTransition.initial}
        animate={reduceMotion ? undefined : pageTransition.animate}
        transition={pageTransition.transition}
      >
        <div className="mx-auto max-w-[460px] space-y-4">
          <div className="h-44 animate-pulse rounded-[24px] border border-[var(--border)] bg-[var(--surface)]" />
          <div className="h-36 animate-pulse rounded-[24px] border border-[var(--border)] bg-[var(--surface)]" />
        </div>
      </motion.main>
    );
  }

  if (!person) {
    return (
      <motion.main
        className="min-h-screen bg-[var(--bg)] px-6 pt-6"
        initial={reduceMotion ? false : pageTransition.initial}
        animate={reduceMotion ? undefined : pageTransition.animate}
        transition={pageTransition.transition}
      >
        <div className="mx-auto max-w-[460px] rounded-[24px] border border-[var(--border)] bg-[var(--surface)] px-5 py-6 text-[15px] text-[var(--text-muted)] shadow-[var(--shadow-soft)]">
          Couldn&apos;t find that person yet.
        </div>
      </motion.main>
    );
  }

  return <PersonDetail person={person} activityItems={personActivity} />;
}
