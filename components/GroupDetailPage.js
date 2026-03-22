"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AddExpenseModal from "./AddExpenseModal";
import DeleteGroupDialog from "./DeleteGroupDialog";
import ExpenseDetail from "./ExpenseDetail";
import PaymentModal from "./PaymentModal";
import PayerSwitchModal from "./PayerSwitchModal";
import SettlementCard from "./SettlementCard";
import { readStoredCardImage } from "../lib/cardAppearance";
import { supabase } from "../lib/supabase";
import {
  loadUserContacts,
  createSettlementRecord,
  createExpenseRecord,
  deleteGroupRecord,
  deleteExpenseRecord,
  loadGroupDetailBundle,
  updateExpensePayerRecord,
} from "../lib/groupData";
import {
  copyToClipboard,
  formatCurrency,
  formatExpenseDate,
  formatSignedCurrency,
  getDisplayNameFromUser,
  getExpenseEmoji,
  getExpenseTitle,
  getMemberPreview,
  getStableCardColor,
  getUserSettlementSummary,
  sumGroupTotal,
} from "../lib/utils";

function readStoredCardColor(groupId) {
  if (typeof window === "undefined") return null;
  try {
    const colors = JSON.parse(window.localStorage.getItem("evenly-card-colors") || "{}");
    return colors[groupId] || null;
  } catch (error) {
    console.error("Could not read stored card color:", error);
    return null;
  }
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 12h8" />
      <path d="m12 8 4 4-4 4" />
      <path d="M4 6h7a2 2 0 0 1 2 2v1" />
      <path d="M20 18h-7a2 2 0 0 1-2-2v-1" />
    </svg>
  );
}

