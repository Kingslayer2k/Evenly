"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function OnboardingPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
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

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !supabase) return;

    setIsSending(true);
    setFeedback("");
    setError("");

    const { error: authError } = await supabase.auth.signInWithOtp({
      email: trimmedEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/groups`,
      },
    });

    if (authError) {
      setError(authError.message);
      setIsSending(false);
      return;
    }

    setFeedback("Magic link sent. Open it on this phone to jump into Evenly.");
    setIsSending(false);
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
          className="mt-3 mb-[60px] text-center text-[13px] font-semibold tracking-[-0.02em] text-[#8BA888]"
          style={{ fontFamily: "Styrene A, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif" }}
        >
          So happy to have you here.
        </p>

        <div className="relative mb-[60px] h-[280px] w-[320px]">
          <div className="absolute left-2 top-1 h-[140px] w-[200px] -rotate-12 rounded-[45%_55%_58%_42%/48%_62%_38%_52%] bg-[#C0CFB2]" />
          <div className="absolute right-2 top-[92px] h-[120px] w-[180px] rotate-[8deg] rounded-[62%_38%_41%_59%/52%_46%_54%_48%] bg-[#8BA888]" />
          <div className="absolute bottom-1 left-[34px] h-[130px] w-[210px] -rotate-6 rounded-[56%_44%_63%_37%/40%_58%_42%_60%] bg-[#3A4E43]" />
        </div>

        <form onSubmit={handleSubmit} className="w-full max-w-[340px]">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-[52px] w-full rounded-full border-0 bg-[#F3F4F6] px-6 text-[16px] font-normal text-[#1C1917] placeholder:text-[#9CA3AF] focus:outline-none"
            style={{ fontFamily: "Styrene A, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif" }}
          />

          <button
            type="submit"
            disabled={!email.trim() || isSending || !supabase}
            className="mt-4 h-[52px] w-full rounded-full border-0 bg-[#8BA888] text-[16px] font-semibold text-white transition duration-200 ease-out hover:bg-[#5F7D6A] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#C0CFB2]"
            style={{ fontFamily: "Styrene A, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif" }}
          >
            {isSending ? "Sending..." : "Send me the magic link!"}
          </button>

          {feedback ? (
            <p className="mt-4 text-center text-[13px] font-medium text-[#5F7D6A]">{feedback}</p>
          ) : null}

          {error ? (
            <p className="mt-4 text-center text-[13px] font-medium text-[#DC2626]">{error}</p>
          ) : null}

          {!supabase ? (
            <p className="mt-4 text-center text-[13px] font-medium text-[#6B7280]">
              Add your Supabase URL and anon key in Vercel or `.env.local` to enable sign in.
            </p>
          ) : null}
        </form>
      </div>
    </main>
  );
}
