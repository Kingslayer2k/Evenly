"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CreateGroupModal from "../../components/CreateGroupModal";
import GroupCard from "../../components/GroupCard";
import JoinGroupModal from "../../components/JoinGroupModal";
import SettingsMenu from "../../components/SettingsMenu";
import { supabase } from "../../lib/supabase";
import {
  createGroupWithMembership,
  joinGroupByCode,
  loadUserGroupsBundle,
  normalizeInviteCode,
} from "../../lib/groupData";
import {
  computeBalancesForGroup,
  getDefaultColor,
  getDisplayNameFromUser,
  getMemberPreview,
  needsAttention,
  sumGroupTotal,
} from "../../lib/utils";

const CARD_COLORS_STORAGE_KEY = "evenly-card-colors";

function IconButton({ children, onClick, label, spinning = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F3F4F6] text-[#1C1917] transition hover:bg-[#E5E7EB] active:scale-[0.98]"
    >
      <div className={spinning ? "animate-spin" : ""}>{children}</div>
    </button>
  );
}

function HamburgerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
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

function readStoredCardColors() {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CARD_COLORS_STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.error("Could not read stored card colors:", error);
    return {};
  }
}

export default function GroupsPage() {
  const router = useRouter();
  const toastTimeoutRef = useRef(null);
  const [user, setUser] = useState(null);
  const [profileName, setProfileName] = useState("");
  const [groups, setGroups] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [membersByGroup, setMembersByGroup] = useState({});
  const [expensesByGroup, setExpensesByGroup] = useState({});
  const [cardColors, setCardColors] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [toast, setToast] = useState("");
  const [inviteCodeFromUrl, setInviteCodeFromUrl] = useState("");
  const [pendingInviteCode, setPendingInviteCode] = useState("");
  const [prefillJoinCode, setPrefillJoinCode] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);

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
      if (typeof window !== "undefined") {
        window.localStorage.setItem(CARD_COLORS_STORAGE_KEY, JSON.stringify(next));
      }
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
    },
    [],
  );

  useEffect(() => {
    setCardColors(readStoredCardColors());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const nextInviteCode = normalizeInviteCode(params.get("join") || params.get("code") || "");
    if (nextInviteCode) {
      setInviteCodeFromUrl(nextInviteCode);
      setPendingInviteCode(nextInviteCode);
    }
  }, []);

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
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
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
        () => void loadGroupsData(user, { refresh: true }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_members" },
        () => void loadGroupsData(user, { refresh: true }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "expenses" },
        () => void loadGroupsData(user, { refresh: true }),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadGroupsData, user]);

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

      return {
        ...group,
        code: group.join_code || group.code || "------",
        memberPreview: getMemberPreview(groupMembers) || "Just you for now",
        membersCount: groupMembers.length,
        expenseCount: groupExpenses.length,
        totalSpent,
        balance: currentBalance,
        cardColor: cardColors[group.id] || group.card_color || group.color || getDefaultColor(index),
        needsAttention: needsAttention(currentBalance),
      };
    });
  }, [cardColors, expensesByGroup, groups, membersByGroup, memberships]);

  const stackHeight = useMemo(
    () => (displayGroups.length ? 226 + Math.max(0, displayGroups.length - 1) * 32 : 0),
    [displayGroups.length],
  );

  const stackGap = 30;

  const handleRefresh = useCallback(async () => {
    if (!user) return;
    await loadGroupsData(user, { refresh: true });
    showToast("Groups refreshed");
  }, [loadGroupsData, showToast, user]);

  const handleOpenGroup = useCallback(
    (group) => {
      router.push(`/groups/${group.id}`);
    },
    [router],
  );

  const handleCreateGroup = useCallback(
    async ({ name, color }) => {
      if (!supabase || !user) {
        return { ok: false, message: "Sign in first so we can create the group." };
      }

      try {
        const { group, code } = await createGroupWithMembership(supabase, user, profileName, name);
        persistCardColor(group.id, color);
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
    [loadGroupsData, persistCardColor, profileName, showToast, user],
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

  const handleLogout = useCallback(async () => {
    if (!supabase) {
      router.replace("/");
      return;
    }
    await supabase.auth.signOut();
    setPendingInviteCode("");
    setPrefillJoinCode("");
    router.replace("/");
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
    (group, nextColor) => {
      persistCardColor(group.id, nextColor);
      showToast(`${group.name} card updated`);
    },
    [persistCardColor, showToast],
  );

  return (
    <main className="min-h-screen bg-[#F7F7F5]">
      <header className="fixed inset-x-0 top-0 z-30 border-b border-[#E5E7EB] bg-white/95 px-5 py-4 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-[420px] items-center justify-between">
          <IconButton label="Open settings" onClick={() => setIsSettingsOpen(true)}>
            <HamburgerIcon />
          </IconButton>

          <div className="text-center">
            <div className="text-[28px] font-bold leading-none text-[#1C1917]">Evenly</div>
            <div className="mt-1 text-[15px] font-normal text-[#6B7280]">Your groups</div>
          </div>

          <IconButton label="Refresh groups" onClick={() => void handleRefresh()} spinning={isRefreshing}>
            <RefreshIcon />
          </IconButton>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[420px] px-5 pt-[108px] pb-12">
        {user && displayGroups.length > 0 ? (
          <div className="mb-5 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#0070F3] px-4 py-3 text-[15px] font-semibold text-white transition hover:bg-[#0060D6] active:scale-[0.98]"
            >
              <PlusIcon />
              <span>Create group</span>
            </button>

            <button
              type="button"
              onClick={() => setIsJoinOpen(true)}
              className="inline-flex items-center justify-center rounded-full border border-[#E5E7EB] bg-white px-4 py-3 text-[15px] font-semibold text-[#1C1917] transition hover:bg-[#F7F7F5] active:scale-[0.98]"
            >
              Join by code
            </button>
          </div>
        ) : null}

        {!supabase ? (
          <section className="pt-10">
            <div className="rounded-[28px] border border-[#E5E7EB] bg-white p-6 shadow-[0_8px_20px_rgba(28,25,23,0.04)]">
              <h2 className="text-[24px] font-bold text-[#1C1917]">Connect Supabase first</h2>
              <p className="mt-3 text-[15px] leading-6 text-[#6B7280]">
                Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`
                or Vercel, then reload this page.
              </p>
            </div>
          </section>
        ) : isLoading ? (
          <section className="pt-8">
            <div className="mx-auto w-[88%] max-w-[360px]">
              <div className="aspect-[3.375/2.125] animate-pulse rounded-[28px] border border-[#E5E7EB] bg-white" />
              <div className="-mt-[194px] ml-0 aspect-[3.375/2.125] animate-pulse rounded-[28px] border border-[#E5E7EB] bg-[#F3F4F6]" />
              <div className="-mt-[194px] ml-0 aspect-[3.375/2.125] animate-pulse rounded-[28px] border border-[#E5E7EB] bg-[#ECEDE8]" />
            </div>
          </section>
        ) : !user ? (
          <section className="pt-10">
            <div className="rounded-[28px] border border-[#E5E7EB] bg-white p-6 shadow-[0_8px_20px_rgba(28,25,23,0.04)]">
              <h2 className="text-[24px] font-bold text-[#1C1917]">Sign in to see your groups</h2>
              <p className="mt-3 text-[15px] leading-6 text-[#6B7280]">
                Use the magic link on the welcome screen, then come right back here.
              </p>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="mt-6 rounded-full bg-[#8BA888] px-5 py-3 text-[15px] font-semibold text-white transition hover:bg-[#5F7D6A] active:scale-[0.98]"
              >
                Back to welcome
              </button>
            </div>
          </section>
        ) : displayGroups.length === 0 ? (
          <section className="pt-8">
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="mx-auto flex w-[88%] max-w-[360px] items-center justify-center rounded-[28px] border border-dashed border-[#D1D5DB] bg-white p-6 text-center shadow-[0_8px_20px_rgba(28,25,23,0.04)] transition hover:-translate-y-0.5 hover:border-[#0070F3] hover:shadow-[0_12px_24px_rgba(0,112,243,0.08)] active:scale-[0.99]"
            >
              <div className="aspect-[3.375/2.125] w-full rounded-[24px] border border-dashed border-[#E5E7EB] bg-[#F9FAFB] px-6 py-6">
                <div className="flex h-full flex-col items-center justify-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F3F4F6] text-[#1C1917]">
                    <PlusIcon />
                  </div>
                  <h2 className="mt-5 text-[22px] font-semibold text-[#1C1917]">
                    Create your first group
                  </h2>
                  <p className="mt-2 max-w-[230px] text-[14px] leading-5 text-[#6B7280]">
                    Start with roommates, a trip, or your weekend crew.
                  </p>
                </div>
              </div>
            </button>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setIsJoinOpen(true)}
                className="text-[15px] font-semibold text-[#0070F3] transition hover:text-[#0060D6]"
              >
                Join with a code instead
              </button>
            </div>
          </section>
        ) : (
          <section className="pt-4">
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
                      onColorChange={handleCardColorChange}
                      collapsed={index > 0}
                      isTopCard={index === 0}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 text-center">
              <div className="text-[14px] text-[#6B7280]">
                Hi {profileName || getDisplayNameFromUser(user, "")}.
              </div>
              <div className="mt-2 text-[13px] text-[#9CA3AF]">
                Tap a card to open it. Tap <span className="font-semibold text-[#6B7280]">Color</span> to change the card color.
              </div>
            </div>
          </section>
        )}

        {errorMessage ? (
          <div className="mt-6 rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] font-medium text-[#DC2626]">
            {errorMessage}
          </div>
        ) : null}
      </div>

      {toast ? (
        <div className="fixed right-4 bottom-4 z-40 rounded-full bg-[#1C1917] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_10px_20px_rgba(28,25,23,0.18)]">
          {toast}
        </div>
      ) : null}

      <SettingsMenu
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onJoin={() => {
          setPrefillJoinCode("");
          setIsJoinOpen(true);
        }}
        onCreate={() => setIsCreateOpen(true)}
        onLogout={() => void handleLogout()}
      />

      <CreateGroupModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreate={handleCreateGroup}
      />

      <JoinGroupModal
        isOpen={isJoinOpen}
        onClose={handleCloseJoinModal}
        onJoin={handleJoinGroup}
        initialCode={prefillJoinCode}
      />
    </main>
  );
}
