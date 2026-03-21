"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import PersonDetail from "../../../components/PersonDetail";
import useActivityFeed from "../../../hooks/useActivityFeed";
import usePersonBalances from "../../../hooks/usePersonBalances";

export default function PersonDetailPage({ params }) {
  const [user, setUser] = useState(null);
  const { people, isLoading } = usePersonBalances(user);
  const activityFeed = useActivityFeed(user, 30);
  const person = useMemo(() => people.find((entry) => entry.id === params.id) || null, [params.id, people]);
  const personActivity = useMemo(
    () => activityFeed.items.filter((item) => item.relatedUserIds?.includes(params.id)),
    [activityFeed.items, params.id],
  );

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

  return (
    isLoading ? (
      <main className="min-h-screen bg-[#F7F7F5] px-6 pt-6">
        <div className="mx-auto max-w-[460px] space-y-4">
          <div className="h-44 rounded-[24px] bg-white animate-pulse" />
          <div className="h-36 rounded-[24px] bg-white animate-pulse" />
        </div>
      </main>
    ) : person ? (
      <PersonDetail person={person} activityItems={personActivity} />
    ) : (
      <main className="min-h-screen bg-[#F7F7F5] px-6 pt-6">
        <div className="mx-auto max-w-[460px] rounded-[24px] bg-white px-5 py-6 text-[15px] text-[#6B7280] shadow-[0_8px_20px_rgba(28,25,23,0.04)]">
          Couldn&apos;t find that person yet.
        </div>
      </main>
    )
  );
}
