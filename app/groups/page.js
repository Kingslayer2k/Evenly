"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import GroupCard from "../../components/GroupCard";
import RotationCard from "../../components/RotationCard";
import useLowPerformanceMode from "../../hooks/useLowPerformanceMode";
import {
  prepareCardBackgroundImage,
  readStoredCardColors,
  readStoredCardImages,
  writeStoredCardColors,
  writeStoredCardImages,
} from "../../lib/cardAppearance";
import { supabase } from "../../lib/supabase";
import {
  completeRotationRecord,
  createGroupWithMembership,
  joinGroupByCode,
  loadRecentGroupExpenses,
  loadUserGroupsBundle,
  loadUserTurnRotations,
  normalizeInviteCode,
  updateGroupCardColor,
  updateGroupCardImage,
} from "../../lib/groupData";
import {
  computeExpenseShares,
  computeBalancesForGroup,
  formatBalance,
  formatCurrencyCompact,
  getDisplayNameFromUser,
  getMemberPreview,
  getStandingCopy,
  getStableCardColor,
  needsAttention,
  sumGroupTotal,
} from "../../lib/utils";
import { pageTransition } from "../../lib/animations";

const CreateGroupModal = dynamic(() => import("../../components/CreateGroupModal"), {
  loading: () => null,
});
const JoinGroupModal = dynamic(() => import("../../components/JoinGroupModal"), {
  loading: () => null,
});
const CompleteRotationModal = dynamic(() => import("../../components/CompleteRotationModal"), {
  loading: () => null,
});

function IconButton({ children, onClick, label, spinning = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text)] transition hover:bg-[var(--surface-soft)] active:scale-[0.98]"
    >
      <div className={spinning ? "animate-spin" : ""}>{children}</div>
    </button>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 12a8 8 0 1 1-2.34-5.66" />
      <path d="M20 4v6h-6" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function AvatarIcon({ label }) {
  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-accent)] text-[15px] font-semibold text-[var(--accent-strong)]">
      {String(label || "E").slice(0, 1).toUpperCase()}
    </div>
  );
}

function FourSquaresIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9">
      <rect x="4" y="4" width="6" height="6" rx="1.4" />
      <rect x="14" y="4" width="6" height="6" rx="1.4" />
      <rect x="4" y="14" width="6" height="6" rx="1.4" />
      <rect x="14" y="14" width="6" height="6" rx="1.4" />
    </svg>
  );
}

function ImagePlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5Z" />
      <path d="m7.5 16 3.4-3.4a1 1 0 0 1 1.4 0L16.5 17" />
      <path d="m13.5 14 1.1-1.1a1 1 0 0 1 1.4 0l2 2" />
      <circle cx="9" cy="9" r="1.2" />
      <path d="M19 3v4" />
      <path d="M17 5h4" />
    </svg>
  );
}

function formatSignedCurrency(value) {
  const amount = Number(value || 0);
  const prefix = amount > 0 ? "+" : amount < 0 ? "-" : "";
  return `${prefix}$${Math.abs(amount).toFixed(2)}`;
}