export default function GroupDetailPage({ groupId }) {
  const router = useRouter();
  const toastTimeoutRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const [user, setUser] = useState(null);
  const [profileName, setProfileName] = useState("");
  const [group, setGroup] = useState(null);
  const [membership, setMembership] = useState(null);
  const [members, setMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [contexts, setContexts] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [recordedSettlements, setRecordedSettlements] = useState([]);
  const [cardColor, setCardColor] = useState(getStableCardColor(groupId));
  const [cardImage, setCardImage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [toast, setToast] = useState("");
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [expenseToReassign, setExpenseToReassign] = useState(null);
  const [isDeletingExpense, setIsDeletingExpense] = useState(false);
  const [isDeleteGroupOpen, setIsDeleteGroupOpen] = useState(false);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  const [paymentFlow, setPaymentFlow] = useState(null);
  const [isSavingSettlement, setIsSavingSettlement] = useState(false);

  const showToast = useCallback((message) => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    setToast(message);
    toastTimeoutRef.current = window.setTimeout(() => setToast(""), 2400);
  }, []);

  const loadDetail = useCallback(
    async (currentUser, options = {}) => {
      if (!supabase || !currentUser || !groupId) {
        setIsLoading(false);
        return;
      }

      if (options.refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setErrorMessage("");

      try {
        const [bundle, nextContacts] = await Promise.all([
          loadGroupDetailBundle(supabase, groupId, currentUser),
          loadUserContacts(supabase, currentUser),
        ]);
        setProfileName(bundle.profileName);
        setGroup(bundle.group);
        setMembership(bundle.membership);
        setMembers(bundle.members);
        setExpenses(bundle.expenses);
        setContexts(bundle.contexts);
        setContacts(nextContacts || []);
        setRecordedSettlements(bundle.recordedSettlements || []);
        setCardColor(
          readStoredCardColor(bundle.group?.id) ||
            bundle.group?.card_color ||
            bundle.group?.color ||
            getStableCardColor(bundle.group?.id || bundle.group?.name),
        );
        setCardImage(
          readStoredCardImage(bundle.group?.id) ||
            bundle.group?.card_image ||
            bundle.group?.background_image ||
            bundle.group?.image_url ||
            "",
        );
      } catch (error) {
        console.error(error);
        setErrorMessage(error.message || "Could not load this group yet.");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [groupId],
  );

  const scheduleRefresh = useCallback(
    (currentUser) => {
      if (!currentUser || typeof window === "undefined") return;
      if (refreshTimerRef.current) return;

      refreshTimerRef.current = window.setTimeout(() => {
        refreshTimerRef.current = null;
        void loadDetail(currentUser, { refresh: true });
      }, 180);
    },
    [loadDetail],
  );

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    async function bootstrapAuth() {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;

      const nextUser = data.session?.user || null;
      setUser(nextUser);

      if (nextUser) {
        await loadDetail(nextUser);
      } else {
        setIsLoading(false);
      }
    }

    void bootstrapAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user || null;
      setUser(nextUser);

      if (nextUser) {
        void loadDetail(nextUser);
      } else {
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, [loadDetail]);

  useEffect(() => {
    if (!supabase || !user || !groupId) return undefined;

    const channel = supabase
      .channel(`group-detail-${groupId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "groups", filter: `id=eq.${groupId}` },
        () => scheduleRefresh(user),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_members", filter: `group_id=eq.${groupId}` },
        () => scheduleRefresh(user),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "expenses", filter: `group_id=eq.${groupId}` },
        () => scheduleRefresh(user),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [groupId, scheduleRefresh, user]);

  const summary = useMemo(
    () => getUserSettlementSummary(members, expenses, membership, recordedSettlements),
    [expenses, members, membership, recordedSettlements],
  );

  const totalSpent = useMemo(() => sumGroupTotal(expenses), [expenses]);
  const memberPreview = useMemo(() => getMemberPreview(members), [members]);
  const inviteCode = group?.join_code || group?.code || "------";
  const shareLink = typeof window !== "undefined" ? `${window.location.origin}/groups?join=${inviteCode}` : "";
  const displayName = profileName || getDisplayNameFromUser(user, "");

  const getCounterpartyForSettlement = useCallback(
    (item, direction) => {
      const targetUserId = direction === "pay" ? item?.toUserId : item?.fromUserId;
      return members.find((member) => member.user_id === targetUserId) || null;
    },
    [members],
  );

  const handleCreateExpense = useCallback(
    async ({
      title,
      amountCents,
      paidBy,
      participants,
      splitType,
      shares,
      contactParticipants,
      contactShares,
      contextId,
      contextName,
    }) => {
      if (!supabase || !user) {
        return { ok: false, message: "Sign in first so we can save the expense." };
      }

      try {
        await createExpenseRecord(supabase, user, {
          groupId,
          title,
          amountCents,
          paidBy,
          participants,
          splitType,
          shares,
          contactParticipants,
          contactShares,
          contextId,
          contextName,
        });

        await loadDetail(user, { refresh: true });
        showToast("Expense added");
        return { ok: true };
      } catch (error) {
        console.error(error);
        return {
          ok: false,
          message: error.message || "Could not save the expense.",
        };
      }
    },
    [groupId, loadDetail, showToast, user],
  );

  const handleReassignPayer = useCallback(
    async (expense, paidBy) => {
      if (!supabase || !user) {
        return { ok: false, message: "Sign in first so we can update the payer." };
      }

      try {
        await updateExpensePayerRecord(supabase, expense.id, paidBy);
        await loadDetail(user, { refresh: true });
        showToast("Payer updated");
        return { ok: true };
      } catch (error) {
        console.error(error);
        return {
          ok: false,
          message: error.message || "Could not update the payer.",
        };
      }
    },
    [loadDetail, showToast, user],
  );

  const handleDeleteGroup = useCallback(async () => {
    if (!supabase || !group?.id) return;

    setIsDeletingGroup(true);

    try {
      await deleteGroupRecord(supabase, group.id);
      router.replace("/groups");
    } catch (error) {
      console.error(error);
      setIsDeleteGroupOpen(false);
      showToast(error.message || "Could not delete the group yet");
    } finally {
      setIsDeletingGroup(false);
    }
  }, [group?.id, router, showToast]);

  const handleDeleteExpense = useCallback(
    async (expense) => {
      if (!supabase || !user) {
        return { ok: false, message: "Sign in first so we can delete the expense." };
      }

      setIsDeletingExpense(true);

      try {
        await deleteExpenseRecord(supabase, expense.id);
        setSelectedExpense(null);
        await loadDetail(user, { refresh: true });
        showToast("Expense deleted");
        return { ok: true };
      } catch (error) {
        console.error(error);
        return {
          ok: false,
          message: error.message || "Could not delete the expense.",
        };
      } finally {
        setIsDeletingExpense(false);
      }
    },
    [loadDetail, showToast, user],
  );

  const handleOpenSettlement = useCallback(
    (item, direction) => {
      setPaymentFlow({
        item,
        direction,
      });
    },
    [],
  );

  const handleConfirmSettlement = useCallback(
    async ({ settlementItem, method, direction, counterparty }) => {
      if (!supabase || !user) {
        return;
      }

      const fromUserId = direction === "pay" ? user.id : counterparty?.user_id;
      const toUserId = direction === "pay" ? counterparty?.user_id : user.id;

      if (!fromUserId || !toUserId) {
        showToast("We need both people linked before we can mark this settled");
        return;
      }

      setIsSavingSettlement(true);

      try {
        await createSettlementRecord(supabase, {
          groupId,
          fromUserId,
          toUserId,
          amount: settlementItem.amount,
          paymentMethod: method,
          notes: `${direction === "pay" ? "Paid" : "Requested"} in ${group?.name || "Evenly"}`,
        });

        setPaymentFlow(null);
        await loadDetail(user, { refresh: true });
        showToast(`Settled with ${counterparty?.display_name || "them"}`);
      } catch (error) {
        console.error(error);
        showToast(
          error?.message?.toLowerCase().includes("settlements")
            ? "Create the settlements table in Supabase first"
            : "Could not record the settlement yet",
        );
      } finally {
        setIsSavingSettlement(false);
      }
    },
    [group?.name, groupId, loadDetail, showToast, user],
  );

  async function handleCopyCode() {
    const success = await copyToClipboard(inviteCode);
    if (success) {
      showToast("Invite code copied");
    }
  }

  async function handleShareInvite() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Join ${group?.name || "my Evenly group"}`,
          text: `Join ${group?.name || "my Evenly group"} with code ${inviteCode}`,
          url: shareLink || undefined,
        });
      } else if (shareLink) {
        await copyToClipboard(shareLink);
      } else {
        await copyToClipboard(inviteCode);
      }
      showToast("Invite ready to share");
    } catch (error) {
      console.error("Share cancelled:", error);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--bg)]">
      <header className="fixed inset-x-0 top-0 z-30 border-b border-[var(--border)] bg-[color:var(--surface)]/95 px-5 py-4 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-[460px] items-center justify-between">
          <button
            type="button"
            onClick={() => router.push("/groups")}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--text)] transition hover:opacity-90 active:scale-[0.98]"
            aria-label="Back to groups"
          >
            <BackIcon />
          </button>

          <div className="text-center">
            <div className="text-[22px] font-bold tracking-[-0.04em] text-[var(--text)]">
              {group?.name || "Group"}
            </div>
            <div className="mt-1 text-[14px] text-[var(--text-muted)]">
              {isRefreshing ? "Refreshing..." : "Live group detail"}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsExpenseModalOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)] text-white transition hover:opacity-90 active:scale-[0.98]"
            aria-label="Add expense"
          >
            <PlusIcon />
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[460px] px-5 pt-[104px] pb-12">
        {isLoading ? (
          <div className="space-y-4">
            <div className="aspect-[3.375/2.125] animate-pulse rounded-[30px] border border-[#E5E7EB] bg-white" />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-28 animate-pulse rounded-[24px] bg-white" />
              <div className="h-28 animate-pulse rounded-[24px] bg-white" />
            </div>
          </div>
        ) : !user ? (
          <div className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)]">
            <h2 className="text-[24px] font-bold text-[var(--text)]">Sign in first</h2>
            <p className="mt-3 text-[15px] leading-6 text-[var(--text-muted)]">
              Log in on the welcome screen and then come back into the group.
            </p>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="mt-6 rounded-full bg-[var(--accent)] px-5 py-3 text-[15px] font-semibold text-white transition hover:opacity-90"
            >
              Go to welcome
            </button>
          </div>
        ) : !group || !membership ? (
          <div className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)]">
            <h2 className="text-[24px] font-bold text-[var(--text)]">Group not available</h2>
            <p className="mt-3 text-[15px] leading-6 text-[var(--text-muted)]">
              You may not be in this group yet, or the invite has changed.
            </p>
            <button
              type="button"
              onClick={() => router.push("/groups")}
              className="mt-6 rounded-full bg-[var(--accent)] px-5 py-3 text-[15px] font-semibold text-white transition hover:opacity-90"
            >
              Back to groups
            </button>
          </div>
        ) : (
          <>
            <section
              className="relative overflow-hidden rounded-[30px] border border-white/60 shadow-[0_10px_30px_rgba(28,25,23,0.08)]"
              style={{ backgroundColor: cardColor }}
            >
              {cardImage ? (
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url(${cardImage})` }}
                />
              ) : null}

              <div className="relative bg-[rgba(28,25,23,0.18)] px-6 pt-6 pb-6 text-white">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1
                      className="max-w-[230px] text-[34px] font-semibold leading-[0.95] tracking-[-0.05em]"
                      style={{ fontFamily: "Tiempos Headline, Georgia, 'Times New Roman', serif" }}
                    >
                      {group.name}
                    </h1>
                    <p className="mt-3 max-w-[240px] text-[14px] text-white/85">
                      {memberPreview || "Just you for now"}
                    </p>
                  </div>

                  <div className="text-right">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70">
                      Invite code
                    </div>
                    <div className="mt-1 font-mono text-[18px] font-bold tracking-[0.18em]">
                      {inviteCode}
                    </div>
                  </div>
                </div>

                <div className="mt-8 grid grid-cols-2 gap-3">
                  <div className="rounded-[22px] bg-white/16 p-4">
                    <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-white/70">
                      Your standing
                    </div>
                    <div className="mt-2 text-[30px] font-bold tracking-[-0.05em] text-white">
                      {formatSignedCurrency(summary.netAmount)}
                    </div>
                  </div>
                  <div className="rounded-[22px] bg-white/16 p-4">
                    <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-white/70">
                      Total spend
                    </div>
                    <div className="mt-2 text-[30px] font-bold tracking-[-0.05em] text-white">
                      {formatCurrency(totalSpent)}
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    onClick={() => void handleCopyCode()}
                    className="rounded-full bg-white px-4 py-2 text-[14px] font-semibold text-[#1C1917] transition hover:bg-[#F3F4F6]"
                  >
                    Copy code
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleShareInvite()}
                    className="inline-flex items-center gap-2 rounded-full border border-white/45 px-4 py-2 text-[14px] font-semibold text-white transition hover:border-white hover:bg-white/10"
                  >
                    <ShareIcon />
                    Share invite
                  </button>
                  {membership?.role === "admin" ? (
                    <button
                      type="button"
                      onClick={() => setIsDeleteGroupOpen(true)}
                      className="rounded-full border border-white/45 px-4 py-2 text-[14px] font-semibold text-white transition hover:bg-white/10"
                    >
                      Delete group
                    </button>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="mt-5 grid grid-cols-3 gap-3">
              <div className="rounded-[24px] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]">
                <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                  Members
                </div>
                <div className="mt-2 text-[26px] font-bold tracking-[-0.04em] text-[var(--text)]">
                  {members.length}
                </div>
              </div>
              <div className="rounded-[24px] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]">
                <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                  Expenses
                </div>
                <div className="mt-2 text-[26px] font-bold tracking-[-0.04em] text-[var(--text)]">
                  {expenses.length}
                </div>
              </div>
              <div className="rounded-[24px] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]">
                <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                  You
                </div>
                <div className="mt-2 truncate text-[18px] font-bold tracking-[-0.03em] text-[var(--text)]">
                  {displayName}
                </div>
              </div>
            </section>

            <SettlementCard summary={summary} onAction={handleOpenSettlement} />

            <section className="mt-6 rounded-[28px] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-[22px] font-bold tracking-[-0.04em] text-[var(--text)]">Recent expenses</h2>
                  <p className="mt-1 text-[14px] text-[var(--text-muted)]">
                    Tap in new charges and switch the payer if the wrong person grabbed it.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(true)}
                  className="rounded-full bg-[var(--accent)] px-4 py-2 text-[14px] font-semibold text-white transition hover:opacity-90"
                >
                  Add
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {expenses.map((expense) => {
                  const payer = members.find((member) => member.id === expense.paid_by);
                  const participantCount = Array.isArray(expense.participants) ? expense.participants.length : 0;
                  const totalAmount =
                    (Number(expense.amount_cents || 0) + Number(expense.round_up_cents || 0)) / 100;

                  return (
                    <div
                      key={expense.id}
                      onClick={() => setSelectedExpense(expense)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedExpense(expense);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      className="block w-full rounded-[22px] border border-[var(--border)] bg-[var(--surface-soft)] p-4 text-left transition hover:opacity-95 active:scale-[0.995]"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--surface-accent)] text-[18px]">
                              {getExpenseEmoji(expense)}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-[16px] font-semibold text-[var(--text)]">
                                {getExpenseTitle(expense)}
                              </div>
                              <div className="mt-1 text-[13px] text-[var(--text-muted)]">
                                Paid by {payer?.display_name || "Someone"} • {participantCount || members.length} people • {formatExpenseDate(expense.created_at)}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-[18px] font-bold tracking-[-0.03em] text-[var(--text)]">
                            {formatCurrency(totalAmount)}
                          </div>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setExpenseToReassign(expense);
                            }}
                            className="mt-2 text-[13px] font-semibold text-[var(--accent)] transition hover:opacity-80"
                          >
                            Switch payer
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {!expenses.length ? (
                  <div className="rounded-2xl bg-[var(--surface-muted)] px-4 py-4 text-[14px] text-[var(--text-muted)]">
                    No expenses yet. Add the first one and the live balances will kick in.
                  </div>
                ) : null}
              </div>
            </section>
          </>
        )}

        {errorMessage ? (
          <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[14px] font-medium text-[var(--danger)]">
            {errorMessage}
          </div>
        ) : null}
      </div>

      {toast ? (
        <div className="fixed right-4 bottom-4 z-40 rounded-full bg-[#1C1917] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_10px_20px_rgba(28,25,23,0.18)]">
          {toast}
        </div>
      ) : null}

        {isExpenseModalOpen ? (
        <AddExpenseModal
          key={`expense-${groupId}-${membership?.id || "none"}-${members.length}`}
          isOpen={isExpenseModalOpen}
          onClose={() => setIsExpenseModalOpen(false)}
          onSubmit={handleCreateExpense}
          members={members}
          contexts={contexts}
          contacts={contacts}
          initialPayerId={membership?.id}
        />
      ) : null}

      {selectedExpense ? (
        <ExpenseDetail
          isOpen={Boolean(selectedExpense)}
          expense={selectedExpense}
          members={members}
          canDelete={membership?.role === "admin" || selectedExpense?.paid_by === membership?.id}
          isDeleting={isDeletingExpense}
          onClose={() => setSelectedExpense(null)}
          onDelete={handleDeleteExpense}
          onChangePayer={(expense) => {
            setSelectedExpense(null);
            setExpenseToReassign(expense);
          }}
        />
      ) : null}

      {expenseToReassign ? (
        <PayerSwitchModal
          key={`payer-${expenseToReassign.id}`}
          isOpen={Boolean(expenseToReassign)}
          onClose={() => setExpenseToReassign(null)}
          onSave={handleReassignPayer}
          expense={expenseToReassign}
          members={members}
        />
      ) : null}

      {paymentFlow ? (
        <PaymentModal
          isOpen={Boolean(paymentFlow)}
          direction={paymentFlow.direction}
          settlementItem={paymentFlow.item}
          counterparty={getCounterpartyForSettlement(paymentFlow.item, paymentFlow.direction)}
          groupName={group?.name || "Evenly"}
          isSubmitting={isSavingSettlement}
          onClose={() => setPaymentFlow(null)}
          onConfirmSettlement={handleConfirmSettlement}
        />
      ) : null}

      <DeleteGroupDialog
        isOpen={isDeleteGroupOpen}
        groupName={group?.name || "This group"}
        isDeleting={isDeletingGroup}
        onCancel={() => setIsDeleteGroupOpen(false)}
        onConfirm={handleDeleteGroup}
      />
    </main>
  );
}
