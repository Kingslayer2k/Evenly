"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { copyToClipboard } from "../lib/utils";

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export default function QRInviteModal({ isOpen, groupName, inviteCode, shareLink, onClose }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const url = shareLink || inviteCode;

  async function handleCopyCode() {
    const ok = await copyToClipboard(inviteCode);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleShare() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Join ${groupName || "my Evenly group"}`,
          text: `Join ${groupName || "my Evenly group"} on Evenly with code ${inviteCode}`,
          url: shareLink || undefined,
        });
      } else {
        await handleCopyCode();
      }
    } catch (error) {
      console.error("Share cancelled:", error);
    }
  }

  return (
    <div className="fixed inset-0 z-[65] bg-[var(--overlay)]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="QR invite code"
        className="fixed inset-x-0 bottom-0 rounded-t-[28px] border border-[var(--border)] bg-[var(--surface)] px-6 pt-5 pb-10 shadow-[0_-16px_48px_rgba(28,25,23,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto h-1.5 w-12 rounded-full bg-[var(--border)]" />

        <div className="mt-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-[22px] font-bold tracking-[-0.04em] text-[var(--text)]">
              Scan to join
            </h2>
            <p className="mt-1 text-[14px] text-[var(--text-muted)]">
              Point your camera at the code
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--text-muted)]"
          >
            <XIcon />
          </button>
        </div>

        {/* QR code */}
        <div className="mx-auto mt-6 flex w-fit items-center justify-center rounded-[24px] bg-white p-5 shadow-[0_4px_20px_rgba(28,25,23,0.1)]">
          <QRCodeSVG
            value={url}
            size={220}
            bgColor="#ffffff"
            fgColor="#1C1917"
            level="M"
            includeMargin={false}
          />
        </div>

        {/* Invite code display */}
        <div className="mt-6 rounded-[18px] border border-[var(--border)] bg-[var(--surface-soft)] px-5 py-4 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
            Or share the invite code
          </div>
          <div className="mt-2 font-mono text-[32px] font-bold tracking-[0.2em] text-[var(--text)]">
            {inviteCode}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleCopyCode}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-4 text-[14px] font-semibold text-[var(--text)] transition hover:opacity-90"
          >
            <CopyIcon />
            {copied ? "Copied!" : "Copy code"}
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-4 text-[14px] font-semibold text-white transition hover:opacity-90"
          >
            <ShareIcon />
            Share link
          </button>
        </div>
      </div>
    </div>
  );
}
