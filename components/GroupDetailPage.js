"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { List } from "react-window";
import RotationCard from "./RotationCard";
import SettlementCard from "./SettlementCard";
import { readStoredCardImage } from "../lib/cardAppearance";
import { supabase } from "../lib/supabase";
import {
  completeRotationRecord,
  createExpenseTemplate,
  createRotationRecord,
  deleteExpenseTemplate,
  loadExpenseTemplates,
  loadUserContacts,
  createSettlementRecord,
  createExpenseRecord,
  updateExpenseRecord,
  deleteGroupRecord,
  deleteExpenseRecord,
  leaveGroupRecord,
  loadGroupDetailBundle,
  loadRecentGroupExpenses,
  updateExpensePayerRecord,
} from "../lib/groupData";
import {
  advanceRotationTurn,
  copyToClipboard,
  formatCurrency,
  formatExpenseDate,
  formatSignedCurrency,
  getExpenseEmoji,
  getExpenseTitle,
  getMemberPreview,
  getRotationCurrentUserId,
  getStableCardColor,
  getUserSettlementSummary,
  sumGroupTotal,
} from "../lib/utils";

const AddExpenseModal = dynamic(() => import("./AddExpenseModal"), { loading: () => null });
const TripSummaryModal = dynamic(() => import("./TripSummaryModal"), { loading: () => null });
const QRInviteModal = dynamic(() => import("./QRInviteModal"), { loading: () => null });
const CompleteRotationModal = dynamic(() => import("./CompleteRotationModal"), { loading: () => null });
const CreateRotationModal = dynamic(() => import("./CreateRotationModal"), { loading: () => null });
const DeleteGroupDialog = dynamic(() => import("./DeleteGroupDialog"), { loading: () => null });
const ExpenseDetail = dynamic(() => import("./ExpenseDetail"), { loading: () => null });
const LeaveGroupDialog = dynamic(() => import("./LeaveGroupDialog"), { loading: () => null });
const PaymentModal = dynamic(() => import("./PaymentModal"), { loading: () => null });
const PayerSwitchModal = dynamic(() => import("./PayerSwitchModal"), { loading: () => null });

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

function formatTripDateRange(startDate, endDate) {
  if (!startDate && !endDate) return "";
  const opts = { month: "short", day: "numeric" };
  const start = startDate ? new Date(startDate).toLocaleDateString("en-US", opts) : null;
  const end = endDate ? new Date(endDate).toLocaleDateString("en-US", opts) : null;
  if (start && end) return `${start} \u2013 ${end}`;
  if (start) return `From ${start}`;
  if (end) return `Until ${end}`;
  return "";
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

function ExpenseRow({ expense, members, onOpenExpense, onSwitchPayer }) {
  const payer = members.find((member) => member.id === expense.paid_by);
  const participantCount = Array.isArray(expense.participants) ? expense.participants.length : 0;
  const totalAmount =
    (Number(expense.amount_cents || 0) + Number(expense.round_up_cents || 0)) / 100;

  return (
    <div
      onClick={() => onOpenExpense(expense)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenExpense(expense);
        }
      }}
      role="button"
      tabIndex={0}
      className="content-auto block w-full rounded-[22px] border border-[var(--border)] bg-[var(--surface-soft)] p-4 text-left transition hover:opacity-95 active:scale-[0.995]"
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
              onSwitchPayer(expense);
            }}
            className="mt-2 min-h-11 text-[13px] font-semibold text-[var(--accent)] transition hover:opacity-80"
          >
            Switch payer
          </button>
        </div>
      </div>
    </div>
  );
}

function ExpenseListRow({ index, style, expenses, members, onOpenExpense, onSwitchPayer, ariaAttributes }) {
  return (
    <div style={{ ...style, left: 0, right: 0, paddingBottom: 12 }} {...ariaAttributes}>
      <ExpenseRow
        expense={expenses[index]}
        members={members}
        onOpenExpense={onOpenExpense}
        onSwitchPayer={onSwitchPayer}
      />
    </div>
  );
}

