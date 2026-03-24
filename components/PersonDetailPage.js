"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "framer-motion";
import PersonDetail from "./PersonDetail";
import useActivityFeed from "../hooks/useActivityFeed";
import usePersonBalances from "../hooks/usePersonBalances";
import { createNetSettlement } from "../lib/groupData";
import { pageTransition } from "../lib/animations";
import { supabase } from "../lib/supabase";

const PaymentModal = dynamic(() => import("./PaymentModal"), { loading: () => null });

export default function PersonDetailPage({ personId }) {
  const reduceMotion = useReducedMotion();
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
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

  // "pay" if current user owes the person, "request" if person owes current user
  const paymentDirection = person?.balance < 0 ? "pay" : "request";

  const settlementItem = useMemo(() => {
    if (!person || !user) return null;
    const absBalance = Math.abs(person.balanceCents || 0);
    return {
      amount: absBalance / 100,
      cents: absBalance,
      toName: paymentDirection === "pay" ? person.displayName : "you",
      fromName: paymentDirection === "pay" ? "you" : person.displayName,
      toUserId: paymentDirection === "pay" ? person.id : user.id,
      fromUserId: paymentDirection === "pay" ? user.id : person.id,
    };
  }, [person, user, paymentDirection]);

  const counterparty = useMemo(() => {
    if (!person) return null;
    return {
      display_name: person.displayName,
      venmo_username: person.venmoUsername || "",
      cash_app_tag: person.cashTag || "",
      phone: person.phone || "",
    };
  }, [person]);

  // Build per-group records that will zero out each group's A↔B balance
  const buildGroupSettlements = useCallback(() => {
    if (!person || !user) return [];
    return (person.groupBreakdowns || []).map((breakdown) => {
      const weOweThemInGroup = breakdown.balanceCents < 0;
      return {
        groupId: breakdown.groupId,
        fromUserId: weOweThemInGroup ? user.id : person.id,
        toUserId: weOweThemInGroup ? person.id : user.id,
        amountCents: Math.abs(breakdown.balanceCents),
      };
    });
  }, [person, user]);

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

  const handleSettleUp = useCallback(() => {
    setIsPaymentOpen(true);
  }, []);

  const handleClosePayment = useCallback(() => {
    setIsPaymentOpen(false);
  }, []);

  const handleConfirmSettlement = useCallback(
    async ({ method }) => {
      if (!supabase || !user || !person) return;
      setIsSettling(true);
      try {
        const groupSettlements = buildGroupSettlements();
        if (groupSettlements.length > 0) {
          await createNetSettlement(supabase, groupSettlements, method || "other");
        }
        setIsPaymentOpen(false);
      } catch (err) {
        console.error("Net settlement failed:", err);
      } finally {
        setIsSettling(false);
      }
    },
    [user, person, buildGroupSettlements],
  );

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

  const sharedGroupName =
    person.sharedGroups.length === 1
      ? person.sharedGroups[0].name
      : `${person.sharedGroups.length} groups`;

  return (
    <>
      <PersonDetail
        person={person}
        activityItems={personActivity}
        onSettleUp={handleSettleUp}
        isSettling={isSettling}
      />

      <PaymentModal
        isOpen={isPaymentOpen}
        direction={paymentDirection}
        settlementItem={settlementItem}
        counterparty={counterparty}
        groupName={sharedGroupName}
        isSubmitting={isSettling}
        onClose={handleClosePayment}
        onConfirmSettlement={handleConfirmSettlement}
      />
    </>
  );
}
