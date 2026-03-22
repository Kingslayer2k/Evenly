"use client";

import { useEffect } from "react";

function MenuIcon({ type }) {
  if (type === "gear") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-[var(--text-muted)]" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10.3 2.8h3.4l.6 2.2a7.8 7.8 0 0 1 1.8.8l2-1.2 2.4 2.4-1.2 2c.3.6.6 1.2.8 1.8l2.2.6v3.4l-2.2.6c-.2.6-.5 1.2-.8 1.8l1.2 2-2.4 2.4-2-1.2c-.6.3-1.2.6-1.8.8l-.6 2.2h-3.4l-.6-2.2a7.8 7.8 0 0 1-1.8-.8l-2 1.2-2.4-2.4 1.2-2a7.8 7.8 0 0 1-.8-1.8l-2.2-.6v-3.4l2.2-.6c.2-.6.5-1.2.8-1.8l-1.2-2 2.4-2.4 2 1.2c.6-.3 1.2-.6 1.8-.8l.6-2.2Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-[var(--danger)]" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-[var(--text-soft)]" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export default function SettingsMenu({ isOpen, onClose, onLogout }) {
  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(event) {
      if (event.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  function handleItemClick(action) {
    onClose?.();
    action?.();
  }

  return (
    <div className="fixed inset-0 z-50 bg-[var(--overlay)]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="mx-auto mt-3 w-[90%] max-w-[340px] overflow-hidden rounded-b-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)] transition duration-300 ease-out"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="bg-[var(--surface)] px-0 py-2">
          <button
            type="button"
            className="flex h-[52px] w-full items-center justify-between border-b border-[var(--border-soft)] px-4 text-left transition hover:bg-[var(--surface-muted)] active:bg-[var(--surface-soft)]"
            onClick={() => handleItemClick(() => console.log("Settings clicked"))}
          >
            <span className="flex items-center gap-3">
              <MenuIcon type="gear" />
              <span className="text-[16px] font-normal text-[var(--text)]">Settings</span>
            </span>
            <Chevron />
          </button>

          <button
            type="button"
            className="flex h-[52px] w-full items-center justify-between px-4 text-left transition hover:bg-[var(--surface-muted)] active:bg-[var(--surface-soft)]"
            onClick={() => handleItemClick(onLogout || (() => console.log("Log out clicked")))}
          >
            <span className="flex items-center gap-3">
              <MenuIcon type="logout" />
              <span className="text-[16px] font-normal text-[var(--danger)]">Log out</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