function GroupPreviewOverlay({ group, openedAt, onClose, onColorChange, onImageChange }) {
  const colorInputRef = useRef(null);
  const imageInputRef = useRef(null);

  if (!group) return null;

  function handleClose() {
    if (Date.now() - openedAt < 220) return;
    onClose?.();
  }

  function stopClose(event) {
    event.stopPropagation();
  }

  async function handleImageInputChange(event) {
    stopClose(event);
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const imageData = await prepareCardBackgroundImage(file);
      await onImageChange?.(group, imageData);
    } catch (error) {
      console.error(error);
    } finally {
      event.target.value = "";
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(28,25,23,0.2)] px-6 backdrop-blur-md"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-[380px] overflow-hidden rounded-[32px] border border-white/60 shadow-[0_24px_80px_rgba(28,25,23,0.22)]"
        style={{ backgroundColor: group.cardColor }}
        onClick={stopClose}
      >
        {group.cardImage ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${group.cardImage})` }}
          />
        ) : null}

        <div className="relative bg-[rgba(28,25,23,0.18)] px-6 pt-6 pb-7 text-white">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2
                className="max-w-[220px] text-[34px] font-semibold leading-[0.94] tracking-[-0.05em]"
                style={{ fontFamily: "Tiempos Headline, Georgia, 'Times New Roman', serif" }}
              >
                {group.name}
              </h2>
              <p className="mt-3 max-w-[240px] text-[14px] text-white/85">
                {group.memberPreview || "Just you for now"}
              </p>
            </div>

            <div className={`pt-1 text-right ${group.needsAttention ? "pr-5" : ""}`}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/68">
                Total
              </div>
              <div className="mt-1 text-[20px] font-semibold tracking-[-0.03em] text-white">
                {formatCurrencyCompact(group.totalSpent)}
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={(event) => {
                stopClose(event);
                colorInputRef.current?.click();
              }}
              className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/14 px-3 py-2 text-[13px] font-semibold text-white transition hover:border-[#5F7D6A] hover:bg-[#5F7D6A]"
            >
              <FourSquaresIcon />
              Color
            </button>

            <button
              type="button"
              onClick={(event) => {
                stopClose(event);
                imageInputRef.current?.click();
              }}
              className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/14 px-3 py-2 text-[13px] font-semibold text-white transition hover:border-[#5F7D6A] hover:bg-[#5F7D6A]"
            >
              <ImagePlusIcon />
              Add image
            </button>

            <input
              ref={colorInputRef}
              type="color"
              value={group.cardColor}
              onChange={(event) => onColorChange?.(group, event.target.value)}
              className="sr-only"
              tabIndex={-1}
            />

            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={(event) => void handleImageInputChange(event)}
              className="sr-only"
              tabIndex={-1}
            />
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3">
            <div className="rounded-[22px] bg-white/16 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-white/72">
                {getStandingCopy(group.balance)}
              </div>
              <div className="mt-2 text-[32px] font-bold leading-none tracking-[-0.05em] text-white">
                {formatBalance(group.balance)}
              </div>
            </div>
            <div className="rounded-[22px] bg-white/16 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-white/72">
                Group details
              </div>
              <div className="mt-2 text-[14px] leading-6 text-white/90">
                {group.expenseCount} {group.expenseCount === 1 ? "expense" : "expenses"}
                <br />
                {group.membersCount} {group.membersCount === 1 ? "member" : "members"}
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between gap-4 text-[12px] font-medium leading-[1.2] text-white/82">
            <div className="truncate">code {group.code}</div>
            <div className="shrink-0">tap anywhere to close</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GroupsPage() {
  const router = useRouter();
  const reduceMotion = useLowPerformanceMode();
  const toastTimeoutRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const [user, setUser] = useState(null);
  const [profileName, setProfileName] = useState("");
  const [groups, setGroups] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [membersByGroup, setMembersByGroup] = useState({});
  const [expensesByGroup, setExpensesByGroup] = useState({});
  const [cardColors, setCardColors] = useState({});
  const [cardImages, setCardImages] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [toast, setToast] = useState("");
  const [inviteCodeFromUrl, setInviteCodeFromUrl] = useState("");
  const [pendingInviteCode, setPendingInviteCode] = useState("");
  const [prefillJoinCode, setPrefillJoinCode] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createMode, setCreateMode] = useState("group");
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [previewState, setPreviewState] = useState({ group: null, openedAt: 0 });
  const [turnRotations, setTurnRotations] = useState([]);
  const [rotationToComplete, setRotationToComplete] = useState(null);
  const [recentRotationExpenses, setRecentRotationExpenses] = useState([]);
  const [isCompletingRotation, setIsCompletingRotation] = useState(false);

  const showToast = useCallback((message) => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    setToast(message);
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast("");
    }, 2400);
  }, []);

  const persistCardColor = useCallback((groupId, color) => {
    setCardColors((previous) => {
      const next = {
        ...previous,
        [groupId]: color,
      };
      writeStoredCardColors(next);
      return next;
    });
  }, []);

  const persistCardImage = useCallback((groupId, imageData) => {
    setCardImages((previous) => {
      const next = {
        ...previous,
        [groupId]: imageData,
      };
      writeStoredCardImages(next);
      return next;
    });
  }, []);

  const loadGroupsData = useCallback(
    async (currentUser, options = {}) => {
      if (!supabase || !currentUser) {
        setProfileName("");
        setGroups([]);
        setMemberships([]);
        setMembersByGroup({});
        setExpensesByGroup({});
        setTurnRotations([]);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      if (options.refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setErrorMessage("");

      try {
        const [bundle, nextTurnRotations] = await Promise.all([
          loadUserGroupsBundle(supabase, currentUser),
          loadUserTurnRotations(supabase, currentUser),
        ]);
        setProfileName(bundle.profileName);
        setGroups(bundle.groups);
        setMemberships(bundle.memberships);
        setMembersByGroup(bundle.membersByGroup);
        setExpensesByGroup(bundle.expensesByGroup);
        setTurnRotations(nextTurnRotations);
      } catch (error) {
        console.error(error);
        setErrorMessage(error.message || "Could not load your groups yet.");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [],
  );

  const scheduleRefresh = useCallback(
    (currentUser) => {
      if (!currentUser || typeof window === "undefined") return;
      if (refreshTimerRef.current) return;

      refreshTimerRef.current = window.setTimeout(() => {
        refreshTimerRef.current = null;
        void loadGroupsData(currentUser, { refresh: true });
      }, 180);
    },
    [loadGroupsData],
  );

  useEffect(() => {
    setCardColors(readStoredCardColors());
    setCardImages(readStoredCardImages());
  }, []);

  useEffect(() => {
    router.prefetch("/activity");
    router.prefetch("/people");
    router.prefetch("/settings");
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const nextInviteCode = normalizeInviteCode(params.get("join") || params.get("code") || "");
    const composeMode = params.get("compose");
    if (composeMode === "trip" || composeMode === "group") {
      setCreateMode(composeMode);
      setIsCreateOpen(true);
      router.replace("/groups");
    }
    if (nextInviteCode) {
      setInviteCodeFromUrl(nextInviteCode);
      setPendingInviteCode(nextInviteCode);
    }
  }, [router]);

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
        await loadGroupsData(nextUser);
      } else {
        setIsLoading(false);
      }
    }

    void bootstrapAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user || null;
      setUser(nextUser);

      if (nextUser) {
        void loadGroupsData(nextUser);
      } else {
        setProfileName("");
        setGroups([]);
        setMemberships([]);
        setMembersByGroup({});
        setExpensesByGroup({});
        setTurnRotations([]);
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
  }, [loadGroupsData]);

  useEffect(() => {
    if (!supabase || !user) return undefined;

    const channel = supabase
      .channel(`evenly-groups-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "groups" },
        () => scheduleRefresh(user),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_members" },
        () => scheduleRefresh(user),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "expenses" },
        () => scheduleRefresh(user),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [scheduleRefresh, user]);

  useEffect(() => {
    if (!pendingInviteCode || !user) return;
    setPrefillJoinCode(pendingInviteCode);
    setIsJoinOpen(true);
  }, [pendingInviteCode, user]);

  const displayGroups = useMemo(() => {
    return groups.map((group, index) => {
      const groupMembers = membersByGroup[group.id] || [];
      const groupExpenses = expensesByGroup[group.id] || [];
      const myMembership = memberships.find((membership) => membership.group_id === group.id);
      const balancesByMember = computeBalancesForGroup(groupMembers, groupExpenses);
      const currentBalance = myMembership ? Number(balancesByMember[myMembership.id] || 0) / 100 : 0;
      const totalSpent = sumGroupTotal(groupExpenses);

      const rawMode = String(group.group_type || group.type || "").toLowerCase();
      const groupMode = rawMode === "trip" ? "trip" : "group";
      const tripDateLabel =
        groupMode === "trip"
          ? [group.start_date, group.end_date, group.starts_at, group.ends_at]
              .filter(Boolean)
              .slice(0, 2)
              .join(" → ")
          : "";

      return {
        ...group,
        mode: groupMode,
        tripDateLabel,
        code: group.join_code || group.code || "------",
        memberPreview: getMemberPreview(groupMembers) || "Just you for now",
        membersCount: groupMembers.length,
        expenseCount: groupExpenses.length,
        totalSpent,
        balance: currentBalance,
        cardColor:
          group.card_color ||
          group.color ||
          cardColors[group.id] ||
          getStableCardColor(group.id || group.name, index),
        cardImage:
          group.card_image ||
          group.background_image ||
          group.image_url ||
          cardImages[group.id] ||
          "",
        needsAttention: needsAttention(currentBalance),
      };
    });
  }, [cardColors, cardImages, expensesByGroup, groups, membersByGroup, memberships]);

  const homeMetrics = useMemo(() => {
    const membershipByGroupId = new Map(memberships.map((membership) => [membership.group_id, membership.id]));
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    let monthSpent = 0;
    let monthExpenseCount = 0;

    for (const [groupId, groupExpenses] of Object.entries(expensesByGroup || {})) {
      const membershipId = membershipByGroupId.get(groupId);
      if (!membershipId) continue;

      for (const expense of groupExpenses || []) {
        const createdAt = expense.created_at ? new Date(expense.created_at) : null;
        if (createdAt && createdAt < startOfMonth) continue;

        monthExpenseCount += 1;

        const shares = computeExpenseShares(expense);
        monthSpent += Number(shares[membershipId] || 0) / 100;
      }
    }

    const netBalance = displayGroups.reduce((sum, group) => sum + Number(group.balance || 0), 0);
    const actionGroup =
      [...displayGroups]
        .filter((group) => group.needsAttention)
        .sort((left, right) => Math.abs(right.balance) - Math.abs(left.balance))[0] || null;

    return {
      activeGroupCount: displayGroups.length,
      netBalance,
      monthSpent,
      monthExpenseCount,
      actionGroup,
    };
  }, [displayGroups, expensesByGroup, memberships]);

  const stackHeight = useMemo(
    () => (displayGroups.length ? 252 + Math.max(0, displayGroups.length - 1) * 64 : 0),
    [displayGroups.length],
  );

  const stackGap = 64;
  const homeSubtitle =
    homeMetrics.netBalance > 0
      ? "You’re owed across your shared spaces."
      : homeMetrics.netBalance < 0
        ? "You’ve got a couple balances to clear."
        : "You’re settled up everywhere.";

  useEffect(() => {
    displayGroups.slice(0, 4).forEach((group) => {
      router.prefetch(`/groups/${group.id}`);
    });
  }, [displayGroups, router]);

  const handleRefresh = useCallback(async () => {
    if (!user) return;
    await loadGroupsData(user, { refresh: true });
    showToast("Groups refreshed");
  }, [loadGroupsData, showToast, user]);

  const handleOpenRotationComplete = useCallback(async (rotation) => {
    setRotationToComplete(rotation);

    try {
      const recentExpenses = await loadRecentGroupExpenses(supabase, rotation.group_id, 6);
      setRecentRotationExpenses(recentExpenses);
    } catch (error) {
      console.error(error);
      setRecentRotationExpenses([]);
    }
  }, []);

  const handleCompleteRotation = useCallback(
    async ({ linkedExpenseId, note }) => {
      if (!supabase || !rotationToComplete || !user?.id) return;

      const previousRotations = turnRotations;
      setIsCompletingRotation(true);
      setTurnRotations((current) => current.filter((rotation) => rotation.id !== rotationToComplete.id));

      try {
        await completeRotationRecord(supabase, rotationToComplete, {
          completedBy: user.id,
          linkedExpenseId,
          note,
        });
        setRotationToComplete(null);
        setRecentRotationExpenses([]);
        await loadGroupsData(user, { refresh: true });
        import("canvas-confetti")
          .then((module) => module.default?.({
            particleCount: 70,
            spread: 58,
            origin: { y: 0.66 },
            colors: ["#5F7D6A", "#8BA888", "#C0CFB2", "#D4A574"],
          }))
          .catch(() => {});
        showToast("Turn completed");
      } catch (error) {
        console.error(error);
        setTurnRotations(previousRotations);
        showToast("Could not complete that turn yet");
      } finally {
        setIsCompletingRotation(false);
      }
    },
    [loadGroupsData, rotationToComplete, showToast, turnRotations, user],
  );

  const handleOpenGroup = useCallback(
    (group) => {
      router.push(`/groups/${group.id}`);
    },
    [router],
  );

  const handleCreateGroup = useCallback(
    async ({ name, mode, tripStartDate, tripEndDate, color, imageData }) => {
      if (!supabase || !user) {
        return { ok: false, message: "Sign in first so we can create the group." };
      }

      try {
        const { group, code } = await createGroupWithMembership(supabase, user, profileName, name, {
          mode,
          tripStartDate,
          tripEndDate,
        });
        persistCardColor(group.id, color);
        if (imageData) {
          persistCardImage(group.id, imageData);
        }
        const syncedColor = await updateGroupCardColor(supabase, group.id, color);
        if (!syncedColor) {
          showToast("Color saved on this device. Shared sync still needs a backend field.");
        }
        if (imageData) {
          const syncedImage = await updateGroupCardImage(supabase, group.id, imageData);
          if (!syncedImage) {
            showToast("Image saved on this device. Shared sync still needs a backend field.");
          }
        }
        await loadGroupsData(user, { refresh: true });
        showToast(`${name} is ready`);

        return {
          ok: true,
          code,
        };
      } catch (error) {
        console.error(error);
        return {
          ok: false,
          message: error.message || "Could not create the group right now.",
        };
      }
    },
    [loadGroupsData, persistCardColor, persistCardImage, profileName, showToast, user],
  );

  const handleJoinGroup = useCallback(
    async (rawCode) => {
      if (!supabase || !user) {
        return { ok: false, message: "Sign in first so we can join the group." };
      }

      try {
        const joinedGroup = await joinGroupByCode(supabase, user, profileName, rawCode);
        await loadGroupsData(user, { refresh: true });
        setPendingInviteCode("");
        setPrefillJoinCode("");
        if (inviteCodeFromUrl) {
          router.replace("/groups");
        }
        showToast(`Joined ${joinedGroup.name}`);
        return { ok: true };
      } catch (error) {
        console.error(error);
        return {
          ok: false,
          message: error.message || "Could not join the group right now.",
        };
      }
    },
    [inviteCodeFromUrl, loadGroupsData, profileName, router, showToast, user],
  );

  const handleOpenSettings = useCallback(() => {
    router.push("/settings");
  }, [router]);

  const handleCloseJoinModal = useCallback(() => {
    setIsJoinOpen(false);
    if (inviteCodeFromUrl) {
      setPendingInviteCode("");
      setPrefillJoinCode("");
      router.replace("/groups");
    }
  }, [inviteCodeFromUrl, router]);

  const handleCardColorChange = useCallback(
    async (group, nextColor) => {
      persistCardColor(group.id, nextColor);
      const syncedColor = await updateGroupCardColor(supabase, group.id, nextColor);
      setPreviewState((previous) =>
        previous.group?.id === group.id
          ? {
              ...previous,
              group: {
                ...previous.group,
                cardColor: nextColor,
              },
            }
          : previous,
      );
      showToast(
        syncedColor
          ? `${group.name} card updated`
          : `${group.name} color saved here. Shared sync still needs a backend field.`,
      );
    },
    [persistCardColor, showToast],
  );

  const handleCardImageChange = useCallback(
    async (group, imageData) => {
      persistCardImage(group.id, imageData);
      const syncedImage = await updateGroupCardImage(supabase, group.id, imageData);
      setPreviewState((previous) =>
        previous.group?.id === group.id
          ? {
              ...previous,
              group: {
                ...previous.group,
                cardImage: imageData,
              },
            }
          : previous,
      );
      showToast(
        syncedImage
          ? `${group.name} background updated`
          : `${group.name} image saved here. Shared sync still needs a backend field.`,
      );
    },
    [persistCardImage, showToast],
  );

  const handlePreviewGroup = useCallback((group) => {
    setPreviewState({
      group,
      openedAt: Date.now(),
    });
  }, []);

  const handleClosePreview = useCallback(() => {
    setPreviewState({ group: null, openedAt: 0 });
  }, []);

  return (
    <motion.main
      className="min-h-screen max-w-[100vw] overflow-x-hidden bg-[var(--bg)]"
      initial={reduceMotion ? false : pageTransition.initial}
      animate={reduceMotion ? undefined : pageTransition.animate}
      transition={pageTransition.transition}
    >
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[color:var(--surface)]/94 px-5 py-3 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-[420px] items-center justify-between">
          <div>
            <div
              className="text-[24px] font-semibold leading-none tracking-[-0.04em] text-[var(--accent-strong)]"
              style={{ fontFamily: "Tiempos Headline, Georgia, 'Times New Roman', serif" }}
            >
              Evenly
            </div>
            <div className="mt-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">
              Home
            </div>
          </div>

          <div className="flex items-center gap-2">
            <IconButton label="Refresh home" onClick={() => void handleRefresh()} spinning={isRefreshing}>
              <RefreshIcon />
            </IconButton>
            <button
              type="button"
              onClick={handleOpenSettings}
              aria-label="Open settings"
              className="rounded-full transition active:scale-[0.98]"
            >
              <AvatarIcon label={profileName || getDisplayNameFromUser(user, "") || "E"} />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[420px] px-5 pt-5 pb-28">
        {user ? (
          <>
            <section className="rounded-[30px] border border-[var(--border)] bg-[linear-gradient(180deg,var(--surface)_0%,var(--surface-soft)_100%)] px-5 py-6 shadow-[var(--shadow-soft)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    Hi {profileName || getDisplayNameFromUser(user, "") || "there"}
                  </div>
                  <div className="mt-2 text-[24px] font-bold tracking-[-0.04em] text-[var(--text)]">
                    {homeSubtitle}
                  </div>
                </div>
                {homeMetrics.actionGroup ? (
                  <div className="rounded-full bg-[#EAF2EC] px-3 py-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#3A4E43]">
                    Action needed
                  </div>
                ) : null}
              </div>

              <div className="mt-6 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                Net balance
              </div>
              <div
                className={`mt-2 text-[46px] font-bold leading-none tracking-[-0.06em] ${
                  homeMetrics.netBalance > 0
                    ? "text-[var(--success)]"
                    : homeMetrics.netBalance < 0
                      ? "text-[var(--danger)]"
                      : "text-[var(--text)]"
                }`}
              >
                {formatSignedCurrency(homeMetrics.netBalance)}
              </div>
              <div className="mt-2 text-[13px] text-[var(--text-soft)]">
                across {homeMetrics.activeGroupCount} {homeMetrics.activeGroupCount === 1 ? "group" : "groups"}
              </div>
            </section>

            {homeMetrics.activeGroupCount ? (
              <section className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] px-4 py-4 shadow-[var(--shadow-soft)]">
                  <div className="text-[18px] font-semibold tracking-[-0.04em] text-[var(--text)]">
                    ${Math.round(homeMetrics.monthSpent)}
                  </div>
                  <div className="mt-1 text-[12px] font-medium text-[var(--text-muted)]">spent this month</div>
                </div>
                <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] px-4 py-4 shadow-[var(--shadow-soft)]">
                  <div className="text-[18px] font-semibold tracking-[-0.04em] text-[var(--text)]">
                    {homeMetrics.activeGroupCount}
                  </div>
                  <div className="mt-1 text-[12px] font-medium text-[var(--text-muted)]">active groups</div>
                </div>
                <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] px-4 py-4 shadow-[var(--shadow-soft)]">
                  <div className="text-[18px] font-semibold tracking-[-0.04em] text-[var(--text)]">
                    {homeMetrics.monthExpenseCount}
                  </div>
                  <div className="mt-1 text-[12px] font-medium text-[var(--text-muted)]">expenses this month</div>
                </div>
              </section>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  setCreateMode("group");
                  setIsCreateOpen(true);
                }}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-4 text-[15px] font-semibold text-white transition hover:bg-[var(--accent-strong)] active:scale-[0.98]"
              >
                <PlusIcon />
                Create group
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreateMode("trip");
                  setIsCreateOpen(true);
                }}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-[15px] font-semibold text-[var(--text)] transition hover:bg-[var(--surface-soft)] active:scale-[0.98]"
              >
                <PlusIcon />
                Create trip
              </button>
              <button
                type="button"
                onClick={() => setIsJoinOpen(true)}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-[15px] font-semibold text-[var(--text)] transition hover:bg-[var(--surface-soft)] active:scale-[0.98]"
              >
                Join by code
              </button>
            </div>

            {homeMetrics.actionGroup ? (
              <section className="mt-5">
                <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Action needed
                </div>
                <div className="mt-3 rounded-[24px] border border-[rgba(0,112,243,0.18)] bg-[var(--surface)] px-5 py-5 shadow-[var(--shadow-soft)]">
                  <div className="text-[15px] font-semibold text-[var(--text)]">{homeMetrics.actionGroup.name}</div>
                  <div className="mt-3 text-[14px] text-[var(--text-muted)]">
                    {homeMetrics.actionGroup.balance < 0 ? "You owe this group" : "You’re owed in this group"}
                  </div>
                  <div className="mt-1 text-[30px] font-bold tracking-[-0.05em] text-[var(--text)]">
                    {formatSignedCurrency(homeMetrics.actionGroup.balance)}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenGroup(homeMetrics.actionGroup)}
                    className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-[#0070F3] px-5 text-[15px] font-semibold text-white transition hover:opacity-90 active:scale-[0.98]"
                  >
                    Settle now
                  </button>
                </div>
              </section>
            ) : null}

            {turnRotations.length ? (
              <section className="mt-5">
                <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Whose turn?
                </div>
                <div className="mt-1 text-[18px] font-semibold tracking-[-0.03em] text-[var(--text)]">
                  Shared jobs that need attention
                </div>
                <div className="mt-3 space-y-3">
                  {turnRotations.slice(0, 2).map((rotation) => (
                    <RotationCard
                      key={rotation.id}
                      rotation={rotation}
                      highlight
                      onMarkComplete={handleOpenRotationComplete}
                      showGroupName
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : null}

        {!supabase ? (
          <section className="pt-8">
            <div className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)]">
              <h2 className="text-[24px] font-bold text-[var(--text)]">Connect Supabase first</h2>
              <p className="mt-3 text-[15px] leading-6 text-[var(--text-muted)]">
                Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`
                or Vercel, then reload this page.
              </p>
            </div>
          </section>
        ) : isLoading ? (
          <section className="pt-8">
            <div className="mx-auto w-[88%] max-w-[360px]">
              <div className="aspect-[3.375/2.125] animate-pulse rounded-[28px] border border-[var(--border)] bg-[var(--surface)]" />
              <div className="-mt-[194px] ml-0 aspect-[3.375/2.125] animate-pulse rounded-[28px] border border-[var(--border)] bg-[var(--surface-muted)]" />
              <div className="-mt-[194px] ml-0 aspect-[3.375/2.125] animate-pulse rounded-[28px] border border-[var(--border)] bg-[var(--surface-soft)]" />
            </div>
          </section>
        ) : !user ? (
          <section className="pt-8">
            <div className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)]">
              <h2 className="text-[24px] font-bold text-[var(--text)]">Sign in to see your groups</h2>
              <p className="mt-3 text-[15px] leading-6 text-[var(--text-muted)]">
                Log in on the welcome screen, then come right back here.
              </p>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="mt-6 rounded-full bg-[var(--surface-accent)] px-5 py-3 text-[15px] font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--accent-soft-hover)] active:scale-[0.98]"
              >
                Back to welcome
              </button>
            </div>
          </section>
        ) : displayGroups.length === 0 ? (
          <section className="pt-8">
            <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
              Your groups
            </div>

            <div className="mt-4 space-y-4">
              <button
                type="button"
                onClick={() => {
                  setCreateMode("trip");
                  setIsCreateOpen(true);
                }}
                className="mx-auto flex w-[88%] max-w-[360px] items-center justify-center rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-6 text-center shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:border-[var(--accent)] hover:bg-[var(--surface-soft)] active:scale-[0.99]"
              >
                <div className="w-full rounded-[24px] bg-[var(--surface-soft)] px-6 py-6">
                  <div className="text-[22px] font-semibold text-[var(--text)]">Create your first trip</div>
                  <p className="mt-2 text-[14px] leading-5 text-[var(--text-muted)]">
                    Competitions, vacations, and short-run spending in one shared card.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCreateMode("group");
                  setIsCreateOpen(true);
                }}
                className="mx-auto flex w-[88%] max-w-[360px] items-center justify-center rounded-[28px] border border-dashed border-[var(--border)] bg-[var(--surface)] p-6 text-center shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:border-[var(--accent)] hover:bg-[var(--surface-soft)] active:scale-[0.99]"
              >
                <div className="w-full rounded-[24px] border border-dashed border-[var(--border)] bg-[var(--surface-soft)] px-6 py-6">
                  <div className="flex h-full flex-col items-center justify-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-accent)] text-[var(--accent-strong)]">
                      <PlusIcon />
                    </div>
                    <h2 className="mt-5 text-[22px] font-semibold text-[var(--text)]">
                      Create your first group
                    </h2>
                    <p className="mt-2 max-w-[230px] text-[14px] leading-5 text-[var(--text-muted)]">
                      Start with roommates, housemates, or the people you split every month with.
                    </p>
                  </div>
                </div>
              </button>
            </div>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setIsJoinOpen(true)}
                className="text-[15px] font-semibold text-[var(--accent)] transition hover:text-[var(--accent-strong)]"
              >
                Join with a code instead
              </button>
            </div>
          </section>
        ) : (
          <section className="pt-8">
            <div className="mb-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
              Your groups
            </div>
            <div className="mx-auto w-[88%] max-w-[360px]">
              <div className="relative" style={{ height: `${stackHeight}px` }}>
                {displayGroups.map((group, index) => (
                  <div
                    key={group.id}
                    className="absolute inset-x-0"
                    style={{
                      top: `${(displayGroups.length - 1 - index) * stackGap}px`,
                      zIndex: displayGroups.length - index,
                    }}
                  >
                    <GroupCard
                      group={group}
                      onClick={handleOpenGroup}
                      onPreview={handlePreviewGroup}
                      onColorChange={handleCardColorChange}
                      onImageChange={handleCardImageChange}
                      collapsed={index > 0}
                      isTopCard={index === 0}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 text-center">
              <div className="mt-2 text-[13px] text-[var(--text-soft)]">
                Tap a card to open it. Press and hold to peek. Tap <span className="font-semibold text-[var(--text-muted)]">Color</span> to change the top card.
              </div>
            </div>
          </section>
        )}

        {errorMessage ? (
          <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[14px] font-medium text-[var(--danger)]">
            {errorMessage}
          </div>
        ) : null}
      </div>

      {toast ? (
        <div className="fixed right-4 bottom-[calc(var(--safe-bottom)+80px)] z-40 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[13px] font-semibold text-[var(--text)] shadow-[var(--shadow-soft)]">
          {toast}
        </div>
      ) : null}

      {isCreateOpen ? (
        <CreateGroupModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onCreate={handleCreateGroup}
          mode={createMode}
        />
      ) : null}

      {isJoinOpen ? (
        <JoinGroupModal
          isOpen={isJoinOpen}
          onClose={handleCloseJoinModal}
          onJoin={handleJoinGroup}
          initialCode={prefillJoinCode}
        />
      ) : null}

      <GroupPreviewOverlay
        group={previewState.group}
        openedAt={previewState.openedAt}
        onClose={handleClosePreview}
        onColorChange={handleCardColorChange}
        onImageChange={handleCardImageChange}
      />

      {rotationToComplete ? (
        <CompleteRotationModal
          key={`home-rotation-${rotationToComplete.id}`}
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
    </motion.main>
  );
}
