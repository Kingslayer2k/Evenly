"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";
import { setStoredDisplayName, syncProfileName } from "../lib/groupData";

const PROFILE_STORAGE_KEY = "evenly-profile-settings";

function readStoredProfileSettings() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(PROFILE_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeStoredProfileSettings(value) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(value));
}

async function saveProfileWithFallbacks(payload) {
  const payloads = [
    payload,
    {
      user_id: payload.user_id,
      display_name: payload.display_name,
      username: payload.username,
      phone: payload.phone,
    },
    {
      user_id: payload.user_id,
      display_name: payload.display_name,
    },
  ];

  for (const nextPayload of payloads) {
    const response = await supabase.from("profiles").upsert(nextPayload, { onConflict: "user_id" });
    if (!response.error) return true;
  }

  return false;
}

export default function ProfileSettings({ isOpen, user, initialProfile, onClose, onSaved }) {
  const stored = readStoredProfileSettings();
  const [displayName, setDisplayName] = useState(
    () => initialProfile?.display_name || stored.display_name || user?.user_metadata?.display_name || "",
  );
  const [username, setUsername] = useState(() => initialProfile?.username || stored.username || "");
  const [email, setEmail] = useState(() => user?.email || "");
  const [phone, setPhone] = useState(() => initialProfile?.phone || stored.phone || "");
  const [venmo, setVenmo] = useState(() => initialProfile?.venmo_username || stored.venmo_username || "");
  const [zelle, setZelle] = useState(() => initialProfile?.zelle_handle || stored.zelle_handle || "");
  const [cashApp, setCashApp] = useState(() => initialProfile?.cash_app_tag || stored.cash_app_tag || "");
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-[rgba(28,25,23,0.38)]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-settings-title"
        className="fixed inset-x-0 bottom-0 max-h-[92vh] overflow-y-auto rounded-t-[28px] bg-white px-6 pt-6 pb-8 shadow-[0_-18px_44px_rgba(28,25,23,0.16)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-[#E5E7EB]" />

        <div className="flex items-center justify-between">
          <button type="button" onClick={onClose} className="text-[24px] text-[#6B7280]">
            ×
          </button>
          <div id="profile-settings-title" className="text-[20px] font-bold text-[#1C1917]">
            Profile
          </div>
          <div className="w-6" />
        </div>

        <div className="mt-6">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[#E1F9D8] text-[32px] font-semibold text-[#3A4E43]">
            {(displayName || user?.email || "E").slice(0, 1).toUpperCase()}
          </div>
          <div className="mt-3 text-center text-[14px] text-[#6B7280]">Photo support can come next.</div>
        </div>

        <div className="mt-8 space-y-5">
          <label className="block">
            <div className="text-[13px] font-medium text-[#6B7280]">Display Name</div>
            <input
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="mt-2 h-12 w-full rounded-[10px] border border-[#E5E7EB] px-4 text-[15px] text-[#1C1917] outline-none focus:border-[#5F7D6A]"
            />
          </label>

          <label className="block">
            <div className="text-[13px] font-medium text-[#6B7280]">Username</div>
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="mt-2 h-12 w-full rounded-[10px] border border-[#E5E7EB] px-4 text-[15px] text-[#1C1917] outline-none focus:border-[#5F7D6A]"
            />
          </label>

          <label className="block">
            <div className="text-[13px] font-medium text-[#6B7280]">Email</div>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 h-12 w-full rounded-[10px] border border-[#E5E7EB] px-4 text-[15px] text-[#1C1917] outline-none focus:border-[#5F7D6A]"
            />
          </label>

          <label className="block">
            <div className="text-[13px] font-medium text-[#6B7280]">Phone</div>
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="mt-2 h-12 w-full rounded-[10px] border border-[#E5E7EB] px-4 text-[15px] text-[#1C1917] outline-none focus:border-[#5F7D6A]"
            />
          </label>

          <div className="pt-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6B7280]">
            Payment info
          </div>

          <label className="block">
            <div className="text-[13px] font-medium text-[#6B7280]">Venmo</div>
            <input
              type="text"
              value={venmo}
              onChange={(event) => setVenmo(event.target.value)}
              className="mt-2 h-12 w-full rounded-[10px] border border-[#E5E7EB] px-4 text-[15px] text-[#1C1917] outline-none focus:border-[#5F7D6A]"
            />
          </label>

          <label className="block">
            <div className="text-[13px] font-medium text-[#6B7280]">Zelle</div>
            <input
              type="text"
              value={zelle}
              onChange={(event) => setZelle(event.target.value)}
              className="mt-2 h-12 w-full rounded-[10px] border border-[#E5E7EB] px-4 text-[15px] text-[#1C1917] outline-none focus:border-[#5F7D6A]"
            />
          </label>

          <label className="block">
            <div className="text-[13px] font-medium text-[#6B7280]">Cash App</div>
            <input
              type="text"
              value={cashApp}
              onChange={(event) => setCashApp(event.target.value)}
              className="mt-2 h-12 w-full rounded-[10px] border border-[#E5E7EB] px-4 text-[15px] text-[#1C1917] outline-none focus:border-[#5F7D6A]"
            />
          </label>
        </div>

        {feedback ? (
          <div className="mt-5 rounded-[12px] bg-[#E1F9D8] px-4 py-3 text-[14px] font-medium text-[#3A4E43]">
            {feedback}
          </div>
        ) : null}

        <button
          type="button"
          onClick={async () => {
            if (!user || isSaving) return;
            setIsSaving(true);
            setFeedback("");

            const storedValue = {
              display_name: displayName,
              username,
              phone,
              venmo_username: venmo,
              zelle_handle: zelle,
              cash_app_tag: cashApp,
            };

            writeStoredProfileSettings(storedValue);
            setStoredDisplayName(displayName);
            await syncProfileName(supabase, user, displayName);

            await saveProfileWithFallbacks({
              user_id: user.id,
              display_name: displayName,
              username,
              phone,
              venmo_username: venmo,
              zelle_handle: zelle,
              cash_app_tag: cashApp,
            });

            if (email && email !== user.email) {
              try {
                await supabase.auth.updateUser({ email });
              } catch (error) {
                console.error("Email update skipped:", error);
              }
            }

            setFeedback("Profile saved");
            setIsSaving(false);
            onSaved?.({
              display_name: displayName,
              username,
              phone,
              venmo_username: venmo,
              zelle_handle: zelle,
              cash_app_tag: cashApp,
            });
          }}
          disabled={isSaving}
          className="mt-8 min-h-12 w-full rounded-[12px] bg-[#5F7D6A] text-[16px] font-medium text-white transition hover:bg-[#3A4E43] disabled:cursor-not-allowed disabled:bg-[#A3B8A8]"
        >
          {isSaving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </div>
  );
}
