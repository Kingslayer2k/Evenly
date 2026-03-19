"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./EvenlyApp.module.css";
import { supabase } from "@/lib/supabase";

type TabKey = "trips" | "home" | "notes" | "me";

type ProfileRow = { display_name: string; emoji: string };
type GroupRow = { id: string; name: string; join_code: string };
type MemberRow = {
  id: string;
  group_id: string;
  user_id: string;
  display_name: string;
  emoji: string;
  role: "admin" | "member";
  created_at: string;
};
type ContextRow = {
  id: string;
  group_id: string;
  type: "home" | "trip";
  name: string;
  emoji: string;
  closed: boolean;
  created_at: string;
};
type ExpenseRow = {
  id: string;
  group_id: string;
  context_id: string;
  title: string;
  amount_cents: number;
  paid_by: string;
  split_type: "equal" | "custom" | "balanced";
  participants: string[];
  shares: Record<string, number> | null;
  round_up_cents: number;
  created_at: string;
};
type CommentRow = {
  id: string;
  group_id: string;
  expense_id: string;
  by_member_id: string;
  text: string;
  created_at: string;
};
type PoolRow = { id: string; group_id: string; month: string; per_person_cents: number; created_at: string };
type PoolContributionRow = { pool_id: string; member_id: string; amount_cents: number; created_at: string };
type PoolDeductionRow = { id: string; pool_id: string; title: string; emoji: string; amount_cents: number; at: string; created_at: string };

type ViewState =
  | { kind: "tabs" }
  | { kind: "context"; contextId: string };

type ModalState =
  | null
  | { kind: "menu" }
  | { kind: "createTrip" }
  | { kind: "addExpense"; contextId: string }
  | { kind: "reassignPayer"; expenseId: string }
  | { kind: "comments"; expenseId: string }
  | { kind: "poolAdjust" }
  | { kind: "poolDeduction" }
  | { kind: "ledgerDetail"; mode: "owe" | "owed" };

function randomJoinCode(len = 8) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function isoMonthNow() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMoney(cents: number) {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}$${(abs / 100).toFixed(2)}`;
}

function parseMoneyToCents(input: string) {
  const clean = String(input || "").replace(/[^\d.]/g, "");
  if (!clean) return null;
  const num = Number(clean);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 100);
}

function computeRoundUpCents(amountCents: number, roundUpOn: boolean) {
  if (!roundUpOn) return 0;
  const nextDollar = Math.ceil(amountCents / 100) * 100;
  return nextDollar - amountCents;
}

function computeSettleTransfers(balancesById: Record<string, number>) {
  const creditors: Array<{ id: string; cents: number }> = [];
  const debtors: Array<{ id: string; cents: number }> = [];
  for (const [id, cents] of Object.entries(balancesById)) {
    const v = Number(cents || 0);
    if (v > 0) creditors.push({ id, cents: v });
    else if (v < 0) debtors.push({ id, cents: -v });
  }
  creditors.sort((a, b) => b.cents - a.cents);
  debtors.sort((a, b) => b.cents - a.cents);

  const transfers: Array<{ from: string; to: string; amountCents: number }> = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];
    const pay = Math.min(d.cents, c.cents);
    if (pay > 0) transfers.push({ from: d.id, to: c.id, amountCents: pay });
    d.cents -= pay;
    c.cents -= pay;
    if (d.cents <= 0) i++;
    if (c.cents <= 0) j++;
  }
  return transfers;
}

function friendlyBadge(netCents: number, isMe: boolean) {
  if (netCents === 0) return { label: "All even", kind: "good" as const };
  if (netCents > 0) return { label: isMe ? `You're covered ${formatMoney(netCents)}` : `Covered ${formatMoney(netCents)}`, kind: "good" as const };
  return { label: isMe ? `You're up ${formatMoney(-netCents)}` : `Up ${formatMoney(-netCents)}`, kind: "warn" as const };
}

function computeShares(exp: ExpenseRow) {
  const participants = Array.isArray(exp.participants) ? exp.participants.slice() : [];
  if (participants.length === 0) return {} as Record<string, number>;

  if (exp.split_type === "custom" || exp.split_type === "balanced") {
    const shares = exp.shares || {};
    const out: Record<string, number> = {};
    for (const id of participants) out[id] = Math.max(0, Number(shares[id] || 0));
    return out;
  }

  const total = Number(exp.amount_cents || 0) + Number(exp.round_up_cents || 0);
  const per = Math.floor(total / participants.length);
  let remainder = total - per * participants.length;
  const out: Record<string, number> = {};
  for (const id of participants) {
    out[id] = per + (remainder > 0 ? 1 : 0);
    remainder = Math.max(0, remainder - 1);
  }
  return out;
}