export default function GroupDetailPage({ groupId }) {
  const router = useRouter();
  const toastTimeoutRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const [user, setUser] = useState(null);
  const [group, setGroup] = useState(null);
  const [membership, setMembership] = useState(null);
  const [members, setMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [contexts, setContexts] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [recordedSettlements, setRecordedSettlements] = useState([]);
  const [rotations, setRotations] = useState([]);
  const [rotationHistory, setRotationHistory] = useState([]);
  const [cardColor, setCardColor] = useState(getStableCardColor(groupId));
  const [cardImage, setCardImage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [toast, setToast] = useState("");
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState(null);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [expenseToReassign, setExpenseToReassign] = useState(null);
  const [isDeletingExpense, setIsDeletingExpense] = useState(false);
  const [isDeleteGroupOpen, setIsDeleteGroupOpen] = useState(false);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  const [isLeaveGroupOpen, setIsLeaveGroupOpen] = useState(false);
  const [isLeavingGroup, setIsLeavingGroup] = useState(false);
  const [detailTab, setDetailTab] = useState("expenses");
  const [isCreateRotationOpen, setIsCreateRotationOpen] = useState(false);
  const [isCreatingRotation, setIsCreatingRotation] = useState(false);
  const [rotationToComplete, setRotationToComplete] = useState(null);
  const [recentRotationExpenses, setRecentRotationExpenses] = useState([]);
  const [isCompletingRotation, setIsCompletingRotation] = useState(false);
  const [paymentFlow, setPaymentFlow] = useState(null);
  const [isSavingSettlement, setIsSavingSettlement] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isQROpen, setIsQROpen] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [viewportHeight, setViewportHeight] = useState(720);

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
        setGroup(bundle.group);
        setMembership(bundle.membership);
        setMembers(bundle.members);
        setExpenses(bundle.expenses);
        setContexts(bundle.contexts);
        setContacts(nextContacts || []);
        setRecordedSettlements(bundle.recordedSettlements || []);
        setRotations(bundle.rotations || []);
        setRotationHistory(bundle.rotationHistory || []);
        setCardColor(
          bundle.group?.card_color ||
            bundle.group?.color ||
            readStoredCardColor(bundle.group?.id) ||
            getStableCardColor(bundle.group?.id || bundle.group?.name),
        );
        setCardImage(
          bundle.group?.card_image ||
            bundle.group?.background_image ||
            bundle.group?.image_url ||
            readStoredCardImage(bundle.group?.id) ||
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
        loadExpenseTemplates(supabase, groupId).then(setTemplates).catch(() => {});
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
  }, [groupId, loadDetail]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    function updateViewportHeight() {
      setViewportHeight(window.innerHeight || 720);
    }

    updateViewportHeight();
    window.addEventListener("resize", updateViewportHeight);
    return () => window.removeEventListener("resize", updateViewportHeight);
  }, []);

  useEffect(() => {
    router.prefetch("/groups");
    router.prefetch("/activity");
    router.prefetch("/people");
    router.prefetch("/settings");
    if (groupId) {
      router.prefetch(`/groups/${groupId}`);
    }
  }, [groupId, router]);

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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rotations", filter: `group_id=eq.${groupId}` },
        () => scheduleRefresh(user),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rotation_history" },
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
  const shouldVirtualizeExpenses = expenses.length > 50;
  const groupedExpenses = useMemo(() => {
    if (!expenses.length || shouldVirtualizeExpenses) return [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sections = new Map();
    for (const expense of expenses) {
      const d = new Date(expense.created_at);
      const expDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const diff = Math.round((today - expDay) / 86400000);
      let label;
      if (diff <= 0) label = "Today";
      else if (diff === 1) label = "Yesterday";
      else if (diff < 7) label = d.toLocaleDateString("en-US", { weekday: "long" });
      else label = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: diff > 364 ? "numeric" : undefined });
      if (!sections.has(label)) sections.set(label, []);
      sections.get(label).push(expense);
    }
    return Array.from(sections.entries());
  }, [expenses, shouldVirtualizeExpenses]);
  const expenseListHeight = useMemo(
    () => Math.min(Math.max(viewportHeight - 360, 360), expenses.length * 110),
    [expenses.length, viewportHeight],
  );
  const rotationsWithPeople = useMemo(() => {
    return rotations.map((rotation) => {
      const currentUserId = getRotationCurrentUserId(rotation);
      const currentMember = members.find((member) => member.user_id === currentUserId) || null;
      return {
        ...rotation,
        current_turn_user_id: currentUserId,
        current_turn_name: currentMember?.display_name || "Someone",
      };
    });
  }, [members, rotations]);
  const groupRotationHistory = useMemo(() => {
    return (rotationHistory || []).slice(0, 5).map((entry) => {
      const rotation = rotations.find((item) => item.id === entry.rotation_id);
      const completer = members.find((member) => member.user_id === entry.completed_by);
      return {
        ...entry,
        rotationName: rotation?.name || "Rotation",
        completedByName: completer?.display_name || "Someone",
      };
    });
  }, [members, rotationHistory, rotations]);

  const isTrip = group?.group_type === "trip" || group?.type === "trip";
  const tripDateRange = formatTripDateRange(
    group?.start_date || group?.starts_at,
    group?.end_date || group?.ends_at,
  );

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
      splitMethod,
      shares,
      contactParticipants,
      contactShares,
      contextId,
      contextName,
      splitDetails,
      recurringInterval,
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
          splitMethod,
          shares,
          contactParticipants,
          contactShares,
          contextId,
          contextName,
          splitDetails,
        });

        if (recurringInterval) {
          await createExpenseTemplate(supabase, {
            groupId,
            createdByMemberId: membership?.id || null,
            title,
            amountCents,
            paidBy,
            participants,
            splitType,
            splitMethod,
            shares,
            splitDetails,
            recurringInterval,
          });
          loadExpenseTemplates(supabase, groupId).then(setTemplates).catch(() => {});
        }

        await loadDetail(user, { refresh: true });
        showToast(recurringInterval ? "Recurring expense saved" : "Expense added");
        return { ok: true };
      } catch (error) {
        console.error(error);
        return {
          ok: false,
          message: error.message || "Could not save the expense.",
        };
      }
    },
    [groupId, loadDetail, membership?.id, showToast, user],
  );

  const handleEditExpense = useCallback(
    async ({
      title,
      amountCents,
      paidBy,
      participants,
      splitType,
      splitMethod,
      shares,
      splitDetails,
    }) => {
      if (!supabase || !user || !expenseToEdit?.id) {
        return { ok: false, message: "Sign in first so we can save the change." };
      }

      try {
        await updateExpenseRecord(supabase, expenseToEdit.id, {
          title,
          amountCents,
          paidBy,
          participants,
          splitType,
          splitMethod,
          shares,
          splitDetails,
        });

        setExpenseToEdit(null);
        await loadDetail(user, { refresh: true });
        showToast("Expense updated");
        return { ok: true };
      } catch (error) {
        console.error(error);
        return { ok: false, message: error.message || "Could not update the expense." };
      }
    },
    [expenseToEdit?.id, loadDetail, showToast, user],
  );

  const handleCreateRotation = useCallback(
    async ({ name, frequency, people, currentTurnIndex }) => {
      if (!supabase || !group?.id) {
        return { ok: false, message: "We need the group loaded first." };
      }

      setIsCreatingRotation(true);

      try {
        const rotation = await createRotationRecord(supabase, {
          groupId: group.id,
          name,
          frequency,
          people,
          currentTurnIndex,
        });
        setRotations((previous) => [...previous, rotation]);
        showToast("Rotation created");
        return { ok: true };
      } catch (error) {
        console.error(error);
        return { ok: false, message: error.message || "Could not create the rotation." };
      } finally {
        setIsCreatingRotation(false);
      }
    },
    [group?.id, showToast],
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

  const handleLeaveGroup = useCallback(async () => {
    if (!supabase || !group?.id || !user?.id) return;

    setIsLeavingGroup(true);

    try {
      await leaveGroupRecord(supabase, group.id, user.id);
      router.replace("/groups");
    } catch (error) {
      console.error(error);
      setIsLeaveGroupOpen(false);
      showToast(error.message || "Could not leave the group yet");
    } finally {
      setIsLeavingGroup(false);
    }
  }, [group?.id, router, showToast, user?.id]);

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

  const handleOpenExpense = useCallback((expense) => {
    setSelectedExpense(expense);
  }, []);

  const handleOpenExpensePayerSwitch = useCallback((expense) => {
    setExpenseToReassign(expense);
  }, []);

  const handleOpenRotationComplete = useCallback(async (rotation) => {
    setRotationToComplete(rotation);
    try {
      const recentExpenses = await loadRecentGroupExpenses(supabase, groupId, 6);
      setRecentRotationExpenses(recentExpenses);
    } catch (error) {
      console.error(error);
      setRecentRotationExpenses([]);
    }
  }, [groupId]);

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

  const handleCompleteRotation = useCallback(
    async ({ linkedExpenseId, note }) => {
      if (!supabase || !rotationToComplete || !user?.id) {
        return;
      }

      const optimisticRotation = advanceRotationTurn(rotationToComplete);
      const previousRotations = rotations;
      const previousHistory = rotationHistory;

      setIsCompletingRotation(true);
      setRotations((current) =>
        current.map((rotation) => (rotation.id === rotationToComplete.id ? optimisticRotation : rotation)),
      );
      setRotationHistory((current) => [
        {
          id: `temp-${Date.now()}`,
          rotation_id: rotationToComplete.id,
          completed_by: user.id,
          completed_at: new Date().toISOString(),
          linked_expense_id: linkedExpenseId,
          note,
        },
        ...current,
      ]);

      try {
        const result = await completeRotationRecord(supabase, rotationToComplete, {
          completedBy: user.id,
          linkedExpenseId,
          note,
        });
        setRotations((current) =>
          current.map((rotation) => (rotation.id === rotationToComplete.id ? result.rotation : rotation)),
        );
        if (result.history) {
          setRotationHistory((current) => [
            result.history,
            ...current.filter((entry) => !String(entry.id).startsWith("temp-")),
          ]);
        }
        setRotationToComplete(null);
        setRecentRotationExpenses([]);
        showToast("Turn complete");
        import("canvas-confetti")
          .then((module) => module.default?.({
            particleCount: 70,
            spread: 65,
            origin: { y: 0.65 },
            colors: ["#5F7D6A", "#8BA888", "#C0CFB2", "#D4A574"],
          }))
          .catch(() => {});
      } catch (error) {
        console.error(error);
        setRotations(previousRotations);
        setRotationHistory(previousHistory);
        showToast(error.message || "Could not complete the rotation yet");
      } finally {
        setIsCompletingRotation(false);
      }
    },
    [rotationHistory, rotationToComplete, rotations, showToast, user?.id],
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
    <main className="min-h-screen max-w-[100vw] overflow-x-hidden bg-[var(--bg)]">
      <header className="fixed inset-x-0 top-0 z-30 border-b border-[var(--border)] bg-[color:var(--surface)]/95 px-5 py-4 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-[460px] items-center justify-between">
          <button
            type="button"
            onClick={() => router.push("/groups")}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--text)] transition hover:opacity-90 active:scale-[0.98]"
            aria-label="Back to groups"
          >
            <BackIcon />
          </button>

          <div className="text-center">
            <div className="text-[22px] font-bold tracking-[-0.04em] text-[var(--text)]">
              {group?.name || "Group"}
            </div>
            <div className="mt-1 text-[14px] text-[var(--text-muted)]">
              {isRefreshing
                ? "Refreshing\u2026"
                : isTrip && tripDateRange
                  ? tripDateRange
                  : `${members.length} member${members.length === 1 ? "" : "s"}`}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsExpenseModalOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent)] text-white transition hover:opacity-90 active:scale-[0.98]"
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
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/90">
                        {isTrip ? "Trip" : "Home"}
                      </span>
                      {tripDateRange ? (
                        <span className="text-[13px] text-white/70">{tripDateRange}</span>
                      ) : null}
                    </div>
                    <h1
                      className="mt-2 max-w-[230px] text-[34px] font-semibold leading-[0.95] tracking-[-0.05em]"
                      style={{ fontFamily: "Tiempos Headline, Georgia, 'Times New Roman', serif" }}
                    >
                      {group.name}
                    </h1>
                    <p className="mt-3 max-w-[240px] text-[13px] text-white/75">
                      {memberPreview || "Just you for now"}
                    </p>
                  </div>

                  <div className="text-right">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">
                      Invite code
                    </div>
                    <div className="mt-1 font-mono text-[16px] font-bold tracking-[0.18em]">
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

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setIsQROpen(true)}
                    className="inline-flex min-h-10 items-center justify-center rounded-full bg-white px-4 text-[13px] font-semibold text-[#1C1917] whitespace-nowrap transition hover:bg-[#F3F4F6]"
                  >
                    QR code
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleShareInvite()}
                    className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-white/45 px-4 text-[13px] font-semibold text-white whitespace-nowrap transition hover:bg-white/10"
                  >
                    <ShareIcon />
                    Share
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsLeaveGroupOpen(true)}
                    className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/45 px-4 text-[13px] font-semibold text-white whitespace-nowrap transition hover:bg-white/10"
                  >
                    Leave
                  </button>
                  {membership?.role === "admin" ? (
                    <button
                      type="button"
                      onClick={() => setIsDeleteGroupOpen(true)}
                      className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/45 px-4 text-[13px] font-semibold text-white whitespace-nowrap transition hover:bg-white/10"
                    >
                      Delete
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
                  Rotations
                </div>
                <div className="mt-2 text-[26px] font-bold tracking-[-0.04em] text-[var(--text)]">
                  {rotations.length}
                </div>
              </div>
            </section>

            <div className="mt-6 flex w-full rounded-full bg-[var(--surface-muted)] p-1">
              {["expenses", "members", "rotations", "settings"].map((tab) => {
                const active = detailTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setDetailTab(tab)}
                    className={`flex-1 min-h-11 rounded-full px-2 text-[13px] font-semibold capitalize transition whitespace-nowrap ${
                      active
                        ? "bg-[var(--surface)] text-[var(--text)] shadow-[0_2px_6px_rgba(28,25,23,0.08)]"
                        : "text-[var(--text-muted)]"
                    }`}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>

            {detailTab === "expenses" ? (
              <>
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

                  {!isTrip && templates.length > 0 ? (
                    <div className="mt-4 mb-1">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                        Recurring
                      </div>
                      <div className="mt-2 space-y-2">
                        {templates.map((template) => (
                          <div
                            key={template.id}
                            className="flex items-center justify-between gap-3 rounded-[16px] border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="text-[18px]">{template.title?.match(/^\p{Emoji}/u)?.[0] || "🔁"}</span>
                              <div className="min-w-0">
                                <div className="truncate text-[14px] font-semibold text-[var(--text)]">
                                  {template.title?.replace(/^\p{Emoji}\s*/u, "") || "Recurring expense"}
                                </div>
                                <div className="text-[12px] text-[var(--text-muted)]">
                                  Monthly · {template.amount_cents ? `$${(template.amount_cents / 100).toFixed(2)}` : "variable amount"}
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={async () => {
                                await deleteExpenseTemplate(supabase, template.id);
                                setTemplates((prev) => prev.filter((t) => t.id !== template.id));
                              }}
                              className="shrink-0 rounded-full px-3 py-1.5 text-[12px] font-medium text-[var(--text-muted)] border border-[var(--border)] hover:text-[var(--danger)] hover:border-[var(--danger)] transition"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4">
                    {shouldVirtualizeExpenses ? (
                      <List
                        defaultHeight={expenseListHeight}
                        rowCount={expenses.length}
                        rowHeight={110}
                        rowComponent={ExpenseListRow}
                        rowProps={{
                          expenses,
                          members,
                          onOpenExpense: handleOpenExpense,
                          onSwitchPayer: handleOpenExpensePayerSwitch,
                        }}
                        overscanCount={4}
                        style={{ height: expenseListHeight, width: "100%" }}
                      />
                    ) : groupedExpenses.length ? (
                      <div className="space-y-5">
                        {groupedExpenses.map(([label, groupItems]) => (
                          <div key={label}>
                            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                              {label}
                            </div>
                            <div className="space-y-3">
                              {groupItems.map((expense) => (
                                <ExpenseRow
                                  key={expense.id}
                                  expense={expense}
                                  members={members}
                                  onOpenExpense={handleOpenExpense}
                                  onSwitchPayer={handleOpenExpensePayerSwitch}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {!expenses.length ? (
                      <div className="rounded-2xl bg-[var(--surface-muted)] px-4 py-4 text-[14px] text-[var(--text-muted)]">
                        No expenses yet. Add the first one and the live balances will kick in.
                      </div>
                    ) : null}
                  </div>
                </section>
              </>
            ) : null}

            {detailTab === "members" ? (
              <section className="mt-6 rounded-[28px] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]">
                <h2 className="text-[22px] font-bold tracking-[-0.04em] text-[var(--text)]">Member balances</h2>
                <p className="mt-1 text-[14px] text-[var(--text-muted)]">
                  Who&apos;s up, who&apos;s down — after all recorded settlements.
                </p>
                <div className="mt-4 space-y-2.5">
                  {members.map((member) => {
                    const balanceCents = summary.balancesByMember[member.id] ?? 0;
                    const isYou = member.id === membership?.id;
                    return (
                      <div
                        key={member.id}
                        className="flex items-center justify-between gap-4 rounded-[20px] border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3.5"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-accent)] text-[14px] font-bold text-[var(--text)]">
                            {(member.display_name || "?").charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-[15px] font-semibold text-[var(--text)]">
                              {member.display_name || "Unknown"}{isYou ? " (you)" : ""}
                            </div>
                            {member.role === "admin" ? (
                              <div className="text-[12px] text-[var(--text-muted)]">Admin</div>
                            ) : null}
                          </div>
                        </div>
                        <div
                          className={`shrink-0 text-[15px] font-bold tabular-nums ${
                            balanceCents > 0
                              ? "text-[#3D7A5C]"
                              : balanceCents < 0
                                ? "text-[var(--danger)]"
                                : "text-[var(--text-muted)]"
                          }`}
                        >
                          {balanceCents === 0 ? "Settled" : formatSignedCurrency(balanceCents / 100)}
                        </div>
                      </div>
                    );
                  })}
                  {!members.length ? (
                    <div className="rounded-2xl bg-[var(--surface-muted)] px-4 py-4 text-[14px] text-[var(--text-muted)]">
                      No members yet.
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}

            {detailTab === "rotations" ? (
              <section className="mt-6 rounded-[28px] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-[22px] font-bold tracking-[-0.04em] text-[var(--text)]">Rotations</h2>
                  <p className="mt-1 text-[14px] text-[var(--text-muted)]">
                    Keep groceries, trash, and shared chores moving without awkward check-ins.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateRotationOpen(true)}
                  className="rounded-full bg-[var(--accent)] px-4 py-2 text-[14px] font-semibold text-white transition hover:opacity-90"
                >
                  Create
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {rotationsWithPeople.length ? (
                  rotationsWithPeople.map((rotation) => (
                    <RotationCard
                      key={rotation.id}
                      rotation={rotation}
                      highlight={rotation.current_turn_user_id === user?.id}
                      onMarkComplete={handleOpenRotationComplete}
                    />
                  ))
                ) : (
                  <div className="rounded-2xl bg-[var(--surface-muted)] px-4 py-4 text-[14px] text-[var(--text-muted)]">
                    No rotations yet. Start one for groceries, trash, or cleaning and we&apos;ll keep the order moving.
                  </div>
                )}
              </div>

              {groupRotationHistory.length ? (
                <div className="mt-5 rounded-[22px] border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                  <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                    Recent rotation history
                  </div>
                  <div className="mt-3 space-y-3">
                    {groupRotationHistory.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between gap-4 text-[14px]">
                        <div>
                          <div className="font-semibold text-[var(--text)]">{entry.rotationName}</div>
                          <div className="mt-1 text-[var(--text-muted)]">
                            {entry.completedByName} completed it
                          </div>
                        </div>
                        <div className="text-[var(--text-muted)]">{formatExpenseDate(entry.completed_at)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              </section>
            ) : null}

            {detailTab === "settings" ? (
              <div className="mt-6 space-y-4">
                <section className="rounded-[28px] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">Group details</h2>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between gap-4 rounded-[18px] border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3.5">
                      <div className="text-[14px] text-[var(--text-muted)]">Name</div>
                      <div className="text-[15px] font-semibold text-[var(--text)]">{group?.name}</div>
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-[18px] border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3.5">
                      <div className="text-[14px] text-[var(--text-muted)]">Type</div>
                      <div className="text-[15px] font-semibold text-[var(--text)]">{isTrip ? "Trip" : "Home"}</div>
                    </div>
                    {tripDateRange ? (
                      <div className="flex items-center justify-between gap-4 rounded-[18px] border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3.5">
                        <div className="text-[14px] text-[var(--text-muted)]">Dates</div>
                        <div className="text-[15px] font-semibold text-[var(--text)]">{tripDateRange}</div>
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between gap-4 rounded-[18px] border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3.5">
                      <div className="text-[14px] text-[var(--text-muted)]">Members</div>
                      <div className="text-[15px] font-semibold text-[var(--text)]">{members.length}</div>
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-[18px] border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3.5">
                      <div className="text-[14px] text-[var(--text-muted)]">Expenses</div>
                      <div className="text-[15px] font-semibold text-[var(--text)]">{expenses.length}</div>
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-[18px] border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3.5">
                      <div className="text-[14px] text-[var(--text-muted)]">Invite code</div>
                      <button
                        type="button"
                        onClick={() => void handleCopyCode()}
                        className="font-mono text-[15px] font-bold tracking-[0.12em] text-[var(--accent)] transition hover:opacity-80"
                      >
                        {inviteCode}
                      </button>
                    </div>
                  </div>
                </section>

                {isTrip ? (
                  <section className="rounded-[28px] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]">
                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">Export</h2>
                    <p className="mt-3 text-[14px] leading-6 text-[var(--text-muted)]">
                      Generate a full breakdown of {group.name} — total spent, per-person shares, and settlement recommendations.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsSummaryOpen(true)}
                      className="mt-4 flex min-h-11 w-full items-center justify-center rounded-full bg-[var(--accent)] px-5 text-[15px] font-semibold text-white transition hover:opacity-90"
                    >
                      View trip summary
                    </button>
                  </section>
                ) : null}

                <section className="rounded-[28px] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">Actions</h2>
                  <div className="mt-4 space-y-3">
                    <button
                      type="button"
                      onClick={() => void handleShareInvite()}
                      className="flex min-h-11 w-full items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-5 text-[15px] font-semibold text-[var(--text)] transition hover:opacity-90"
                    >
                      Share invite link
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsLeaveGroupOpen(true)}
                      className="flex min-h-11 w-full items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-5 text-[15px] font-semibold text-[var(--danger)] transition hover:opacity-90"
                    >
                      Leave {isTrip ? "trip" : "group"}
                    </button>
                    {membership?.role === "admin" ? (
                      <button
                        type="button"
                        onClick={() => setIsDeleteGroupOpen(true)}
                        className="flex min-h-11 w-full items-center justify-center rounded-full bg-[rgba(220,38,38,0.08)] px-5 text-[15px] font-semibold text-[var(--danger)] transition hover:opacity-90"
                      >
                        Delete {isTrip ? "trip" : "group"}
                      </button>
                    ) : null}
                  </div>
                </section>
              </div>
            ) : null}
          </>
        )}

        {errorMessage ? (
          <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[14px] font-medium text-[var(--danger)]">
            {errorMessage}
          </div>
        ) : null}
      </div>

      {toast ? (
        <div className="fixed right-4 bottom-[calc(var(--safe-bottom)+80px)] z-40 rounded-full bg-[#1C1917] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_10px_20px_rgba(28,25,23,0.18)]">
          {toast}
        </div>
      ) : null}

      {isQROpen ? (
        <QRInviteModal
          isOpen={isQROpen}
          groupName={group?.name}
          inviteCode={inviteCode}
          shareLink={shareLink}
          onClose={() => setIsQROpen(false)}
        />
      ) : null}

      {isSummaryOpen ? (
        <TripSummaryModal
          isOpen={isSummaryOpen}
          group={group}
          members={members}
          expenses={expenses}
          summary={summary}
          onClose={() => setIsSummaryOpen(false)}
        />
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
          rotations={rotations}
          groupType={isTrip ? "trip" : "group"}
        />
      ) : null}

      {expenseToEdit ? (
        <AddExpenseModal
          key={`edit-${expenseToEdit.id}`}
          isOpen={Boolean(expenseToEdit)}
          onClose={() => setExpenseToEdit(null)}
          onSubmit={handleEditExpense}
          members={members}
          contexts={contexts}
          contacts={contacts}
          initialPayerId={membership?.id}
          rotations={rotations}
          initialExpense={expenseToEdit}
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
          onEdit={(expense) => {
            setSelectedExpense(null);
            setExpenseToEdit(expense);
          }}
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

      {isDeleteGroupOpen ? (
        <DeleteGroupDialog
          isOpen={isDeleteGroupOpen}
          groupName={group?.name || "This group"}
          isDeleting={isDeletingGroup}
          onCancel={() => setIsDeleteGroupOpen(false)}
          onConfirm={handleDeleteGroup}
        />
      ) : null}

      {isLeaveGroupOpen ? (
        <LeaveGroupDialog
          isOpen={isLeaveGroupOpen}
          groupName={group?.name || "This group"}
          isLeaving={isLeavingGroup}
          onCancel={() => setIsLeaveGroupOpen(false)}
          onConfirm={handleLeaveGroup}
        />
      ) : null}

      {isCreateRotationOpen ? (
        <CreateRotationModal
          key={`rotation-create-${groupId}-${members.length}`}
          isOpen={isCreateRotationOpen}
          onClose={() => setIsCreateRotationOpen(false)}
          onCreate={handleCreateRotation}
          members={members}
          isSubmitting={isCreatingRotation}
        />
      ) : null}

      {rotationToComplete ? (
        <CompleteRotationModal
          key={`rotation-complete-${rotationToComplete.id}`}
          isOpen={Boolean(rotationToComplete)}
          rotation={rotationToComplete}
          recentExpenses={recentRotationExpenses}
          onClose={() => {
            setRotationToComplete(null);
            setRecentRotationExpenses([]);
          }}
          onConfirm={handleCompleteRotation}
          isSubmitting={isCompletingRotation}
        />
      ) : null}
    </main>
  );
}
