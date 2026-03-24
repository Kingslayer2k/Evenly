"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import useLowPerformanceMode from "../../hooks/useLowPerformanceMode";
import usePushNotifications from "../../hooks/usePushNotifications";
import useTheme from "../../hooks/useTheme";
import { pageTransition } from "../../lib/animations";
import { supabase } from "../../lib/supabase";

function ThemeIcon({ isDark }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      {isDark ? (
        <>
          <path d="M12 3v2.5" />
          <path d="M12 18.5V21" />
          <path d="M3 12h2.5" />
          <path d="M18.5 12H21" />
          <path d="m5.6 5.6 1.8 1.8" />
          <path d="m16.6 16.6 1.8 1.8" />
          <path d="m18.4 5.6-1.8 1.8" />
          <path d="m7.4 16.6-1.8 1.8" />
          <circle cx="12" cy="12" r="4" />
        </>
      ) : (
        <path d="M20 15.2A7.5 7.5 0 1 1 8.8 4a6.4 6.4 0 0 0 11.2 11.2Z" />
      )}
    </svg>
  );
}

function SettingsRow({ title, subtitle, onClick, trailing = ">" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[56px] w-full items-center justify-between gap-4 border-b border-[var(--border-soft)] px-5 py-3 text-left last:border-b-0 hover:bg-[var(--surface-muted)]"
    >
      <div className="min-w-0">
        <div className="text-[16px] font-medium text-[var(--text)]">{title}</div>
        {subtitle ? <div className="mt-1 text-[13px] text-[var(--text-muted)]">{subtitle}</div> : null}
      </div>
      <div className="shrink-0 text-[var(--text-soft)]">{trailing}</div>
    </button>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const reduceMotion = useLowPerformanceMode();
  const { isDark, toggleTheme } = useTheme();
  const [user, setUser] = useState(null);
  const { permission, isSubscribed, isSupported, subscribe, unsubscribe } = usePushNotifications(user?.id);
  const [profile, setProfile] = useState(null);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [venmo, setVenmo] = useState("");
  const [cashApp, setCashApp] = useState("");
  const [phone, setPhone] = useState("");
  const [isSavingHandles, setIsSavingHandles] = useState(false);
  const [handlesSaved, setHandlesSaved] = useState(false);

  useEffect(() => {
    if (!supabase) return;

    let isMounted = true;

    async function bootstrapAuth() {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;
      const nextUser = data.session?.user || null;
      setUser(nextUser);

      if (nextUser) {
        const profileResponse = await supabase
          .from("profiles")
          .select("display_name, username, venmo_username, cash_app_tag, zelle_phone, phone")
          .eq("user_id", nextUser.id)
          .maybeSingle();
        if (isMounted && !profileResponse.error && profileResponse.data) {
          setProfile(profileResponse.data);
          setVenmo(profileResponse.data.venmo_username || "");
          setCashApp(profileResponse.data.cash_app_tag || "");
          setPhone(profileResponse.data.zelle_phone || profileResponse.data.phone || "");
        }
      }
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

  useEffect(() => {
    router.prefetch("/groups");
    router.prefetch("/activity");
    router.prefetch("/people");
  }, [router]);

  const handleLogout = useCallback(async () => {
    await supabase?.auth.signOut();
    router.replace("/");
  }, [router]);

  const handleSaveHandles = useCallback(async () => {
    if (!supabase || !user) return;
    setIsSavingHandles(true);
    try {
      await supabase.from("profiles").upsert(
        {
          user_id: user.id,
          venmo_username: venmo.replace(/^@/, "").trim(),
          cash_app_tag: cashApp.replace(/^\$/, "").trim(),
          zelle_phone: phone.trim(),
          phone: phone.trim(),
        },
        { onConflict: "user_id" },
      );
      // Mirror to all group_members so counterparties can see handles
      await supabase
        .from("group_members")
        .update({
          venmo_username: venmo.replace(/^@/, "").trim(),
          phone: phone.trim(),
        })
        .eq("user_id", user.id);
    } catch (err) {
      console.error("Failed to save payment handles:", err);
    } finally {
      setIsSavingHandles(false);
      setHandlesSaved(true);
      setTimeout(() => {
        setHandlesSaved(false);
        setIsPaymentOpen(false);
      }, 1200);
    }
  }, [cashApp, phone, user, venmo]);

  const displayName =
    profile?.display_name || user?.user_metadata?.display_name || user?.email?.split("@")[0] || "You";
  const username = profile?.username || user?.email?.split("@")[0] || "evenly";

  return (
    <motion.main
      className="min-h-screen max-w-[100vw] overflow-x-hidden bg-[var(--bg)] pb-28"
      initial={reduceMotion ? false : pageTransition.initial}
      animate={reduceMotion ? undefined : pageTransition.animate}
      transition={pageTransition.transition}
    >
      <div className="mx-auto w-full max-w-[460px] px-6 pt-6">
        <section className="rounded-[28px] border border-[var(--border)] bg-[linear-gradient(180deg,var(--surface)_0%,var(--surface-soft)_100%)] px-6 py-6 shadow-[var(--shadow-soft)]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[var(--surface-accent)] text-[22px] font-semibold text-[var(--accent-strong)]">
                {displayName.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-[28px] font-bold tracking-[-0.04em] text-[var(--text)]">
                  Settings
                </div>
                <div className="mt-1 text-[14px] text-[var(--text-muted)]">
                  Account, preferences, and how Evenly feels on your phone.
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--text-muted)]"
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              <ThemeIcon isDark={isDark} />
            </button>
          </div>

          <div className="mt-5 rounded-[20px] bg-[var(--surface)] px-4 py-4">
            <div className="text-[18px] font-semibold text-[var(--text)]">{displayName}</div>
            <div className="mt-1 text-[14px] text-[var(--text-muted)]">@{username}</div>
            <div className="mt-3 text-[14px] text-[var(--text-muted)]">{user?.email || "Sign in to manage your account"}</div>
          </div>
        </section>

        <section className="mt-4 overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)]">
          <div className="px-5 pt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
            Preferences
          </div>
          <div className="mt-3">
            <SettingsRow
              title="Notifications"
              subtitle={
                !isSupported
                  ? "Not supported in this browser"
                  : isSubscribed
                    ? "On — you'll hear about new expenses"
                    : permission === "denied"
                      ? "Blocked — allow in browser settings"
                      : "Off — tap to enable"
              }
              onClick={isSupported && permission !== "denied" ? () => void (isSubscribed ? unsubscribe() : subscribe()) : undefined}
              trailing={
                isSupported && permission !== "denied" ? (
                  <div
                    className={`relative h-7 w-12 rounded-full transition ${isSubscribed ? "bg-[var(--accent)]" : "bg-[var(--surface-muted)]"}`}
                  >
                    <span
                      className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${isSubscribed ? "left-5" : "left-0.5"}`}
                    />
                  </div>
                ) : null
              }
            />
            <SettingsRow
              title="Payment methods"
              subtitle={
                venmo || cashApp || phone
                  ? [venmo && `@${venmo}`, cashApp && `$${cashApp}`, phone].filter(Boolean).join(" · ")
                  : "Add Venmo, Cash App, Zelle"
              }
              onClick={() => setIsPaymentOpen(true)}
            />
            <SettingsRow title="Currency" subtitle="USD ($)" onClick={() => {}} />
            <button
              type="button"
              onClick={toggleTheme}
              className="flex min-h-[56px] w-full items-center justify-between gap-4 border-b border-[var(--border-soft)] px-5 py-3 text-left hover:bg-[var(--surface-muted)]"
            >
              <div>
                <div className="text-[16px] font-medium text-[var(--text)]">Theme</div>
                <div className="mt-1 text-[13px] text-[var(--text-muted)]">
                  {isDark ? "Dark mode is on" : "Light mode is on"}
                </div>
              </div>
              <div
                className={`relative h-8 w-14 rounded-full transition ${isDark ? "bg-[var(--accent)]" : "bg-[var(--surface-muted)]"}`}
              >
                <span
                  className={`absolute top-1 h-6 w-6 rounded-full bg-white transition ${isDark ? "left-7" : "left-1"}`}
                />
              </div>
            </button>
          </div>
        </section>

        <section className="mt-4 overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)]">
          <div className="px-5 pt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
            Support
          </div>
          <div className="mt-3">
            <SettingsRow title="Help & FAQ" subtitle="Answers for roommates, trips, and settlement flows" onClick={() => {}} />
            <SettingsRow title="Contact support" subtitle="Reach out when something feels off" onClick={() => {}} />
            <SettingsRow title="Privacy policy" onClick={() => {}} />
            <SettingsRow title="Terms of service" onClick={() => {}} />
          </div>
        </section>

        <button
          type="button"
          onClick={handleLogout}
          className="mt-5 flex min-h-[52px] w-full items-center justify-center rounded-full border border-[rgba(220,38,38,0.24)] bg-[var(--surface)] px-5 text-[16px] font-semibold text-[var(--danger)] shadow-[var(--shadow-soft)]"
        >
          Log out
        </button>

        <div className="mt-4 pb-6 text-center text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--text-soft)]">
          Evenly 2.0 foundation
        </div>
      </div>
      {isPaymentOpen ? (
        <div className="fixed inset-0 z-50 bg-[var(--overlay)]" onClick={() => setIsPaymentOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Payment methods"
            className="fixed inset-x-0 bottom-0 rounded-t-[28px] border border-[var(--border)] bg-[var(--surface)] px-6 pt-6 pb-10 shadow-[0_-16px_48px_rgba(28,25,23,0.18)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-[var(--border)]" />
            <h2 className="text-[22px] font-bold tracking-[-0.04em] text-[var(--text)]">Payment methods</h2>
            <p className="mt-1 text-[14px] text-[var(--text-muted)]">
              Your handles let others open Venmo, Cash App, or Zelle pre-filled when settling up.
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                  Venmo username
                </label>
                <div className="relative mt-2">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[16px] font-medium text-[var(--text-muted)]">@</span>
                  <input
                    type="text"
                    autoComplete="off"
                    placeholder="username"
                    value={venmo}
                    onChange={(e) => setVenmo(e.target.value.replace(/^@/, ""))}
                    className="h-[52px] w-full rounded-[14px] border border-[var(--border)] bg-[var(--surface-muted)] pl-8 pr-4 text-[16px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                  Cash App $cashtag
                </label>
                <div className="relative mt-2">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[16px] font-medium text-[var(--text-muted)]">$</span>
                  <input
                    type="text"
                    autoComplete="off"
                    placeholder="cashtag"
                    value={cashApp}
                    onChange={(e) => setCashApp(e.target.value.replace(/^\$/, ""))}
                    className="h-[52px] w-full rounded-[14px] border border-[var(--border)] bg-[var(--surface-muted)] pl-8 pr-4 text-[16px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                  Phone (Zelle &amp; Apple Cash)
                </label>
                <input
                  type="tel"
                  autoComplete="tel"
                  placeholder="+1 (555) 000-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-2 h-[52px] w-full rounded-[14px] border border-[var(--border)] bg-[var(--surface-muted)] px-4 text-[16px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveHandles}
              disabled={isSavingHandles}
              className="mt-6 flex min-h-[52px] w-full items-center justify-center rounded-full bg-[var(--accent)] text-[16px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {handlesSaved ? "Saved!" : isSavingHandles ? "Saving..." : "Save payment info"}
            </button>
          </div>
        </div>
      ) : null}
    </motion.main>
  );
}
