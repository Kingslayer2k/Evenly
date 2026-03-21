"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { computeExpenseShares } from "../lib/utils";

function toCentsFromSettlement(settlement) {
  if (settlement?.amount_cents != null) {
    return Number(settlement.amount_cents || 0);
  }

  return Math.round(Number(settlement?.amount || 0) * 100);
}

function maxDate(left, right) {
  const leftTime = left ? new Date(left).getTime() : 0;
  const rightTime = right ? new Date(right).getTime() : 0;
  return leftTime >= rightTime ? left : right;
}

export default function usePersonBalances(user) {
  const [people, setPeople] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase || !user) {
      setPeople([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    async function loadPeople() {
      setIsLoading(true);
      setError("");

      try {
        const membershipsResponse = await supabase
          .from("group_members")
          .select("*")
          .eq("user_id", user.id);

        if (membershipsResponse.error) throw membershipsResponse.error;

        const memberships = membershipsResponse.data || [];
        const groupIds = [...new Set(memberships.map((membership) => membership.group_id).filter(Boolean))];

        if (!groupIds.length) {
          if (!isMounted) return;
          setPeople([]);
          setIsLoading(false);
          return;
        }

        const [groupsResponse, membersResponse, expensesResponse, settlementsResponse, contactsResponse, expenseParticipantsResponse] = await Promise.all([
          supabase.from("groups").select("id, name").in("id", groupIds),
          supabase.from("group_members").select("*").in("group_id", groupIds),
          supabase.from("expenses").select("*").in("group_id", groupIds),
          supabase.from("settlements").select("*").in("group_id", groupIds),
          supabase.from("contacts").select("*").eq("owner_user_id", user.id),
          supabase.from("expense_participants").select("*").in("group_id", groupIds),
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

        const contactsTableMissing =
          contactsResponse.error &&
          (String(contactsResponse.error.code || "") === "PGRST205" ||
            String(contactsResponse.error.code || "") === "42P01" ||
            /contacts/i.test(String(contactsResponse.error.message || "")));

        if (contactsResponse.error && !contactsTableMissing) {
          throw contactsResponse.error;
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
        const expenseById = new Map((expensesResponse.data || []).map((expense) => [expense.id, expense]));
        const memberByUserId = new Map();
        const contactById = new Map((contactsTableMissing ? [] : contactsResponse.data || []).map((contact) => [contact.id, contact]));

        for (const member of membersResponse.data || []) {
          if (!memberByUserId.has(member.user_id)) {
            memberByUserId.set(member.user_id, member);
          }
        }

        const peopleMap = new Map();

        function ensurePerson(targetUserId, fallbackName = "Someone") {
          if (!targetUserId || targetUserId === user.id) return null;
          const existing = peopleMap.get(targetUserId);
          if (existing) return existing;

          const member = memberByUserId.get(targetUserId);
          const next = {
            id: targetUserId,
            displayName: member?.display_name || fallbackName,
            balanceCents: 0,
            lastActivityAt: "",
            sharedGroupsMap: new Map(),
            isOnEvenly: Boolean(member),
          };
          peopleMap.set(targetUserId, next);
          return next;
        }

        for (const contact of contactsTableMissing ? [] : contactsResponse.data || []) {
          peopleMap.set(contact.id, {
            id: contact.id,
            displayName: contact.display_name || "Someone",
            balanceCents: 0,
            lastActivityAt: "",
            sharedGroupsMap: new Map(),
            isOnEvenly: false,
            contactId: contact.id,
            phone: contact.phone || "",
            email: contact.email || "",
            status: contact.status || "guest",
          });
        }

        for (const member of membersResponse.data || []) {
          if (member.user_id === user.id) continue;
          const person = ensurePerson(member.user_id, member.display_name);
          if (!person) continue;
          person.sharedGroupsMap.set(member.group_id, {
            id: member.group_id,
            name: groupNameById.get(member.group_id) || "Shared group",
          });
        }

        for (const expense of expensesResponse.data || []) {
          const currentMembership = currentMembershipByGroup.get(expense.group_id);
          if (!currentMembership?.id) continue;

          const participantIds = Array.isArray(expense.participants) ? expense.participants : [];
          const shares = computeExpenseShares(expense);
          const currentShare = Number(shares[currentMembership.id] || 0);

          if (expense.paid_by === currentMembership.id) {
            for (const participantId of participantIds) {
              if (participantId === currentMembership.id) continue;
              const participantMember = memberById.get(participantId);
              const person = ensurePerson(participantMember?.user_id, participantMember?.display_name);
              if (!person) continue;
              person.balanceCents += Number(shares[participantId] || 0);
              person.lastActivityAt = maxDate(person.lastActivityAt, expense.created_at);
            }
            continue;
          }

          if (participantIds.includes(currentMembership.id)) {
            const payerMember = memberById.get(expense.paid_by);
            const person = ensurePerson(payerMember?.user_id, payerMember?.display_name);
            if (!person) continue;
            person.balanceCents -= currentShare;
            person.lastActivityAt = maxDate(person.lastActivityAt, expense.created_at);
          }
        }

        for (const settlement of settlementsTableMissing ? [] : settlementsResponse.data || []) {
          if (settlement.from_user_id === user.id) {
            const person = ensurePerson(
              settlement.to_user_id,
              memberByUserId.get(settlement.to_user_id)?.display_name || "Someone",
            );
            if (!person) continue;
            person.balanceCents += toCentsFromSettlement(settlement);
            person.lastActivityAt = maxDate(person.lastActivityAt, settlement.settled_at || settlement.created_at);
          }

          if (settlement.to_user_id === user.id) {
            const person = ensurePerson(
              settlement.from_user_id,
              memberByUserId.get(settlement.from_user_id)?.display_name || "Someone",
            );
            if (!person) continue;
            person.balanceCents -= toCentsFromSettlement(settlement);
            person.lastActivityAt = maxDate(person.lastActivityAt, settlement.settled_at || settlement.created_at);
          }
        }

        for (const expenseParticipant of expenseParticipantsTableMissing ? [] : expenseParticipantsResponse.data || []) {
          if (!expenseParticipant.contact_id) continue;

          const contact = contactById.get(expenseParticipant.contact_id);
          const expense = expenseById.get(expenseParticipant.expense_id);
          const currentMembership = currentMembershipByGroup.get(expenseParticipant.group_id);

          if (!contact || !expense || !currentMembership?.id) continue;
          if (expense.paid_by !== currentMembership.id) continue;

          const person = peopleMap.get(contact.id);
          if (!person) continue;

          person.balanceCents += Number(expenseParticipant.share_cents || 0);
          person.lastActivityAt = maxDate(person.lastActivityAt, expense.created_at);
          person.sharedGroupsMap.set(expenseParticipant.group_id, {
            id: expenseParticipant.group_id,
            name: groupNameById.get(expenseParticipant.group_id) || "Shared group",
          });
        }

        const nextPeople = [...peopleMap.values()]
          .map((person) => ({
            ...person,
            balance: person.balanceCents / 100,
            sharedGroups: [...person.sharedGroupsMap.values()],
            sharedGroupCount: person.sharedGroupsMap.size,
          }))
          .sort((left, right) => {
            const balanceDiff = Math.abs(right.balanceCents) - Math.abs(left.balanceCents);
            if (balanceDiff !== 0) return balanceDiff;
            return new Date(right.lastActivityAt || 0).getTime() - new Date(left.lastActivityAt || 0).getTime();
          });

        if (!isMounted) return;
        setPeople(nextPeople);
      } catch (nextError) {
        console.error(nextError);
        if (!isMounted) return;
        setError(nextError.message || "Could not load your people yet.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadPeople();

    return () => {
      isMounted = false;
    };
  }, [user]);

  return {
    people,
    isLoading,
    error,
  };
}