export default function EvenlyApp() {
  const [toast, setToast] = useState<string>("");

  const [authLoading, setAuthLoading] = useState(true);
  const [userId, setUserId] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginMsg, setLoginMsg] = useState("");
  const [showWelcomeIntro, setShowWelcomeIntro] = useState(false);

  const [profileName, setProfileName] = useState("");
  const [profileEmoji, setProfileEmoji] = useState("🙂");

  const [groupCreateName, setGroupCreateName] = useState("");
  const [groupJoinCode, setGroupJoinCode] = useState("");
  const [groupsBusy, setGroupsBusy] = useState(false);

  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string>("");

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [contexts, setContexts] = useState<ContextRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);

  const [poolMonth] = useState(() => isoMonthNow());
  const [pool, setPool] = useState<PoolRow | null>(null);
  const [poolContrib, setPoolContrib] = useState<Record<string, number>>({});
  const [poolDed, setPoolDed] = useState<PoolDeductionRow[]>([]);

  const [tab, setTab] = useState<TabKey>("trips");
  const [view, setView] = useState<ViewState>({ kind: "tabs" });
  const [modal, setModal] = useState<ModalState>(null);

  const pollTimerRef = useRef<number | null>(null);

  const signedIn = Boolean(userId);
  const myMemberId = useMemo(() => members.find((m) => m.user_id === userId)?.id || "", [members, userId]);
  const myMember = useMemo(() => members.find((m) => m.id === myMemberId) || null, [members, myMemberId]);
  const isAdmin = myMember?.role === "admin";
  const activeGroup = useMemo(() => groups.find((g) => g.id === activeGroupId) || null, [groups, activeGroupId]);

  const homeContext = useMemo(() => contexts.find((c) => c.type === "home") || null, [contexts]);
  const tripContexts = useMemo(() => contexts.filter((c) => c.type === "trip"), [contexts]);

  useEffect(() => {
    try {
      const savedGroup = localStorage.getItem("evenly:activeGroup") || "";
      const savedTab = (localStorage.getItem("evenly:tab") as TabKey) || "trips";
      const seenIntro = localStorage.getItem("evenly:introSeen") === "1";
      if (savedGroup) setActiveGroupId(savedGroup);
      if (savedTab) setTab(savedTab);
      if (!seenIntro) setShowWelcomeIntro(true);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      if (activeGroupId) localStorage.setItem("evenly:activeGroup", activeGroupId);
      else localStorage.removeItem("evenly:activeGroup");
      localStorage.setItem("evenly:tab", tab);
    } catch {
      // ignore
    }
  }, [activeGroupId, tab]);

  useEffect(() => {
    // Lock background scroll when a modal is open.
    const prev = document.body.style.overflow;
    if (modal) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [modal]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  async function refreshSession() {
    const { data } = await supabase.auth.getSession();
    const sess = data.session;
    if (!sess?.user) {
      setUserId("");
      setUserEmail("");
      return;
    }
    setUserId(sess.user.id);
    setUserEmail(sess.user.email ?? "");
  }

  async function signInMagicLink() {
    const email = loginEmail.trim();
    if (!email) return setLoginMsg("Type your email first.");
    setLoginMsg("Sending link…");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setLoginMsg(error ? error.message : "Check your email for the link.");
  }

  async function signOut() {
    await supabase.auth.signOut();
    setToast("Signed out.");
    setGroups([]);
    setActiveGroupId("");
    setMembers([]);
    setContexts([]);
    setExpenses([]);
    setPool(null);
    setPoolContrib({});
    setPoolDed([]);
    setView({ kind: "tabs" });
    setModal(null);
    await refreshSession();
  }

  async function loadProfile() {
    const res = await supabase.from("profiles").select("display_name,emoji").single();
    if (res.error || !res.data) return;
    const row = res.data as ProfileRow;
    setProfileName(row.display_name || "");
    setProfileEmoji(row.emoji || "🙂");
  }

  async function saveProfile() {
    if (!signedIn) return;
    const dn = profileName.trim() || "New friend";
    const em = (profileEmoji.trim() || "🙂").slice(0, 8);
    const { error } = await supabase.from("profiles").upsert({ user_id: userId, display_name: dn, emoji: em });
    setToast(error ? `Profile error: ${error.message}` : "Profile saved.");
  }

  async function loadGroups() {
    if (!signedIn) return;
    const mem = await supabase.from("group_members").select("group_id").eq("user_id", userId);
    if (mem.error) return setToast(mem.error.message);
    const ids = Array.from(new Set((mem.data || []).map((r) => String((r as { group_id: string }).group_id)))).filter(Boolean);
    if (ids.length === 0) {
      setGroups([]);
      setActiveGroupId("");
      return;
    }
    const g = await supabase.from("groups").select("id,name,join_code").in("id", ids).order("created_at", { ascending: false });
    if (g.error) return setToast(g.error.message);
    const rows = (g.data || []) as GroupRow[];
    setGroups(rows);
    if (!activeGroupId || !rows.some((r) => r.id === activeGroupId)) {
      setActiveGroupId(rows[0]?.id || "");
    }
  }

  async function refreshGroupData(gid: string) {
    if (!gid) return;
    const [memRes, ctxRes, expRes] = await Promise.all([
      supabase.from("group_members").select("id,group_id,user_id,display_name,emoji,role,created_at").eq("group_id", gid).order("created_at", { ascending: true }),
      supabase.from("contexts").select("id,group_id,type,name,emoji,closed,created_at").eq("group_id", gid).order("created_at", { ascending: true }),
      supabase.from("expenses").select("id,group_id,context_id,title,amount_cents,paid_by,split_type,participants,shares,round_up_cents,created_at").eq("group_id", gid).order("created_at", { ascending: false }),
    ]);

    if (memRes.error) setToast(memRes.error.message);
    else {
      const rows = (memRes.data || []) as MemberRow[];
      const seen = new Set<string>();
      const deduped: MemberRow[] = [];
      for (const r of rows) {
        const key = String(r.user_id || "");
        if (!key) continue;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(r);
      }
      setMembers(deduped);
    }

    if (ctxRes.error) setToast(ctxRes.error.message);
    else setContexts((ctxRes.data || []) as ContextRow[]);

    if (expRes.error) setToast(expRes.error.message);
    else setExpenses((expRes.data || []) as ExpenseRow[]);

    await refreshPool(gid);
  }

  async function ensurePoolRow(gid: string) {
    const existing = await supabase.from("pools").select("id,group_id,month,per_person_cents,created_at").eq("group_id", gid).eq("month", poolMonth).limit(1);
    if (existing.error) throw existing.error;
    const found = (existing.data || [])[0] as PoolRow | undefined;
    if (found) return found;
    const ins = await supabase.from("pools").insert({ group_id: gid, month: poolMonth, per_person_cents: 0 }).select("id,group_id,month,per_person_cents,created_at").single();
    if (ins.error) throw ins.error;
    return ins.data as PoolRow;
  }

  async function refreshPool(gid: string) {
    try {
      const p = await ensurePoolRow(gid);
      setPool(p);
      const [cRes, dRes] = await Promise.all([
        supabase.from("pool_contributions").select("pool_id,member_id,amount_cents,created_at").eq("pool_id", p.id),
        supabase.from("pool_deductions").select("id,pool_id,title,emoji,amount_cents,at,created_at").eq("pool_id", p.id).order("at", { ascending: false }),
      ]);
      if (cRes.error) throw cRes.error;
      if (dRes.error) throw dRes.error;
      const contrib: Record<string, number> = {};
      for (const r of (cRes.data || []) as PoolContributionRow[]) {
        contrib[r.member_id] = Number(r.amount_cents || 0);
      }
      setPoolContrib(contrib);
      setPoolDed((dRes.data || []) as PoolDeductionRow[]);
    } catch {
      // Pool is optional; keep UI usable even if policies block it early on.
    }
  }

  async function createGroup(groupName: string) {
    if (groupsBusy) return;
    const name = groupName.trim();
    const dn = profileName.trim();
    if (!name) return setToast("Add a group name.");
    if (!dn) return setToast("Add your name first (Me tab).");
    const code = randomJoinCode(8);
    setGroupsBusy(true);
    try {
      const g = await supabase.from("groups").insert({ name, join_code: code, created_by: userId }).select("id,name,join_code").single();
      if (g.error) return setToast(`Create group failed: ${g.error.message}`);
      const group = g.data as GroupRow;

      const gm = await supabase.from("group_members").insert({
        group_id: group.id,
        user_id: userId,
        display_name: dn,
        emoji: (profileEmoji.trim() || "🙂"),
        role: "admin",
      });
      if (gm.error) return setToast(`Add member failed: ${gm.error.message}`);

      const ctx = await supabase.from("contexts").insert({ group_id: group.id, type: "home", name: "Home", emoji: "🏠", closed: false });
      if (ctx.error) return setToast(`Create home failed: ${ctx.error.message}`);

      setToast(`Created. Join code: ${group.join_code}`);
      setGroupCreateName("");
      await loadGroups();
      setActiveGroupId(group.id);
      setView({ kind: "tabs" });
    } finally {
      setGroupsBusy(false);
    }
  }

  async function joinGroup(codeRaw: string) {
    if (groupsBusy) return;
    const code = codeRaw.trim().toUpperCase();
    const dn = profileName.trim();
    if (!code) return setToast("Type a join code.");
    if (!dn) return setToast("Add your name first (Me tab).");
    setGroupsBusy(true);
    try {
      const g = await supabase.from("groups").select("id,name,join_code").eq("join_code", code).maybeSingle();
      if (g.error) return setToast(`Lookup failed: ${g.error.message}`);
      if (!g.data) return setToast("No group found for that code.");
      const group = g.data as GroupRow;

      // Avoid duplicate joins even if the DB doesn't have a unique constraint yet.
      const already = await supabase
        .from("group_members")
        .select("id")
        .eq("group_id", group.id)
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

      if (!already.error && already.data) {
        setToast(`Already in: ${group.name}`);
      } else {
        const gm = await supabase.from("group_members").insert({
          group_id: group.id,
          user_id: userId,
          display_name: dn,
          emoji: (profileEmoji.trim() || "🙂"),
          role: "member",
        });
        if (gm.error && !gm.error.message.toLowerCase().includes("duplicate")) {
          return setToast(`Join failed: ${gm.error.message}`);
        }
        setToast(`Joined: ${group.name}`);
      }
      setGroupJoinCode("");
      await loadGroups();
      setActiveGroupId(group.id);
      setView({ kind: "tabs" });
    } finally {
      setGroupsBusy(false);
    }
  }

  async function leaveActiveGroup() {
    if (!activeGroupId) return;
    if (!myMemberId) return setToast("Couldn't find your member record.");
    const del = await supabase.from("group_members").delete().eq("id", myMemberId).eq("group_id", activeGroupId);
    if (del.error) return setToast(del.error.message);
    setToast("Left the group.");
    setModal(null);
    setMembers([]);
    setContexts([]);
    setExpenses([]);
    setPool(null);
    setPoolContrib({});
    setPoolDed([]);
    setActiveGroupId("");
    setView({ kind: "tabs" });
    await loadGroups();
  }

  async function removeMember(memberId: string) {
    if (!activeGroupId) return;
    if (!isAdmin) return setToast("Admins only.");
    if (!memberId) return;
    const del = await supabase.from("group_members").delete().eq("id", memberId).eq("group_id", activeGroupId);
    if (del.error) return setToast(del.error.message);
    setToast("Removed.");
    await refreshGroupData(activeGroupId);
  }

  async function createTrip(nameRaw: string, emojiRaw: string) {
    if (!activeGroupId) return;
    const name = nameRaw.trim();
    const emoji = (emojiRaw.trim() || "🧳").slice(0, 8);
    if (!name) return setToast("Name the trip first.");
    const ins = await supabase.from("contexts").insert({ group_id: activeGroupId, type: "trip", name, emoji, closed: false });
    if (ins.error) return setToast(ins.error.message);
    setToast("Trip created.");
    setModal(null);
    await refreshGroupData(activeGroupId);
  }

  async function toggleTripClosed(contextId: string, nextClosed: boolean) {
    if (!activeGroupId) return;
    const up = await supabase.from("contexts").update({ closed: nextClosed }).eq("group_id", activeGroupId).eq("id", contextId);
    if (up.error) return setToast(up.error.message);
    await refreshGroupData(activeGroupId);
  }

  async function addExpense(payload: {
    contextId: string;
    title: string;
    amountCents: number;
    paidBy: string;
    participants: string[];
    roundUpOn: boolean;
    splitType?: "equal" | "custom";
    shares?: Record<string, number> | null;
  }) {
    if (!activeGroupId) return;
    const roundUpCents = computeRoundUpCents(payload.amountCents, payload.roundUpOn);
    const ins = await supabase.from("expenses").insert({
      group_id: activeGroupId,
      context_id: payload.contextId,
      title: payload.title,
      amount_cents: payload.amountCents,
      paid_by: payload.paidBy,
      split_type: payload.splitType || "equal",
      participants: payload.participants,
      shares: payload.splitType === "custom" ? payload.shares || null : null,
      round_up_cents: roundUpCents,
    });
    if (ins.error) return setToast(ins.error.message);
    setModal(null);
    setToast("Added.");
    await refreshGroupData(activeGroupId);
  }

  function expensesForContext(contextId: string) {
    return expenses
      .filter((e) => e.context_id === contextId)
      .slice()
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  }

  function computeBalances(contextId: string) {
    const balances: Record<string, number> = {};
    for (const m of members) balances[m.id] = 0;
    for (const e of expenses) {
      if (e.context_id !== contextId) continue;
      const total = Number(e.amount_cents || 0) + Number(e.round_up_cents || 0);
      balances[e.paid_by] = (balances[e.paid_by] || 0) + total;
      const shares = computeShares(e);
      for (const [mid, cents] of Object.entries(shares)) {
        balances[mid] = (balances[mid] || 0) - Number(cents || 0);
      }
    }
    return balances;
  }

  function turnSuggestion(contextId: string) {
    const exps = expensesForContext(contextId);
    const lastPaidAt: Record<string, number> = {};
    for (const m of members) lastPaidAt[m.id] = 0;
    for (const e of exps) {
      const t = Date.parse(e.created_at) || 0;
      lastPaidAt[e.paid_by] = Math.max(lastPaidAt[e.paid_by] || 0, t);
    }
    const ranked = members
      .map((m) => ({ id: m.id, at: lastPaidAt[m.id] || 0 }))
      .sort((a, b) => a.at - b.at);
    const pick = ranked[0];
    if (!pick) return null;
    const m = members.find((x) => x.id === pick.id);
    if (!m) return null;
    const vibe = exps.length < 2 ? "Someone should grab the first one." : `${m.display_name} might be up next.`;
    return { memberId: m.id, text: vibe };
  }

  function computeMyLedger() {
    const meId = myMemberId;
    const owes: Record<string, number> = {};
    const owed: Record<string, number> = {};
    if (!meId) return { owes, owed, owesTotal: 0, owedTotal: 0 };

    for (const ctx of contexts) {
      if (ctx.closed) continue;
      const transfers = computeSettleTransfers(computeBalances(ctx.id));
      for (const t of transfers) {
        if (t.from === meId) owes[t.to] = (owes[t.to] || 0) + t.amountCents;
        else if (t.to === meId) owed[t.from] = (owed[t.from] || 0) + t.amountCents;
      }
    }
    const owesTotal = Object.values(owes).reduce((s, v) => s + Number(v || 0), 0);
    const owedTotal = Object.values(owed).reduce((s, v) => s + Number(v || 0), 0);
    return { owes, owed, owesTotal, owedTotal };
  }

  function suggestSmartShares(contextId: string, amountCents: number, participantIds: string[]) {
    const ids = participantIds.filter(Boolean);
    if (!ids.length || amountCents <= 0) return {} as Record<string, number>;

    const now = Date.now();
    const monthAgo = now - 1000 * 60 * 60 * 24 * 30;
    const paidRecently: Record<string, number> = {};
    const outstanding: Record<string, number> = {};
    for (const id of ids) {
      paidRecently[id] = 0;
      outstanding[id] = 0;
    }

    for (const e of expenses) {
      const ts = Date.parse(e.created_at);
      if (ts >= monthAgo && paidRecently[e.paid_by] != null) {
        paidRecently[e.paid_by] += Number(e.amount_cents || 0) + Number(e.round_up_cents || 0);
      }
    }

    for (const c of contexts) {
      if (c.closed) continue;
      const balances = computeBalances(c.id);
      for (const id of ids) {
        const bal = Number(balances[id] || 0);
        if (bal < 0) outstanding[id] += -bal;
      }
    }

    const recentAvg = ids.reduce((s, id) => s + paidRecently[id], 0) / ids.length || 1;
    const debtAvg = ids.reduce((s, id) => s + outstanding[id], 0) / ids.length || 1;

    const weightById: Record<string, number> = {};
    for (const id of ids) {
      const paidBias = (recentAvg - paidRecently[id]) / recentAvg; // paid less recently => positive
      const debtBias = outstanding[id] / debtAvg; // owes more => higher
      const w = 1 + paidBias * 0.35 + debtBias * 0.2;
      weightById[id] = Math.max(0.65, Math.min(1.45, w));
    }

    const weightTotal = ids.reduce((s, id) => s + weightById[id], 0) || ids.length;
    const shares: Record<string, number> = {};
    let running = 0;
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (i === ids.length - 1) {
        shares[id] = Math.max(0, amountCents - running);
      } else {
        const part = Math.round((amountCents * weightById[id]) / weightTotal);
        shares[id] = Math.max(0, part);
        running += shares[id];
      }
    }
    return shares;
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      setAuthLoading(true);
      await refreshSession();
      if (!alive) return;
      setAuthLoading(false);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange(async () => {
      if (!alive) return;
      await refreshSession();
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    (async () => {
      await loadProfile();
      await loadGroups();
    })();
  }, [signedIn]);

  useEffect(() => {
    if (!signedIn || !activeGroupId) return;
    (async () => {
      await refreshGroupData(activeGroupId);
    })();
  }, [signedIn, activeGroupId]);

  useEffect(() => {
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (!signedIn || !activeGroupId) return;
    pollTimerRef.current = window.setInterval(() => {
      refreshGroupData(activeGroupId).catch(() => {});
    }, 8000);
    return () => {
      if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    };
  }, [signedIn, activeGroupId]);

  // --- UI bits --------------------------------------------------------------
  function Panel(props: { title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode }) {
    return (
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <div className={styles.panelTitle}>{props.title}</div>
            {props.subtitle ? <div className={styles.panelSub}>{props.subtitle}</div> : null}
          </div>
          {props.actions ? <div className={styles.row}>{props.actions}</div> : null}
        </div>
        <div className={styles.panelBody}>{props.children}</div>
      </section>
    );
  }

  function Btn(props: { kind?: "primary" | "ghost"; onClick?: () => void; disabled?: boolean; children: React.ReactNode }) {
    const cls = props.kind === "primary" ? `${styles.btn} ${styles.btnPrimary}` : props.kind === "ghost" ? `${styles.btn} ${styles.btnGhost}` : styles.btn;
    return (
      <button className={cls} type="button" onClick={props.onClick} disabled={props.disabled}>
        {props.children}
      </button>
    );
  }

  function Badge(props: { kind?: "good" | "warn"; children: React.ReactNode }) {
    const cls = props.kind === "good" ? `${styles.badge} ${styles.badgeGood}` : props.kind === "warn" ? `${styles.badge} ${styles.badgeWarn}` : styles.badge;
    return <span className={cls}>{props.children}</span>;
  }

  function openContext(contextId: string) {
    setView({ kind: "context", contextId });
  }

  // --- Screens --------------------------------------------------------------
  function renderAuth() {
    if (showWelcomeIntro) {
      return (
        <div className={styles.list}>
          <section className={styles.welcomeCard}>
            <div className={styles.welcomeTitle}>Welcome To <span>Evenly.</span></div>
            <div className={styles.welcomeSub}>Friendly splits for real life.</div>
            <div className={styles.logoStack} aria-hidden="true">
              <div />
              <div />
              <div />
            </div>
            <div className={styles.btnRow}>
              <Btn
                kind="primary"
                onClick={() => {
                  try {
                    localStorage.setItem("evenly:introSeen", "1");
                  } catch {
                    // ignore
                  }
                  setShowWelcomeIntro(false);
                }}
              >
                Continue
              </Btn>
            </div>
          </section>
        </div>
      );
    }

    return (
      <div className={styles.list}>
        <Panel title="Sign in" subtitle="Enter your email and we will send a magic link.">
          <div className={styles.field}>
            <div className={styles.label}>Email</div>
            <input className={styles.input} value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="you@email.com" />
          </div>
          <div className={styles.btnRow}>
            <Btn kind="primary" onClick={() => void signInMagicLink()}>
              Send magic link
            </Btn>
          </div>
          {loginMsg ? <div className={styles.toast}>{loginMsg}</div> : null}
        </Panel>
      </div>
    );
  }

  function renderGroups() {
    return (
      <div className={styles.list}>
        <Panel title="Groups" subtitle="Create one, or join with a code.">
          <div className={styles.card}>
            <div className={styles.cardTop}>
              <span className={styles.pill}>Create</span>
              <span className={styles.pill}>You’ll get a code</span>
            </div>
            <div className={styles.cardTitle}>New group</div>
            <div className={styles.cardSub}>Roomies, trip crew, weekend away.</div>
            <div className={styles.field} style={{ marginTop: 10 }}>
              <div className={styles.label}>Group name</div>
              <input
                className={styles.input}
                value={groupCreateName}
                onChange={(e) => setGroupCreateName(e.target.value)}
                placeholder="Roomies"
                disabled={groupsBusy}
              />
            </div>
            <div className={styles.btnRow} style={{ marginTop: 10 }}>
              <Btn kind="primary" onClick={() => void createGroup(groupCreateName)} disabled={groupsBusy}>
                Create
              </Btn>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardTop}>
              <span className={styles.pill}>Join</span>
              <span className={styles.pill}>Ask for a code</span>
            </div>
            <div className={styles.cardTitle}>Join by code</div>
            <div className={styles.cardSub}>No links, no drama.</div>
            <div className={styles.field} style={{ marginTop: 10 }}>
              <div className={styles.label}>Code</div>
              <input
                className={styles.input}
                value={groupJoinCode}
                onChange={(e) => setGroupJoinCode(e.target.value.toUpperCase())}
                placeholder="ABCD1234"
                disabled={groupsBusy}
              />
            </div>
            <div className={styles.btnRow} style={{ marginTop: 10 }}>
              <Btn kind="primary" onClick={() => void joinGroup(groupJoinCode)} disabled={groupsBusy}>
                Join
              </Btn>
            </div>
          </div>
        </Panel>

        <Panel
          title="My groups"
          subtitle={groups.length ? "Tap one to open it." : "Create or join a group to get started."}
          actions={<Btn onClick={() => void loadGroups()}>Refresh</Btn>}
        >
          <div className={styles.list}>
            {groups.map((g) => (
              <div key={g.id} className={styles.card} role="button" tabIndex={0} onClick={() => setActiveGroupId(g.id)}>
                <div className={styles.cardTop}>
                  <span className={styles.pill}>{g.join_code}</span>
                  {activeGroupId === g.id ? <Badge kind="good">Active</Badge> : <span className={styles.pill}>Open</span>}
                </div>
                <div className={styles.cardTitle}>{g.name}</div>
                <div className={styles.cardSub}>Join code stays the vibe.</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    );
  }

  function renderTripsTab() {
    const openTrips = tripContexts.filter((t) => !t.closed);
    const closedTrips = tripContexts.filter((t) => t.closed);

    function cardFor(ctx: ContextRow) {
      const exps = expensesForContext(ctx.id);
      const total = exps.reduce((s, e) => s + Number(e.amount_cents || 0) + Number(e.round_up_cents || 0), 0);
      const suggestion = ctx.closed ? null : turnSuggestion(ctx.id);
      const status = ctx.closed ? "Closed and cozy." : suggestion ? suggestion.text : "No drama, just vibes.";
      return (
        <div key={ctx.id} className={styles.card} role="button" tabIndex={0} onClick={() => openContext(ctx.id)}>
          <div className={styles.cardTop}>
            <span className={styles.pill}>
              {ctx.emoji} <span className="mono">{exps.length} items</span>
            </span>
            <span className={`${styles.pill} mono`}>{formatMoney(total)}</span>
          </div>
          <div className={styles.cardTitle}>{ctx.name}</div>
          <div className={styles.cardSub}>{status}</div>
        </div>
      );
    }

    return (
      <div className={styles.list}>
        <Panel
          title="Trips"
          subtitle="Weekend away, concert night, vacation vibes."
          actions={
            <Btn kind="primary" onClick={() => setModal({ kind: "createTrip" })}>
              New trip
            </Btn>
          }
        >
          <div className={styles.list}>
            {openTrips.map(cardFor)}
            {closedTrips.map(cardFor)}
            {tripContexts.length === 0 ? (
              <div className={styles.card}>
                <div className={styles.cardTitle}>No trips yet</div>
                <div className={styles.cardSub}>Create one and keep expenses tidy.</div>
              </div>
            ) : null}
          </div>
        </Panel>
      </div>
    );
  }

  function renderHomeTab() {
    const ledger = computeMyLedger();
    const p = pool;
    const per = p ? Number(p.per_person_cents || 0) : 0;

    // Fill missing contributions with per-person default (non-destructive).
    const contribByMember: Record<string, number> = {};
    for (const m of members) {
      const v = poolContrib[m.id];
      contribByMember[m.id] = v != null ? v : per;
    }

    const contributed = Object.values(contribByMember).reduce((s, v) => s + Number(v || 0), 0);
    const spent = (poolDed || []).reduce((s, d) => s + Number(d.amount_cents || 0), 0);
    const remaining = contributed - spent;

    const badge = contributed === 0 ? <Badge kind="warn">Set a pool</Badge> : remaining <= Math.round(contributed * 0.15) ? <Badge kind="warn">Running low</Badge> : <Badge kind="good">Looks chill</Badge>;

    const monthPrefix = `${poolMonth}-`;
    const paidByMember: Record<string, number> = {};
    for (const m of members) paidByMember[m.id] = 0;
    for (const e of expenses) {
      if (!String(e.created_at || "").startsWith(monthPrefix)) continue;
      const total = Number(e.amount_cents || 0) + Number(e.round_up_cents || 0);
      paidByMember[e.paid_by] = (paidByMember[e.paid_by] || 0) + total;
    }
    const leaderboard = members
      .map((m) => {
        const paid = Number(paidByMember[m.id] || 0);
        const poolAmt = Number(contribByMember[m.id] || 0);
        return { m, paid, poolAmt, score: paid + poolAmt };
      })
      .sort((a, b) => b.score - a.score);
    const latest = expenses
      .slice()
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .slice(0, 5);

    return (
      <div className={styles.list}>
        <section className={styles.walletCard}>
          <div className={styles.walletHeader}>
            <div className={styles.walletTitle}>Evenly Wallet</div>
            <div className={styles.walletSub}>{activeGroup ? activeGroup.name : "Pick a group"}</div>
          </div>
          <div className={styles.walletAmounts}>
            <button type="button" className={styles.metricChip} onClick={() => setModal({ kind: "ledgerDetail", mode: "owe" })}>
              <span>You owe</span>
              <strong>{formatMoney(ledger.owesTotal)}</strong>
            </button>
            <button type="button" className={styles.metricChip} onClick={() => setModal({ kind: "ledgerDetail", mode: "owed" })}>
              <span>You're owed</span>
              <strong>{formatMoney(ledger.owedTotal)}</strong>
            </button>
          </div>
          <div className={styles.walletSub} style={{ marginTop: 8 }}>Tap either to see full breakdown.</div>
        </section>

        <Panel title="Groups" subtitle="Card stack style. Tap any card to switch.">
          <div className={styles.stackWrap}>
            {groups.map((g, i) => (
              <button
                key={g.id}
                type="button"
                className={`${styles.groupCard} ${g.id === activeGroupId ? styles.groupCardActive : ""}`}
                style={{ transform: `translateY(${i * -24}px)` }}
                onClick={() => setActiveGroupId(g.id)}
              >
                <div className={styles.groupCardRow}>
                  <span>{g.name}</span>
                  <span>{g.join_code}</span>
                </div>
              </button>
            ))}
          </div>
        </Panel>

        <Panel
          title="Home"
          subtitle="A monthly pool for boring stuff (but make it gentle)."
          actions={
            <div className={styles.btnRow}>
              <Btn kind="primary" onClick={() => setModal({ kind: "poolAdjust" })}>
                Adjust pool
              </Btn>
              <Btn onClick={() => setModal({ kind: "poolDeduction" })}>Add deduction</Btn>
              {homeContext ? (
                <Btn onClick={() => openContext(homeContext.id)}>See expenses</Btn>
              ) : null}
            </div>
          }
        >
          <div className={styles.card}>
            <div className={styles.cardTop}>
              <div className={styles.cardTitle}>{poolMonth} pool</div>
              {badge}
            </div>
            <div className={styles.cardSub}>
              Left: <span className="mono">{formatMoney(Math.max(0, remaining))}</span> · Spent: <span className="mono">{formatMoney(spent)}</span>
            </div>
          </div>
        </Panel>

        <Panel title="Latest expenses" subtitle="Most recent activity in this group.">
          <div className={styles.list}>
            {latest.length === 0 ? (
              <div className={styles.cardSub}>No expenses yet.</div>
            ) : latest.map((e) => {
              const payer = members.find((m) => m.id === e.paid_by);
              const ctx = contexts.find((c) => c.id === e.context_id);
              const total = Number(e.amount_cents || 0) + Number(e.round_up_cents || 0);
              return (
                <div key={e.id} className={styles.row}>
                  <div>
                    <div className={styles.cardTitle} style={{ marginTop: 0, fontSize: 14 }}>{e.title}</div>
                    <div className={styles.cardSub}>
                      {(ctx ? `${ctx.emoji} ${ctx.name}` : "Context")} · {payer ? `${payer.emoji} ${payer.display_name}` : "Someone"}
                    </div>
                  </div>
                  <span className={`${styles.pill} mono`}>{formatMoney(total)}</span>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel
          title="Leaderboard"
          subtitle={`${poolMonth} bragging rights. Trophy auto-passes each month.`}
        >
          <div className={styles.card}>
            {leaderboard.length === 0 ? (
              <div className={styles.cardSub}>No activity yet.</div>
            ) : (
              <div className={styles.list}>
                {leaderboard.slice(0, 8).map((row, idx) => (
                  <div key={row.m.id} className={styles.row}>
                    <div>
                      <div className={styles.cardTitle} style={{ marginTop: 0, fontSize: 14 }}>
                        {idx === 0 ? "🏆 " : ""}{row.m.emoji} {row.m.display_name}
                      </div>
                      <div className={styles.cardSub} style={{ marginTop: 4 }}>
                        paid <span className="mono">{formatMoney(row.paid)}</span> · pool <span className="mono">{formatMoney(row.poolAmt)}</span>
                      </div>
                    </div>
                    <span className={`${styles.pill} mono`}>{formatMoney(row.score)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Panel>
      </div>
    );
  }

  function renderNotesTab() {
    const nudges = contexts
      .filter((c) => !c.closed)
      .map((c) => ({ ctx: c, sug: turnSuggestion(c.id) }))
      .filter((x) => Boolean(x.sug));

    return (
      <div className={styles.list}>
        <Panel title="Notes" subtitle="Playful nudges, never demands.">
          <div className={styles.list}>
            {nudges.length ? (
              nudges.map(({ ctx, sug }) => (
                <div key={ctx.id} className={styles.card}>
                  <div className={styles.cardTitle}>Tiny nudge</div>
                  <div className={styles.cardSub}>
                    {ctx.emoji} {ctx.name}: {sug ? sug.text : ""}
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.card}>
                <div className={styles.cardTitle}>Quiet</div>
                <div className={styles.cardSub}>No nudges right now.</div>
              </div>
            )}
          </div>
        </Panel>
      </div>
    );
  }

  function renderMeTab() {
    const ledger = computeMyLedger();

    function ledgerList(map: Record<string, number>, empty: string) {
      const rows = Object.entries(map)
        .map(([id, cents]) => ({ id, cents: Number(cents || 0) }))
        .filter((r) => r.cents > 0)
        .sort((a, b) => b.cents - a.cents);
      if (rows.length === 0) return <div className={styles.cardSub}>{empty}</div>;
      return (
        <div className={styles.list}>
          {rows.map((r) => {
            const m = members.find((x) => x.id === r.id);
            return (
              <div key={r.id} className={styles.row}>
                <div className={styles.cardTitle}>{m ? `${m.emoji} ${m.display_name}` : "Someone"}</div>
                <div className={`${styles.cardSub} mono`}>{formatMoney(r.cents)}</div>
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <div className={styles.list}>
        <Panel
          title="Me"
          subtitle="Clear totals, chill language."
          actions={
            <div className={styles.btnRow}>
              <Btn onClick={() => setModal({ kind: "menu" })}>Menu</Btn>
            </div>
          }
        >
          <div className={styles.card}>
            <div className={styles.cardTop}>
              <div className={styles.cardTitle}>You owe</div>
              {ledger.owesTotal > 0 ? <Badge kind="warn">{formatMoney(ledger.owesTotal)}</Badge> : <Badge kind="good">All even</Badge>}
            </div>
            {ledgerList(ledger.owes, "Nothing right now.")}
          </div>

          <div className={styles.card}>
            <div className={styles.cardTop}>
              <div className={styles.cardTitle}>Owed to you</div>
              {ledger.owedTotal > 0 ? <Badge kind="good">{formatMoney(ledger.owedTotal)}</Badge> : <Badge>Quiet</Badge>}
            </div>
            {ledgerList(ledger.owed, "Nothing right now.")}
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>Profile</div>
            <div className={styles.cardSub}>This is what friends see.</div>
            <div className={styles.field} style={{ marginTop: 10 }}>
              <div className={styles.label}>Name</div>
              <input className={styles.input} value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="Ava" />
            </div>
            <div className={styles.field} style={{ marginTop: 10 }}>
              <div className={styles.label}>Emoji</div>
              <input className={styles.input} value={profileEmoji} onChange={(e) => setProfileEmoji(e.target.value)} placeholder="🙂" />
            </div>
            <div className={styles.btnRow} style={{ marginTop: 10 }}>
              <Btn kind="primary" onClick={() => void saveProfile()}>
                Save
              </Btn>
              <Btn kind="ghost" onClick={() => void signOut()}>
                Sign out
              </Btn>
            </div>
          </div>
        </Panel>
      </div>
    );
  }

  function renderContextScreen(contextId: string) {
    const ctx = contexts.find((c) => c.id === contextId) || null;
    if (!ctx) return null;

    const balances = computeBalances(ctx.id);
    const suggestion = ctx.closed ? null : turnSuggestion(ctx.id);
    const transfers = computeSettleTransfers(balances);
    const myTransfers = myMemberId ? transfers.filter((t) => t.from === myMemberId || t.to === myMemberId) : [];

    const exps = expensesForContext(ctx.id);

    return (
      <div className={styles.list}>
        <div className={styles.row} style={{ marginBottom: 12 }}>
          <Btn onClick={() => setView({ kind: "tabs" })}>Back</Btn>
          <div className={styles.btnRow}>
            <Btn kind="primary" disabled={ctx.closed} onClick={() => setModal({ kind: "addExpense", contextId: ctx.id })}>
              Add expense
            </Btn>
          </div>
        </div>

        <Panel title={`${ctx.emoji} ${ctx.name}`} subtitle={ctx.closed ? "Closed. No more pings." : "Keep it light. Settle when you're ready."}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>{suggestion ? "Turn-taking suggestion" : "Vibe check"}</div>
            <div className={styles.cardSub}>{suggestion ? suggestion.text : "No nudges right now."}</div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>Balances</div>
            <div className={styles.list} style={{ marginTop: 10 }}>
              {members.map((m) => {
                const fr = friendlyBadge(balances[m.id] || 0, m.id === myMemberId);
                return (
                  <div key={m.id} className={styles.row}>
                    <div className={styles.cardSub} style={{ color: "inherit" }}>
                      <b>{m.emoji} {m.display_name}</b>
                    </div>
                    <Badge kind={fr.kind === "good" ? "good" : "warn"}>{fr.label}</Badge>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>Settle plan (optional)</div>
            <div className={styles.cardSub}>A gentle suggestion. Use any app you want.</div>
            <div className={styles.list} style={{ marginTop: 10 }}>
              {myTransfers.length === 0 ? (
                <div className={styles.cardSub}>Nothing to settle for you right now.</div>
              ) : (
                myTransfers.map((t, idx) => {
                  const otherId = t.from === myMemberId ? t.to : t.from;
                  const other = members.find((m) => m.id === otherId);
                  const direction = t.from === myMemberId ? "send" : "ask";
                  const title = direction === "send" ? `Send ${formatMoney(t.amountCents)}` : `Ask for ${formatMoney(t.amountCents)}`;
                  const sub = direction === "send" ? `To ${other ? `${other.emoji} ${other.display_name}` : "friend"}` : `From ${other ? `${other.emoji} ${other.display_name}` : "friend"}`;
                  return (
                    <div key={`${otherId}:${idx}`} className={styles.row}>
                      <div>
                        <div className={styles.cardTitle} style={{ fontSize: 14 }}>{title}</div>
                        <div className={styles.cardSub}>{sub}</div>
                      </div>
                      <Btn onClick={() => void shareText(`${title}\n${sub}\nEvenly: ${ctx.name}`)}>Share</Btn>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {ctx.type === "trip" ? (
            <div className={styles.card}>
              <div className={styles.cardTitle}>Trip status</div>
              <div className={styles.cardSub}>{ctx.closed ? "Re-open if you need to add something." : "Close it when everyone's settled."}</div>
              <div className={styles.btnRow} style={{ marginTop: 10 }}>
                <Btn onClick={() => void toggleTripClosed(ctx.id, !ctx.closed)}>{ctx.closed ? "Re-open" : "Close trip"}</Btn>
              </div>
            </div>
          ) : null}
        </Panel>

        <Panel title="Expenses" subtitle="Friendly ledger. No shame, no alarms.">
          <div className={styles.list}>
            {exps.length === 0 ? (
              <div className={styles.card}>
                <div className={styles.cardTitle}>No expenses yet</div>
                <div className={styles.cardSub}>Add the first one and Evenly will do the math.</div>
              </div>
            ) : (
              exps.map((e) => {
                const payer = members.find((m) => m.id === e.paid_by);
                const total = Number(e.amount_cents || 0) + Number(e.round_up_cents || 0);
                const when = new Date(e.created_at).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
                return (
                  <div key={e.id} className={styles.card}>
                    <div className={styles.cardTop}>
                      <span className={styles.pill}>{payer ? `${payer.emoji} ${payer.display_name}` : "Someone"} · {when}</span>
                      <span className={`${styles.pill} mono`}>{formatMoney(total)}</span>
                    </div>
                    <div className={styles.cardTitle}>{e.title}</div>
                    <div className={styles.cardSub}>
                      {e.split_type === "equal" ? "Split equally" : e.split_type === "balanced" ? "Balance it" : "Custom split"} · {e.participants?.length || 0} people
                    </div>
                    <div className={styles.btnRow} style={{ marginTop: 10 }}>
                      <Btn onClick={() => setModal({ kind: "reassignPayer", expenseId: e.id })}>Change payer</Btn>
                      <Btn onClick={() => setModal({ kind: "comments", expenseId: e.id })}>Comments</Btn>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Panel>
      </div>
    );
  }

  async function shareText(text: string) {
    try {
      if (navigator.share) {
        await navigator.share({ text, title: "Evenly" });
        return;
      }
    } catch {
      // fall back to copy
    }
    try {
      await navigator.clipboard.writeText(text);
      setToast("Copied to clipboard.");
    } catch {
      setToast("Couldn't share/copy.");
    }
  }

  function safeFilePart(input: string) {
    return String(input || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "export";
  }

  function csvCell(value: unknown) {
    const s = String(value ?? "");
    if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
    return s;
  }

  function downloadTextFile(filename: string, contents: string, mime = "text/plain;charset=utf-8") {
    try {
      const blob = new Blob([contents], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setToast("Couldn't download file on this device.");
    }
  }

  function exportExpensesCSV() {
    if (!activeGroup) return setToast("Pick a group first.");
    const ctxById = Object.fromEntries(contexts.map((c) => [c.id, c]));
    const memById = Object.fromEntries(members.map((m) => [m.id, m]));

    const header = ["created_at", "context", "title", "amount", "paid_by", "split", "participants"];
    const rows = expenses
      .slice()
      .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
      .map((e) => {
        const ctx = ctxById[e.context_id] as ContextRow | undefined;
        const payer = memById[e.paid_by] as MemberRow | undefined;
        const total = Number(e.amount_cents || 0) + Number(e.round_up_cents || 0);
        const parts = Array.isArray(e.participants) ? e.participants.map((id) => memById[id]?.display_name || id).join(" | ") : "";
        return [
          new Date(e.created_at).toISOString(),
          ctx ? `${ctx.emoji} ${ctx.name}` : e.context_id,
          e.title,
          (total / 100).toFixed(2),
          payer ? `${payer.emoji} ${payer.display_name}` : e.paid_by,
          e.split_type,
          parts,
        ].map(csvCell).join(",");
      });

    const csv = `${header.map(csvCell).join(",")}\n${rows.join("\n")}\n`;
    const name = `evenly-${safeFilePart(activeGroup.name)}-${poolMonth}.csv`;
    downloadTextFile(name, csv, "text/csv;charset=utf-8");
    setToast("Export ready.");
  }

  // --- Modals ---------------------------------------------------------------
  function ModalShell(props: { title: string; onClose: () => void; children: React.ReactNode; actions?: React.ReactNode }) {
    return (
      <div className={`${styles.modalHost} ${styles.modalHostOpen}`} role="dialog" aria-modal="true">
        <div className={styles.backdrop} onClick={props.onClose} />
        <div className={styles.modal}>
          <div className={styles.modalHead}>
            <div>
              <div className={styles.modalTitle}>{props.title}</div>
              <div className={styles.panelSub}>Friendly, not transactional.</div>
            </div>
            <button className={styles.iconBtn} type="button" onClick={props.onClose} aria-label="Close">
              ✕
            </button>
          </div>
          <div className={styles.modalBody}>{props.children}</div>
          <div className={styles.modalActions}>{props.actions ? props.actions : <Btn kind="primary" onClick={props.onClose}>Close</Btn>}</div>
        </div>
      </div>
    );
  }

  function CreateTripModal() {
    const [name, setName] = useState("");
    const [emo, setEmo] = useState("🧳");
    return (
      <ModalShell
        title="New trip"
        onClose={() => setModal(null)}
        actions={
          <>
            <Btn kind="ghost" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn kind="primary" onClick={() => void createTrip(name, emo)}>Create</Btn>
          </>
        }
      >
        <div className={styles.field}>
          <div className={styles.label}>Trip name</div>
          <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Catskills Weekend" />
        </div>
        <div className={styles.field}>
          <div className={styles.label}>Emoji</div>
          <input className={styles.input} value={emo} onChange={(e) => setEmo(e.target.value)} placeholder="🧳" />
        </div>
      </ModalShell>
    );
  }

  function AddExpenseModal(props: { contextId: string }) {
    const ctx = contexts.find((c) => c.id === props.contextId) || null;
    const initialPayer = myMemberId || members[0]?.id || "";
    const [title, setTitle] = useState("");
    const [amount, setAmount] = useState("");
    const [payer, setPayer] = useState(initialPayer);
    const [roundUp, setRoundUp] = useState(true);
    const [smartSplitOn, setSmartSplitOn] = useState(true);
    const [selected, setSelected] = useState<Record<string, boolean>>(() => Object.fromEntries(members.map((m) => [m.id, true])));
    const participantIds = Object.entries(selected).filter(([, on]) => on).map(([id]) => id);
    const amountCents = parseMoneyToCents(amount) || 0;
    const totalForSplit = amountCents + computeRoundUpCents(amountCents, roundUp);
    const smartShares = useMemo(
      () => (ctx ? suggestSmartShares(ctx.id, totalForSplit, participantIds) : {}),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [ctx?.id, totalForSplit, participantIds.join("|"), expenses, contexts],
    );

    useEffect(() => {
      setSelected((prev) => {
        const next = { ...prev };
        for (const m of members) {
          if (next[m.id] == null) next[m.id] = true;
        }
        return next;
      });
      if (!payer && members[0]?.id) setPayer(members[0].id);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [members.length]);

    return (
      <ModalShell
        title="Add expense"
        onClose={() => setModal(null)}
        actions={
          <>
            <Btn kind="ghost" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn
              kind="primary"
              onClick={() => {
                const t = title.trim();
                const cents = parseMoneyToCents(amount);
                const ids = Object.entries(selected).filter(([, on]) => on).map(([id]) => id);
                if (!ctx) return setToast("Missing context.");
                if (!t) return setToast("Add a title (Dinner, Gas…).");
                if (!cents || cents <= 0) return setToast("Add an amount (like 42.50).");
                if (!payer) return setToast("Pick who paid.");
                if (ids.length < 1) return setToast("Pick at least one person.");
                void addExpense({
                  contextId: ctx.id,
                  title: t,
                  amountCents: cents,
                  paidBy: payer,
                  participants: ids,
                  roundUpOn: roundUp,
                  splitType: smartSplitOn ? "custom" : "equal",
                  shares: smartSplitOn ? suggestSmartShares(ctx.id, cents + computeRoundUpCents(cents, roundUp), ids) : null,
                });
              }}
            >
              Add
            </Btn>
          </>
        }
      >
        <div className={styles.cardSub}>Context: {ctx ? `${ctx.emoji} ${ctx.name}` : "…"}</div>
        <div className={styles.field}>
          <div className={styles.label}>What was it?</div>
          <input className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Dinner, groceries…" />
        </div>
        <div className={styles.field}>
          <div className={styles.label}>How much?</div>
          <input className={styles.input} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" />
        </div>
        <div className={styles.field}>
          <div className={styles.label}>Who paid?</div>
          <select className={styles.input} value={payer} onChange={(e) => setPayer(e.target.value)}>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.emoji} {m.display_name}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Who’s in?</div>
          <div className={styles.list} style={{ marginTop: 10 }}>
            {members.map((m) => {
              const on = selected[m.id] !== false;
              return (
                <div key={m.id} className={styles.row}>
                  <div className={styles.cardSub} style={{ color: "inherit" }}>
                    <b>{m.emoji} {m.display_name}</b>
                  </div>
                  <Btn
                    kind={on ? "primary" : "ghost"}
                    onClick={() => setSelected((prev) => ({ ...prev, [m.id]: !on }))}
                  >
                    {on ? "In" : "Out"}
                  </Btn>
                </div>
              );
            })}
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.cardSub}>Round up totals</div>
          <Btn kind={roundUp ? "primary" : "ghost"} onClick={() => setRoundUp((x) => !x)}>{roundUp ? "On" : "Off"}</Btn>
        </div>
        <div className={styles.row}>
          <div className={styles.cardSub}>Smart split suggestion</div>
          <Btn kind={smartSplitOn ? "primary" : "ghost"} onClick={() => setSmartSplitOn((x) => !x)}>
            {smartSplitOn ? "On" : "Off"}
          </Btn>
        </div>
        {smartSplitOn ? (
          <div className={styles.card}>
            <div className={styles.cardTitle}>Suggested amounts</div>
            <div className={styles.cardSub}>Based on recent contributions and current outstanding balances.</div>
            <div className={styles.list} style={{ marginTop: 10 }}>
              {participantIds.map((id) => {
                const m = members.find((x) => x.id === id);
                const cents = Number(smartShares[id] || 0);
                return (
                  <div key={id} className={styles.row}>
                    <span className={styles.cardSub} style={{ color: "inherit" }}>{m ? `${m.emoji} ${m.display_name}` : "Member"}</span>
                    <span className={`${styles.pill} mono`}>{formatMoney(cents)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </ModalShell>
    );
  }

  function CommentsModal(props: { expenseId: string }) {
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<CommentRow[]>([]);
    const [text, setText] = useState("");
    const expense = expenses.find((e) => e.id === props.expenseId) || null;

    useEffect(() => {
      let alive = true;
      (async () => {
        setLoading(true);
        const res = await supabase
          .from("comments")
          .select("id,group_id,expense_id,by_member_id,text,created_at")
          .eq("expense_id", props.expenseId)
          .order("created_at", { ascending: true });
        if (!alive) return;
        if (res.error) setToast(res.error.message);
        setRows((res.data || []) as CommentRow[]);
        setLoading(false);
      })();
      return () => {
        alive = false;
      };
    }, [props.expenseId]);

    async function post() {
      const t = text.trim();
      if (!t) return setToast("Type something.");
      if (!activeGroupId) return;
      if (!myMemberId) return setToast("Missing your member id.");
      const ins = await supabase.from("comments").insert({
        group_id: activeGroupId,
        expense_id: props.expenseId,
        by_member_id: myMemberId,
        text: t,
      });
      if (ins.error) return setToast(ins.error.message);
      setText("");
      const res = await supabase
        .from("comments")
        .select("id,group_id,expense_id,by_member_id,text,created_at")
        .eq("expense_id", props.expenseId)
        .order("created_at", { ascending: true });
      if (res.error) return setToast(res.error.message);
      setRows((res.data || []) as CommentRow[]);
    }

    return (
      <ModalShell
        title="Comments"
        onClose={() => setModal(null)}
        actions={
          <>
            <Btn kind="ghost" onClick={() => setModal(null)}>Close</Btn>
            <Btn kind="primary" onClick={() => void post()}>Post</Btn>
          </>
        }
      >
        <div className={styles.cardSub}>On: {expense ? expense.title : "Expense"}</div>
        <div className={styles.list}>
          {loading ? (
            <div className={styles.cardSub}>Loading…</div>
          ) : rows.length === 0 ? (
            <div className={styles.cardSub}>No comments yet.</div>
          ) : (
            rows.map((c) => {
              const m = members.find((x) => x.id === c.by_member_id);
              return (
                <div key={c.id} className={styles.card}>
                  <div className={styles.cardTop}>
                    <span className={styles.pill}>{m ? `${m.emoji} ${m.display_name}` : "Someone"}</span>
                    <span className={styles.pill}>{new Date(c.created_at).toLocaleString()}</span>
                  </div>
                  <div className={styles.cardSub} style={{ color: "inherit", marginTop: 10 }}>{c.text}</div>
                </div>
              );
            })
          )}
        </div>
        <div className={styles.field}>
          <div className={styles.label}>Say something</div>
          <input className={styles.input} value={text} onChange={(e) => setText(e.target.value)} placeholder="Thanks!" />
        </div>
      </ModalShell>
    );
  }

  function PoolAdjustModal() {
    const [per, setPer] = useState(pool ? (Number(pool.per_person_cents || 0) / 100).toFixed(2) : "");
    const [by, setBy] = useState<Record<string, string>>(() => {
      const out: Record<string, string> = {};
      for (const m of members) {
        const v = poolContrib[m.id];
        const cents = v != null ? v : (pool ? Number(pool.per_person_cents || 0) : 0);
        out[m.id] = cents ? (cents / 100).toFixed(2) : "";
      }
      return out;
    });

    async function save() {
      if (!activeGroupId) return;
      if (!pool) return;
      const perCents = parseMoneyToCents(per) || 0;
      const up = await supabase
        .from("pools")
        .upsert({ group_id: activeGroupId, month: poolMonth, per_person_cents: perCents }, { onConflict: "group_id,month" })
        .select("id,group_id,month,per_person_cents,created_at")
        .single();
      if (up.error) return setToast(up.error.message);
      const poolId = (up.data as PoolRow).id;
      for (const m of members) {
        const cents = parseMoneyToCents(by[m.id]) ?? perCents;
        const res = await supabase.from("pool_contributions").upsert({ pool_id: poolId, member_id: m.id, amount_cents: Number(cents || 0) }, { onConflict: "pool_id,member_id" });
        if (res.error) return setToast(res.error.message);
      }
      setModal(null);
      await refreshGroupData(activeGroupId);
      setToast("Pool updated.");
    }

    return (
      <ModalShell
        title="Adjust pool"
        onClose={() => setModal(null)}
        actions={
          <>
            <Btn kind="ghost" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn kind="primary" onClick={() => void save()}>Save</Btn>
          </>
        }
      >
        <div className={styles.cardSub}>Month: {poolMonth}</div>
        <div className={styles.field}>
          <div className={styles.label}>Per-person monthly amount</div>
          <input className={styles.input} value={per} onChange={(e) => setPer(e.target.value)} inputMode="decimal" placeholder="45.00" />
        </div>
        <div className={styles.cardSub}>You can keep it equal, or nudge individual amounts.</div>
        <div className={styles.list}>
          {members.map((m) => (
            <div key={m.id} className={styles.field}>
              <div className={styles.label}>{m.emoji} {m.display_name}</div>
              <input className={styles.input} value={by[m.id] || ""} onChange={(e) => setBy((prev) => ({ ...prev, [m.id]: e.target.value }))} inputMode="decimal" placeholder={per || "0.00"} />
            </div>
          ))}
        </div>
      </ModalShell>
    );
  }

  function PoolDeductionModal() {
    const [title, setTitle] = useState("");
    const [emo, setEmo] = useState("🧾");
    const [amt, setAmt] = useState("");

    async function add() {
      if (!pool) return setToast("Pool not ready yet.");
      const t = title.trim();
      const e = (emo.trim() || "🧾").slice(0, 8);
      const cents = parseMoneyToCents(amt);
      if (!t) return setToast("Name it (Netflix, utilities…).");
      if (!cents || cents <= 0) return setToast("Add an amount (like 15.99).");
      const ins = await supabase.from("pool_deductions").insert({ pool_id: pool.id, title: t, emoji: e, amount_cents: cents, at: new Date().toISOString() });
      if (ins.error) return setToast(ins.error.message);
      setModal(null);
      if (activeGroupId) await refreshGroupData(activeGroupId);
      setToast("Deducted.");
    }

    return (
      <ModalShell
        title="Add deduction"
        onClose={() => setModal(null)}
        actions={
          <>
            <Btn kind="ghost" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn kind="primary" onClick={() => void add()}>Add</Btn>
          </>
        }
      >
        <div className={styles.field}>
          <div className={styles.label}>What was it?</div>
          <input className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Netflix, electric…" />
        </div>
        <div className={styles.field}>
          <div className={styles.label}>Emoji</div>
          <input className={styles.input} value={emo} onChange={(e) => setEmo(e.target.value)} placeholder="🧾" />
        </div>
        <div className={styles.field}>
          <div className={styles.label}>Amount</div>
          <input className={styles.input} value={amt} onChange={(e) => setAmt(e.target.value)} inputMode="decimal" placeholder="15.99" />
        </div>
      </ModalShell>
    );
  }

  function ReassignPayerModal(props: { expenseId: string }) {
    const expense = expenses.find((e) => e.id === props.expenseId) || null;
    const [payer, setPayer] = useState(expense?.paid_by || myMemberId || members[0]?.id || "");

    async function save() {
      if (!expense) return;
      if (!payer) return setToast("Pick who paid.");
      const up = await supabase.from("expenses").update({ paid_by: payer }).eq("id", expense.id).eq("group_id", expense.group_id);
      if (up.error) return setToast(up.error.message);
      setModal(null);
      if (activeGroupId) await refreshGroupData(activeGroupId);
      setToast("Payer updated.");
    }

    return (
      <ModalShell
        title="Change payer"
        onClose={() => setModal(null)}
        actions={
          <>
            <Btn kind="ghost" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn kind="primary" onClick={() => void save()}>Save</Btn>
          </>
        }
      >
        <div className={styles.cardSub}>{expense ? `Expense: ${expense.title}` : "Expense"}</div>
        <div className={styles.field}>
          <div className={styles.label}>Who picked this up?</div>
          <select className={styles.input} value={payer} onChange={(e) => setPayer(e.target.value)}>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.emoji} {m.display_name}
              </option>
            ))}
          </select>
        </div>
      </ModalShell>
    );
  }

  function LedgerDetailModal(props: { mode: "owe" | "owed" }) {
    const rows: Array<{ memberId: string; amount: number; contextId: string }> = [];
    for (const ctx of contexts) {
      if (ctx.closed) continue;
      const transfers = computeSettleTransfers(computeBalances(ctx.id));
      for (const t of transfers) {
        if (props.mode === "owe" && t.from === myMemberId) rows.push({ memberId: t.to, amount: t.amountCents, contextId: ctx.id });
        if (props.mode === "owed" && t.to === myMemberId) rows.push({ memberId: t.from, amount: t.amountCents, contextId: ctx.id });
      }
    }

    return (
      <ModalShell title={props.mode === "owe" ? "You owe breakdown" : "You're owed breakdown"} onClose={() => setModal(null)}>
        <div className={styles.list}>
          {rows.length === 0 ? (
            <div className={styles.cardSub}>Nothing open right now.</div>
          ) : rows.map((r, idx) => {
            const m = members.find((x) => x.id === r.memberId);
            const ctx = contexts.find((c) => c.id === r.contextId);
            const related = expenses
              .filter((e) => e.context_id === r.contextId)
              .slice(0, 2)
              .map((e) => e.title)
              .join(", ");
            return (
              <div key={`${r.memberId}:${r.contextId}:${idx}`} className={styles.card}>
                <div className={styles.cardTop}>
                  <span className={styles.pill}>{m ? `${m.emoji} ${m.display_name}` : "Member"}</span>
                  <span className={`${styles.pill} mono`}>{formatMoney(r.amount)}</span>
                </div>
                <div className={styles.cardSub}>
                  Group: {activeGroup?.name || "Group"} · Context: {ctx ? `${ctx.emoji} ${ctx.name}` : "Context"}
                </div>
                <div className={styles.cardSub}>For: {related || "Shared expenses"}</div>
              </div>
            );
          })}
        </div>
      </ModalShell>
    );
  }

  function renderModal() {
    if (!modal) return null;

    if (modal.kind === "menu") {
      return (
        <ModalShell title="Menu" onClose={() => setModal(null)} actions={<Btn kind="primary" onClick={() => setModal(null)}>Done</Btn>}>
          <div className={styles.list}>
            <div className={styles.card}>
              <div className={styles.cardTitle}>Group</div>
              <div className={styles.cardSub}>{activeGroup ? `${activeGroup.name} · code ${activeGroup.join_code}` : "Pick a group"}</div>
              <div className={styles.btnRow} style={{ marginTop: 10 }}>
                <Btn onClick={() => activeGroup ? void shareText(`Join my Evenly group: ${activeGroup.join_code}`) : undefined}>Copy join code</Btn>
                <Btn kind="primary" onClick={() => { setModal(null); setActiveGroupId(""); }}>Switch group</Btn>
              </div>
            </div>

            {activeGroupId ? (
              <div className={styles.card}>
                <div className={styles.cardTitle}>Members</div>
                <div className={styles.cardSub}>{isAdmin ? "Admins can remove people." : "Only admins can remove people."}</div>
                <div className={styles.list} style={{ marginTop: 10 }}>
                  {members.map((m) => (
                    <div key={m.id} className={styles.row}>
                      <div className={styles.cardSub} style={{ color: "inherit" }}>
                        <b>{m.emoji} {m.display_name}</b>{m.role === "admin" ? " · admin" : ""}
                      </div>
                      {m.id === myMemberId ? (
                        <Btn kind="ghost" onClick={() => void leaveActiveGroup()}>Leave</Btn>
                      ) : isAdmin ? (
                        <Btn kind="ghost" onClick={() => void removeMember(m.id)}>Remove</Btn>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className={styles.card}>
              <div className={styles.cardTitle}>Sync</div>
              <div className={styles.cardSub}>Auto-refreshes every few seconds while you’re in a group.</div>
              <div className={styles.btnRow} style={{ marginTop: 10 }}>
                <Btn onClick={() => activeGroupId ? void refreshGroupData(activeGroupId) : undefined}>Sync now</Btn>
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardTitle}>Export</div>
              <div className={styles.cardSub}>Download a CSV summary of all expenses.</div>
              <div className={styles.btnRow} style={{ marginTop: 10 }}>
                <Btn onClick={() => exportExpensesCSV()}>Download CSV</Btn>
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardTitle}>Account</div>
              <div className={styles.cardSub}>Signed in as {userEmail}</div>
              <div className={styles.btnRow} style={{ marginTop: 10 }}>
                <Btn kind="ghost" onClick={() => void signOut()}>Sign out</Btn>
              </div>
            </div>
          </div>
        </ModalShell>
      );
    }

    if (modal.kind === "createTrip") return <CreateTripModal />;
    if (modal.kind === "addExpense") return <AddExpenseModal contextId={modal.contextId} />;
    if (modal.kind === "reassignPayer") return <ReassignPayerModal expenseId={modal.expenseId} />;
    if (modal.kind === "comments") return <CommentsModal expenseId={modal.expenseId} />;
    if (modal.kind === "poolAdjust") return <PoolAdjustModal />;
    if (modal.kind === "poolDeduction") return <PoolDeductionModal />;
    if (modal.kind === "ledgerDetail") return <LedgerDetailModal mode={modal.mode} />;

    return null;
  }

  // --- Render root ----------------------------------------------------------
  const topSubtitle =
    signedIn
      ? activeGroup
        ? `${activeGroup.name} · code ${activeGroup.join_code}`
        : "Create or join a group"
      : "Sign in to start";

  let main: React.ReactNode = null;
  if (authLoading) main = <div className={styles.list}><div className={styles.toast}>Loading…</div></div>;
  else if (!signedIn) main = renderAuth();
  else if (!activeGroupId) main = renderGroups();
  else if (view.kind === "context") main = renderContextScreen(view.contextId);
  else if (tab === "trips") main = renderTripsTab();
  else if (tab === "home") main = renderHomeTab();
  else if (tab === "notes") main = renderNotesTab();
  else main = renderMeTab();

  const tabs: Array<{ key: TabKey; icon: string; label: string }> = [
    { key: "trips", icon: "🧳", label: "Trips" },
    { key: "home", icon: "🏠", label: "Home" },
    { key: "notes", icon: "💬", label: "Notes" },
    { key: "me", icon: "✨", label: "Me" },
  ];

  return (
    <>
      <div className={styles.bg} aria-hidden="true" />
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <div className={styles.brand}>
            <div className={styles.mark} aria-hidden="true">≡</div>
            <div className={styles.brandText}>
              <div className={styles.brandName}>Evenly</div>
              <div className={styles.brandSub}>{topSubtitle}</div>
            </div>
          </div>
          <div className={styles.topActions}>
            {signedIn && activeGroupId ? (
              <button className={styles.iconBtn} type="button" onClick={() => setModal({ kind: "menu" })} aria-label="Menu">
                ☰
              </button>
            ) : null}
            {signedIn ? (
              <button className={styles.iconBtn} type="button" onClick={() => void loadGroups()} aria-label="Refresh">
                ↻
              </button>
            ) : null}
          </div>
        </header>

        <main className={styles.main}>{main}</main>

        {signedIn && activeGroupId ? (
          <nav className={styles.tabbar} aria-label="Primary">
            {tabs.map((t) => (
              <button
                key={t.key}
                className={`${styles.tab} ${tab === t.key && view.kind === "tabs" ? styles.tabActive : ""}`}
                type="button"
                onClick={() => { setView({ kind: "tabs" }); setTab(t.key); }}
                aria-current={tab === t.key && view.kind === "tabs" ? "page" : undefined}
              >
                <span className={styles.tabIcon} aria-hidden="true">{t.icon}</span>
                <span className={styles.tabLabel}>{t.label}</span>
              </button>
            ))}
          </nav>
        ) : null}
      </div>

      {toast ? <div className={styles.toast} style={{ maxWidth: 520, margin: "0 auto" }}>{toast}</div> : null}
      {renderModal()}
    </>
  );
}
