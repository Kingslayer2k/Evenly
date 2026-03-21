"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { getStoredDisplayName, setStoredDisplayName } from "../lib/groupData";

const AUTH_MODES = {
  SIGN_UP: "sign-up",
  LOG_IN: "log-in",
};

function AuthModeToggle({ mode, onChange }) {
  return (
    <div className="mb-6 inline-flex rounded-full bg-[#E1F9D8] p-1 shadow-[0_4px_14px_rgba(95,125,106,0.08)]">
      <button
        type="button"
        onClick={() => onChange(AUTH_MODES.SIGN_UP)}
        className={`rounded-full px-4 py-2 text-[14px] font-semibold transition ${
          mode === AUTH_MODES.SIGN_UP
            ? "bg-white text-[#1C1917] shadow-[0_2px_8px_rgba(28,25,23,0.08)]"
            : "text-[#5F7D6A]"
        }`}
      >
        Create account
      </button>
      <button
        type="button"
        onClick={() => onChange(AUTH_MODES.LOG_IN)}
        className={`rounded-full px-4 py-2 text-[14px] font-semibold transition ${
          mode === AUTH_MODES.LOG_IN
            ? "bg-white text-[#1C1917] shadow-[0_2px_8px_rgba(28,25,23,0.08)]"
            : "text-[#5F7D6A]"
        }`}
      >
        Log in
      </button>
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [mode, setMode] = useState(AUTH_MODES.SIGN_UP);
  const [displayName, setDisplayName] = useState(() => getStoredDisplayName());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) return;

    let isMounted = true;

    async function bootstrapSession() {
      const { data } = await supabase.auth.getSession();
      if (isMounted && data.session?.user) {
        router.replace("/groups");
      }
    }

    void bootstrapSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        router.replace("/groups");
      }
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [router]);

  function resetMessages() {
    setFeedback("");
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!supabase || isSubmitting) return;

    const trimmedName = displayName.trim();
    const trimmedEmail = email.trim().toLowerCase();

    resetMessages();

    if (!trimmedEmail) {
      setError("Add your email first.");
      return;
    }

    if (!password) {
      setError("Add your password first.");
      return;
    }

    if (password.length < 6) {
      setError("Use at least 6 characters for the password.");
      return;
    }

    setIsSubmitting(true);

    if (mode === AUTH_MODES.SIGN_UP) {
      if (!trimmedName) {
        setError("Add your name first.");
        setIsSubmitting(false);
        return;
      }

      if (password !== confirmPassword) {
        setError("Your passwords need to match.");
        setIsSubmitting(false);
        return;
      }

      setStoredDisplayName(trimmedName);

      const { data, error: authError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            display_name: trimmedName,
            name: trimmedName,
          },
        },
      });

      if (authError) {
        setError(authError.message);
        setIsSubmitting(false);
        return;
      }

      if (data.session?.user) {
        router.replace("/groups");
        return;
      }

      setFeedback(
        "Account created. If your Supabase project still requires email confirmation, confirm once and then log in here.",
      );
      setMode(AUTH_MODES.LOG_IN);
      setIsSubmitting(false);
      return;
    }

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    if (authError) {
      setError(authError.message);
      setIsSubmitting(false);
      return;
    }

    const rememberedName =
      trimmedName ||
      data.user?.user_metadata?.display_name ||
      data.user?.user_metadata?.name ||
      getStoredDisplayName();

    if (rememberedName) {
      setStoredDisplayName(rememberedName);
    }

    router.replace("/groups");
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col items-center px-5 pt-[60px] pb-[80px]">
        <h1
          className="text-center text-[36px] font-semibold leading-[1.2] tracking-[-0.5px] text-[#3A4E43]"
          style={{ fontFamily: "Tiempos Headline, Georgia, 'Times New Roman', serif" }}
        >
          <span className="block">Welcome To</span>
          <span className="block">Evenly.</span>
        </h1>

        <p
          className="mt-3 mb-[44px] text-center text-[13px] font-semibold tracking-[-0.02em] text-[#5F7D6A]"
          style={{
            fontFamily:
              "Styrene A, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif",
          }}
        >
          Roommates, trips, and shared tabs without the awkwardness.
        </p>

        <div className="relative mb-[44px] h-[280px] w-[320px]">
          <div className="absolute left-2 top-1 h-[140px] w-[200px] -rotate-12 rounded-[45%_55%_58%_42%/48%_62%_38%_52%] bg-[#E1F9D8]" />
          <div className="absolute right-2 top-[92px] h-[120px] w-[180px] rotate-[8deg] rounded-[62%_38%_41%_59%/52%_46%_54%_48%] bg-[#C0CFB2]" />
          <div className="absolute bottom-1 left-[34px] h-[130px] w-[210px] -rotate-6 rounded-[56%_44%_63%_37%/40%_58%_42%_60%] bg-[#3A4E43]" />
        </div>

        <div className="w-full max-w-[340px] text-center">
          <AuthModeToggle
            mode={mode}
            onChange={(nextMode) => {
              setMode(nextMode);
              resetMessages();
            }}
          />
        </div>

        <form onSubmit={handleSubmit} className="w-full max-w-[340px]">
          {mode === AUTH_MODES.SIGN_UP ? (
            <input
              type="text"
              autoComplete="name"
              placeholder="Your name"
              value={displayName}
              onChange={(event) => {
                setDisplayName(event.target.value);
                if (error) setError("");
              }}
              className="h-[52px] w-full rounded-full border border-[#E1F9D8] bg-[#F9FFF7] px-6 text-[16px] font-normal text-[#1C1917] placeholder:text-[#9CA3AF] focus:outline-none"
              style={{
                fontFamily:
                  "Styrene A, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif",
              }}
            />
          ) : null}

          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (error) setError("");
            }}
            className={`${mode === AUTH_MODES.SIGN_UP ? "mt-4" : ""} h-[52px] w-full rounded-full border border-[#E1F9D8] bg-[#F9FFF7] px-6 text-[16px] font-normal text-[#1C1917] placeholder:text-[#9CA3AF] focus:outline-none`}
            style={{
              fontFamily:
                "Styrene A, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif",
            }}
          />

          <input
            type="password"
            autoComplete={mode === AUTH_MODES.SIGN_UP ? "new-password" : "current-password"}
            placeholder="Password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (error) setError("");
            }}
            className="mt-4 h-[52px] w-full rounded-full border border-[#E1F9D8] bg-[#F9FFF7] px-6 text-[16px] font-normal text-[#1C1917] placeholder:text-[#9CA3AF] focus:outline-none"
            style={{
              fontFamily:
                "Styrene A, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif",
            }}
          />

          {mode === AUTH_MODES.SIGN_UP ? (
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                if (error) setError("");
              }}
              className="mt-4 h-[52px] w-full rounded-full border border-[#E1F9D8] bg-[#F9FFF7] px-6 text-[16px] font-normal text-[#1C1917] placeholder:text-[#9CA3AF] focus:outline-none"
              style={{
                fontFamily:
                  "Styrene A, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif",
              }}
            />
          ) : null}

          <button
            type="submit"
            disabled={
              !email.trim() ||
              !password ||
              isSubmitting ||
              !supabase ||
              (mode === AUTH_MODES.SIGN_UP && (!displayName.trim() || !confirmPassword))
            }
            className="mt-4 h-[52px] w-full rounded-full border-0 bg-[#5F7D6A] text-[16px] font-semibold text-white transition duration-200 ease-out hover:bg-[#3A4E43] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#A3B8A8]"
            style={{
              fontFamily:
                "Styrene A, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif",
            }}
          >
            {isSubmitting
              ? mode === AUTH_MODES.SIGN_UP
                ? "Creating account..."
                : "Logging in..."
              : mode === AUTH_MODES.SIGN_UP
                ? "Create my account"
                : "Log me in"}
          </button>

          {feedback ? (
            <p className="mt-4 rounded-2xl bg-[#E1F9D8] px-4 py-3 text-center text-[13px] font-medium text-[#3A4E43]">{feedback}</p>
          ) : null}

          {error ? (
            <p className="mt-4 text-center text-[13px] font-medium text-[#DC2626]">{error}</p>
          ) : null}

          {!supabase ? (
            <p className="mt-4 text-center text-[13px] font-medium text-[#6B7280]">
              Add your Supabase URL and anon key in Vercel or `.env.local` to enable sign in.
            </p>
          ) : null}

          {supabase ? (
            <p className="mt-4 text-center text-[12px] font-medium text-[#9CA3AF]">
              Your name is remembered on this device and synced into Evenly after you sign in.
            </p>
          ) : null}
        </form>
      </div>
    </main>
  );
}
