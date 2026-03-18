"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Page() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");

  async function sendLink() {
    setMsg("Sending…");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: "http://localhost:3000" },
    });
    setMsg(error ? error.message : "Check your email for the link.");
  }

  async function signOut() {
    await supabase.auth.signOut();
    setMsg("Signed out.");
  }

  return (
    <main style={{ padding: 24, maxWidth: 420, margin: "0 auto" }}>
      <h1>Evenly</h1>
      <p>Sign in to test Supabase.</p>

      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@email.com"
        style={{ width: "100%", padding: 12, marginTop: 12 }}
      />
      <button onClick={sendLink} style={{ marginTop: 12, padding: 12, width: "100%" }}>
        Send magic link
      </button>

      <button onClick={signOut} style={{ marginTop: 12, padding: 12, width: "100%" }}>
        Sign out
      </button>

      {msg ? <p style={{ marginTop: 12 }}>{msg}</p> : null}
    </main>
  );
}
