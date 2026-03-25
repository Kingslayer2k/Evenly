"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { readRuntimeCache, writeRuntimeCache } from "../lib/runtimeCache";
import { computeExpenseShares, getExpenseEmoji, getExpenseTitle } from "../lib/utils";

function settlementAmount(settlement) {
  if (settlement?.amount != null) return Number(settlement.amount || 0);
  return Number(settlement?.amount_cents || 0) / 100;
}

export default function useActivityFeed(user, limit = 10) {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const bypassCacheRef = useRef(false);

  const refresh = useCallback(() => {
    bypassCacheRef.current = true;
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!supabase || !user) {
      setItems([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const cacheKey = `activity:${user.id}:${limit}`;
    const shouldBypass = bypassCacheRef.current;
    bypassCacheRef.current = false;
    const cachedItems = shouldBypass ? null : readRuntimeCache(cacheKey, 15000);

    if (cachedItems) {
      setItems(cachedItems);
      setIsLoading(false);
    }

    async function loadActivity() {
      setIsLoading(!cachedItems);
      setError("");

      try {
        const membershipsResponse = await supabase
          .from("group_members")
          .select("id, group_id")
          .eq("user_id", user.id);

        if (membershipsResponse.error) throw membershipsResponse.error;

        const memberships = membershipsResponse.data || [];
        const groupIds = [...new Set(memberships.map((membership) => membership.group_id).filter(Boolean))];

        if (!groupIds.length) {
          if (isMounted) {
            setItems([]);
            setIsLoading(false);
          }
          return;
        }

        const [groupsResponse, membersResponse, expensesResponse, settlementsResponse, expenseParticipantsResponse] =
          await Promise.all([
          supabase.from("groups").select("id, name").in("id", groupIds),
          supabase
            .from("group_members")
            .select("id, group_id, user_id, display_name")
            .in("group_id", groupIds),
          supabase
            .from("expenses")
            .select("id, group_id, paid_by, participants, shares, split_type, amount_cents, round_up_cents, created_at, title, name, description, emoji")
            .in("group_id", groupIds)
            .order("created_at", { ascending: false }),
          supabase
            .from("settlements")
            .select("id, group_id, from_user_id, to_user_id, amount, amount_cents, payment_method, settled_at, created_at")
            .in("group_id", groupIds)
            .order("settled_at", { ascending: false }),
          supabase
            .from("expense_participants")
            .select("expense_id, group_id, contact_id")
            .in("group_id", groupIds),
        ]);

        if (groupsResponse.error) throw groupsResponse.error;
        if (membersResponse.error) throw membersResponse.error;
        if (expensesResponse.error) throw expensesResponse.error;

        const settlementsTableMissing =
          settlementsResponse.error &&
          (String(settlementsResponse.error.code || "") === "PGRST205" ||
            String(settlementsResponse.error.code || "") === "42P01" ||
            /settlements/i.test(String(settlementsResponse.error.message || "")));

        if (settlementsResponse.error && !settlementsTableMissing) {
          throw settlementsResponse.error;
        }

        const expenseParticipantsTableMissing =
          expenseParticipantsResponse.error &&
          (String(expenseParticipantsResponse.error.code || "") === "PGRST205" ||
            String(expenseParticipantsResponse.error.code || "") === "42P01" ||
            /expense_participants/i.test(String(expenseParticipantsResponse.error.message || "")));

        if (expenseParticipantsResponse.error && !expenseParticipantsTableMissing) {
          throw expenseParticipantsResponse.error;
        }

        const currentMembershipByGroup = new Map(
          memberships.map((membership) => [membership.group_id, membership]),
        );
        const groupNameById = new Map((groupsResponse.data || []).map((group) => [group.id, group.name]));
        const memberById = new Map((membersResponse.data || []).map((member) => [member.id, member]));
        const memberByUserId = new Map();
        const relatedContactIdsByExpense = new Map();

        for (const member of membersResponse.data || []) {
          if (!memberByUserId.has(member.user_id)) {
            memberByUserId.set(member.user_id, member);
          }
        }

        for (const row of expenseParticipantsTableMissing ? [] : expenseParticipantsResponse.data || []) {
          if (!row.contact_id) continue;
          relatedContactIdsByExpense.set(row.expense_id, [
            ...(relatedContactIdsByExpense.get(row.expense_id) || []),
            row.contact_id,
          ]);
        }

        const activityItems = [];

        for (const expense of expensesResponse.data || []) {
          const currentMembership = currentMembershipByGroup.get(expense.group_id);
          if (!currentMembership) continue;

          const participantIds = Array.isArray(expense.participants) ? expense.participants : [];
          if (!participantIds.includes(currentMembership.id) && expense.paid_by !== currentMembership.id) continue;

          const payer = memberById.get(expense.paid_by);
          const relatedUserIds = participantIds
            .map((participantId) => memberById.get(participantId)?.user_id)
            .filter((participantUserId) => participantUserId && participantUserId !== user.id);
          const relatedContactIds = relatedContactIdsByExpense.get(expense.id) || [];

          const shares = computeExpenseShares(expense);
          const currentShare = Number(shares[currentMembership.id] || 0) / 100;

          activityItems.push({
            id: `expense-${expense.id}`,
            type: "expense",
            icon: getExpenseEmoji(expense),
            title:
              expense.paid_by === currentMembership.id
                ? `You added ${getExpenseTitle(expense)}`
                : `${payer?.display_name || "Someone"} added ${getExpenseTitle(expense)}`,
            meta: `${groupNameById.get(expense.group_id) || "Shared group"} • ${expense.paid_by === currentMembership.id ? `Your share ${currentShare ? `$${currentShare.toFixed(2)}` : ""}` : "Shared expense"}`.trim(),
            groupId: expense.group_id,
            createdAt: expense.created_at,
            relatedUserIds: [...new Set([...relatedUserIds, ...relatedContactIds])],
          });
        }

        for (const settlement of settlementsTableMissing ? [] : settlementsResponse.data || []) {
          if (settlement.from_user_id !== user.id && settlement.to_user_id !== user.id) continue;

          const otherUserId = settlement.from_user_id === user.id ? settlement.to_user_id : settlement.from_user_id;
          const otherMember = memberByUserId.get(otherUserId);
          const otherName = otherMember?.display_name || "Someone";
          const outgoing = settlement.from_user_id === user.id;

          activityItems.push({
            id: `settlement-${settlement.id}`,
            type: "settlement",
            icon: "💰",
            title: outgoing ? `You settled up with ${otherName}` : `${otherName} settled up`,
            meta: `${groupNameById.get(settlement.group_id) || "Shared group"} • ${settlement.payment_method || "payment"} • $${settlementAmount(settlement).toFixed(2)}`,
            groupId: settlement.group_id,
            createdAt: settlement.settled_at || settlement.created_at,
            relatedUserIds: otherUserId ? [otherUserId] : [],
          });
        }

        activityItems.sort(
          (left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime(),
        );

        if (!isMounted) return;
        const nextItems = activityItems.slice(0, limit);
        writeRuntimeCache(cacheKey, nextItems);
        setItems(nextItems);
      } catch (nextError) {
        console.error(nextError);
        if (!isMounted) return;
        setError(nextError.message || "Could not load activity yet.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadActivity();

    return () => {
      isMounted = false;
    };
  }, [limit, user, refreshKey]);

  return {
    items,
    isLoading,
    error,
    refresh,
  };
}
