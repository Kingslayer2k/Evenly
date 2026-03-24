"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import GroupCard from "../../components/GroupCard";
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
  createGroupWithMembership,
  joinGroupByCode,
  loadUserGroupsBundle,
  normalizeInviteCode,
  updateGroupCardColor,
  updateGroupCardImage,
} from "../../lib/groupData";
import {
  computeBalancesForGroup,
  formatBalance,
  formatCurrencyCompact,
  getMemberPreview,
  getStableCardColor,
  needsAttention,
  sumGroupTotal,
} from "../../lib/utils";
import { pageTransition } from "../../lib/animations";
import { readRuntimeCacheStale } from "../../lib/runtimeCache";

const CreateGroupModal = dynamic(() => import("../../components/CreateGroupModal"), {
  loading: () => null,
});
const JoinGroupModal = dynamic(() => import("../../components/JoinGroupModal"), {
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
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" />
    </svg>
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
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${group.cardImage})` }} />
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
            <div className="pt-1 text-right">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/68">Total</div>
              <div className="mt-1 text-[20px] font-semibold tracking-[-0.03em] text-white">
                {formatCurrencyCompact(group.totalSpent)}
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={(event) => { stopClose(event); colorInputRef.current?.click(); }}
              className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/14 px-3 py-2 text-[13px] font-semibold text-white transition hover:border-[#5F7D6A] hover:bg-[#5F7D6A]"
            >
              <FourSquaresIcon />
              Color
            </button>
            <button
              type="button"
              onClick={(event) => { stopClose(event); imageInputRef.current?.click(); }}
              className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/14 px-3 py-2 text-[13px] font-semibold text-white transition hover:border-[#5F7D6A] hover:bg-[#5F7D6A]"
            >
              <ImagePlusIcon />
              Add image
            </button>
            <input ref={colorInputRef} type="color" value={group.cardColor} onChange={(event) => onColorChange?.(group, event.target.value)} className="sr-only" tabIndex={-1} />
            <input ref={imageInputRef} type="file" accept="image/*" onChange={(event) => void handleImageInputChange(event)} className="sr-only" tabIndex={-1} />
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3">
            <div className="rounded-[22px] bg-white/16 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-white/72">Your balance</div>
              <div className="mt-2 text-[32px] font-bold leading-none tracking-[-0.05em] text-white">
                {formatBalance(group.balance)}
              </div>
            </div>
            <div className="rounded-[22px] bg-white/16 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-white/72">Details</div>
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

  const showToast = useCallback((message) => {
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
    setToast(message);
    toastTimeoutRef.current = window.setTimeout(() => setToast(""), 2400);
  }, []);

  const persistCardColor = useCallback((groupId, color) => {
    setCardColors((previous) => {
      const next = { ...previous, [groupId]: color };
      writeStoredCardColors(next);
      return next;
    });
  }, []);

  const persistCardImage = useCallback((groupId, imageData) => {
    setCardImages((previous) => {
      const next = { ...previous, [groupId]: imageData };
      writeStoredCardImages(next);
      return next;
    });
  }, []);

  const loadGroupsData = useCallback(async (currentUser, options = {}) => {
    if (!supabase || !currentUser) {
      setProfileName("");
      setGroups([]);
      setMemberships([]);
      setMembersByGroup({});
      setExpensesByGroup({});
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    setErrorMessage("");

    if (!options.refresh) {
      const staleBundle = readRuntimeCacheStale(`groups:${currentUser.id}`);
      if (staleBundle) {
        setProfileName(staleBundle.profileName);
        setGroups(staleBundle.groups);
        setMemberships(staleBundle.memberships);
        setMembersByGroup(staleBundle.membersByGroup);
        setExpensesByGroup(staleBundle.expensesByGroup);
        setIsLoading(false);
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
    } else {
      setIsRefreshing(true);
    }

    try {
      const bundle = await loadUserGroupsBundle(supabase, currentUser);
      setProfileName(bundle.profileName);
      setGroups(bundle.groups);
      setMemberships(bundle.memberships);
      setMembersByGroup(bundle.membersByGroup);
      setExpensesByGroup(bundle.expensesByGroup);
    } catch (error) {
      console.error(error);
      setErrorMessage(error.message || "Could not load your groups yet.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const scheduleRefresh = useCallback((currentUser) => {
    if (!currentUser || typeof window === "undefined") return;
    if (refreshTimerRef.current) return;
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      void loadGroupsData(currentUser, { refresh: true });
    }, 180);
  }, [loadGroupsData]);

  useEffect(() => {
    setCardColors(readStoredCardColors());
    setCardImages(readStoredCardImages());
  }, []);

  useEffect(() => {
    router.prefetch("/home");
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
      window.localStorage.setItem("evenly-pending-join", nextInviteCode);
    } else {
      const stored = normalizeInviteCode(window.localStorage.getItem("evenly-pending-join") || "");
      if (stored) setPendingInviteCode(stored);
    }
  }, [router]);

  useEffect(() => {
    if (!supabase) { setIsLoading(false); return; }
    let isMounted = true;

    async function bootstrapAuth() {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;
      const nextUser = data.session?.user || null;
      setUser(nextUser);
      if (nextUser) await loadGroupsData(nextUser);
      else setIsLoading(false);
    }

    void bootstrapAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user || null;
      setUser(nextUser);
      if (nextUser) void loadGroupsData(nextUser);
      else { setProfileName(""); setGroups([]); setMemberships([]); setMembersByGroup({}); setExpensesByGroup({}); setIsLoading(false); }
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
      if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
    };
  }, [loadGroupsData]);

  useEffect(() => {
    if (!supabase || !user) return undefined;
    const channel = supabase
      .channel(`evenly-groups-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "groups" }, () => scheduleRefresh(user))
      .on("postgres_changes", { event: "*", schema: "public", table: "group_members" }, () => scheduleRefresh(user))
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, () => scheduleRefresh(user))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
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
      const myMembership = memberships.find((m) => m.group_id === group.id);
      const balancesByMember = computeBalancesForGroup(groupMembers, groupExpenses);
      const currentBalance = myMembership ? Number(balancesByMember[myMembership.id] || 0) / 100 : 0;
      const totalSpent = sumGroupTotal(groupExpenses);

      const rawMode = String(group.group_type || group.type || "").toLowerCase();
      const groupMode = rawMode === "trip" ? "trip" : "group";
      const tripDateLabel =
        groupMode === "trip"
          ? [group.start_date, group.end_date, group.starts_at, group.ends_at]
              .filter(Boolean).slice(0, 2).join(" → ")
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
        cardColor: group.card_color || group.color || cardColors[group.id] || getStableCardColor(group.id || group.name, index),
        cardImage: group.card_image || group.background_image || group.image_url || cardImages[group.id] || "",
        needsAttention: needsAttention(currentBalance),
      };
    });
  }, [cardColors, cardImages, expensesByGroup, groups, membersByGroup, memberships]);

  const stackHeight = useMemo(
    () => (displayGroups.length ? 252 + Math.max(0, displayGroups.length - 1) * 64 : 0),
    [displayGroups.length],
  );

  const stackGap = 64;

  useEffect(() => {
    displayGroups.slice(0, 4).forEach((group) => router.prefetch(`/groups/${group.id}`));
  }, [displayGroups, router]);

  const handleRefresh = useCallback(async () => {
    if (!user) return;
    await loadGroupsData(user, { refresh: true });
    showToast("Refreshed");
  }, [loadGroupsData, showToast, user]);

  const handleOpenGroup = useCallback((group) => {
    router.push(`/groups/${group.id}`);
  }, [router]);

  const handleCreateGroup = useCallback(async ({ name, mode, tripStartDate, tripEndDate, color, imageData }) => {
    if (!supabase || !user) return { ok: false, message: "Sign in first." };
    try {
      const { group, code } = await createGroupWithMembership(supabase, user, profileName, name, { mode, tripStartDate, tripEndDate });
      persistCardColor(group.id, color);
      if (imageData) persistCardImage(group.id, imageData);
      await updateGroupCardColor(supabase, group.id, color);
      if (imageData) await updateGroupCardImage(supabase, group.id, imageData);
      await loadGroupsData(user, { refresh: true });
      showToast(`${name} is ready`);
      return { ok: true, code };
    } catch (error) {
      console.error(error);
      return { ok: false, message: error.message || "Could not create the group right now." };
    }
  }, [loadGroupsData, persistCardColor, persistCardImage, profileName, showToast, user]);

  const handleJoinGroup = useCallback(async (rawCode) => {
    if (!supabase || !user) return { ok: false, message: "Sign in first." };
    try {
      const joinedGroup = await joinGroupByCode(supabase, user, profileName, rawCode);
      await loadGroupsData(user, { refresh: true });
      setPendingInviteCode("");
      setPrefillJoinCode("");
      window.localStorage.removeItem("evenly-pending-join");
      if (inviteCodeFromUrl) router.replace("/groups");
      showToast(`Joined ${joinedGroup.name}`);
      return { ok: true };
    } catch (error) {
      console.error(error);
      return { ok: false, message: error.message || "Could not join the group right now." };
    }
  }, [inviteCodeFromUrl, loadGroupsData, profileName, router, showToast, user]);

  const handleCloseJoinModal = useCallback(() => {
    setIsJoinOpen(false);
    setPendingInviteCode("");
    setPrefillJoinCode("");
    window.localStorage.removeItem("evenly-pending-join");
    if (inviteCodeFromUrl) router.replace("/groups");
  }, [inviteCodeFromUrl, router]);

  const handleCardColorChange = useCallback(async (group, nextColor) => {
    persistCardColor(group.id, nextColor);
    const synced = await updateGroupCardColor(supabase, group.id, nextColor);
    setPreviewState((prev) =>
      prev.group?.id === group.id ? { ...prev, group: { ...prev.group, cardColor: nextColor } } : prev,
    );
    showToast(synced ? `${group.name} updated` : `${group.name} color saved here.`);
  }, [persistCardColor, showToast]);

  const handleCardImageChange = useCallback(async (group, imageData) => {
    persistCardImage(group.id, imageData);
    const synced = await updateGroupCardImage(supabase, group.id, imageData);
    setPreviewState((prev) =>
      prev.group?.id === group.id ? { ...prev, group: { ...prev.group, cardImage: imageData } } : prev,
    );
    showToast(synced ? `${group.name} updated` : `${group.name} image saved here.`);
  }, [persistCardImage, showToast]);

  const handlePreviewGroup = useCallback((group) => {
    setPreviewState({ group, openedAt: Date.now() });
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
        <div className="mx-auto flex w-full max-w-[460px] items-center justify-between">
          <div>
            <div className="text-[22px] font-bold tracking-[-0.04em] text-[var(--text)]">Groups</div>
            <div className="text-[13px] text-[var(--text-muted)]">
              {displayGroups.length ? `${displayGroups.length} active` : "Create or join one"}
            </div>
          </div>
          <IconButton label="Refresh" onClick={() => void handleRefresh()} spinning={isRefreshing}>
            <RefreshIcon />
          </IconButton>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[460px] px-5 pt-5 pb-28">
        {/* Action buttons */}
        {user && (
          <div className="mb-6 flex gap-2">
            <button
              type="button"
              onClick={() => { setCreateMode("choose"); setIsCreateOpen(true); }}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-[var(--accent)] px-3 text-[14px] font-semibold text-white whitespace-nowrap transition hover:bg-[var(--accent-strong)] active:scale-[0.98]"
            >
              <PlusIcon />
              New
            </button>
            <button
              type="button"
              onClick={() => setIsJoinOpen(true)}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-[14px] font-semibold text-[var(--text)] whitespace-nowrap transition hover:bg-[var(--surface-soft)] active:scale-[0.98]"
            >
              Join
            </button>
          </div>
        )}

        {/* States */}
        {!supabase ? (
          <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)]">
            <h2 className="text-[20px] font-bold text-[var(--text)]">Connect Supabase first</h2>
            <p className="mt-2 text-[14px] leading-6 text-[var(--text-muted)]">
              Add your Supabase keys in .env.local or Vercel, then reload.
            </p>
          </div>
        ) : isLoading ? (
          <div className="mx-auto w-[88%] max-w-[360px]">
            <div className="aspect-[3.375/2.125] animate-pulse rounded-[28px] border border-[var(--border)] bg-[var(--surface)]" />
            <div className="-mt-[194px] aspect-[3.375/2.125] animate-pulse rounded-[28px] border border-[var(--border)] bg-[var(--surface-muted)]" />
          </div>
        ) : !user ? (
          <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)]">
            <h2 className="text-[20px] font-bold text-[var(--text)]">Sign in to see your groups</h2>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="mt-4 rounded-full bg-[var(--surface-accent)] px-5 py-3 text-[15px] font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--accent-soft-hover)]"
            >
              Sign in
            </button>
          </div>
        ) : displayGroups.length === 0 ? (
          <div className="space-y-4">
            <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
              What are you splitting?
            </p>

            <button
              type="button"
              onClick={() => { setCreateMode("trip"); setIsCreateOpen(true); }}
              className="relative w-full overflow-hidden rounded-[28px] p-6 text-left transition active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, #2d4a35 0%, #3d6b47 50%, #2a5c3a 100%)" }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
              <div className="relative">
                <div className="text-[42px] leading-none">✈️</div>
                <div className="mt-4 text-[22px] font-bold tracking-[-0.03em] text-white">
                  Trip or Event
                </div>
                <p className="mt-1.5 text-[14px] leading-5 text-white/70">
                  Competitions, vacations, weekend runs. Settle when it&apos;s done.
                </p>
                <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 text-[13px] font-semibold text-white">
                  Start a trip
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 8h10M9 4l4 4-4 4" />
                  </svg>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => { setCreateMode("group"); setIsCreateOpen(true); }}
              className="relative w-full overflow-hidden rounded-[28px] p-6 text-left transition active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, #1c2a4a 0%, #2a3d6b 50%, #1a2e5c 100%)" }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
              <div className="relative">
                <div className="text-[42px] leading-none">🏠</div>
                <div className="mt-4 text-[22px] font-bold tracking-[-0.03em] text-white">
                  Roommates
                </div>
                <p className="mt-1.5 text-[14px] leading-5 text-white/70">
                  Rent, groceries, utilities — the everyday stuff without awkwardness.
                </p>
                <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 text-[13px] font-semibold text-white">
                  Set up a home
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 8h10M9 4l4 4-4 4" />
                  </svg>
                </div>
              </div>
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setIsJoinOpen(true)}
                className="text-[15px] font-semibold text-[var(--accent)]"
              >
                Join with a code instead
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="mx-auto w-[88%] max-w-[360px]">
              <div className="relative" style={{ height: `${stackHeight}px` }}>
                {displayGroups.map((group, index) => (
                  <div
                    key={group.id}
                    className="absolute inset-x-0"
                    style={{ top: `${(displayGroups.length - 1 - index) * stackGap}px`, zIndex: displayGroups.length - index }}
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
            <div className="mt-5 text-center text-[13px] text-[var(--text-soft)]">
              Tap to open · Hold to peek · Change colors with the card menu
            </div>
          </div>
        )}

        {errorMessage ? (
          <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[14px] font-medium text-[var(--danger)]">
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
        <CreateGroupModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} onCreate={handleCreateGroup} mode={createMode} />
      ) : null}

      {isJoinOpen ? (
        <JoinGroupModal isOpen={isJoinOpen} onClose={handleCloseJoinModal} onJoin={handleJoinGroup} initialCode={prefillJoinCode} />
      ) : null}

      <GroupPreviewOverlay
        group={previewState.group}
        openedAt={previewState.openedAt}
        onClose={handleClosePreview}
        onColorChange={handleCardColorChange}
        onImageChange={handleCardImageChange}
      />
    </motion.main>
  );
}
