"use client";

import { useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 11.5 12 5l8 6.5" />
      <path d="M6.5 10.5V19h11v-8.5" />
      <path d="M10 19v-5h4v5" />
    </svg>
  );
}

function GroupsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="8" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
      <rect x="13" y="13" width="8" height="8" rx="2" />
    </svg>
  );
}

function ActivityIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 13h3l2.2-5 3.3 10 2.5-6H20" />
      <path d="M4 6h16" opacity="0.35" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M4 19c0-2.5 2.2-4.5 5-4.5s5 2 5 4.5" />
      <path d="M14 18c.4-1.7 1.9-3 3.8-3 1.9 0 3.4 1.3 3.8 3" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.3 2.8h3.4l.6 2.2a7.8 7.8 0 0 1 1.8.8l2-1.2 2.4 2.4-1.2 2c.3.6.6 1.2.8 1.8l2.2.6v3.4l-2.2.6c-.2.6-.5 1.2-.8 1.8l1.2 2-2.4 2.4-2-1.2c-.6.3-1.2.6-1.8.8l-.6 2.2h-3.4l-.6-2.2a7.8 7.8 0 0 1-1.8-.8l-2 1.2-2.4-2.4 1.2-2a7.8 7.8 0 0 1-.8-1.8l-2.2-.6v-3.4l2.2-.6c.2-.6.5-1.2.8-1.8l-1.2-2 2.4-2.4 2 1.2c.6-.3 1.2-.6 1.8-.8l.6-2.2Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

const NAV_ITEMS = [
  { href: "/home", label: "Home", icon: HomeIcon },
  { href: "/groups", label: "Groups", icon: GroupsIcon },
  { href: "/activity", label: "Activity", icon: ActivityIcon },
  { href: "/people", label: "People", icon: PeopleIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

const SHOW_ON = new Set(["/home", "/groups", "/activity", "/people", "/settings", "/me"]);

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const shouldShow = SHOW_ON.has(pathname);

  useEffect(() => {
    NAV_ITEMS.forEach((item) => {
      if (item.href !== pathname) router.prefetch(item.href);
    });
  }, [pathname, router]);

  const handleNavigate = useCallback(
    (href) => {
      if (href !== pathname) router.push(href);
    },
    [pathname, router],
  );

  if (!shouldShow) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--nav)] backdrop-blur-[20px]">
      <div className="mx-auto flex min-h-[72px] w-full max-w-[520px] items-center px-1 pb-[max(env(safe-area-inset-bottom),8px)]">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;

          return (
            <motion.button
              key={item.href}
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => handleNavigate(item.href)}
              onPointerEnter={() => router.prefetch(item.href)}
              aria-label={item.label}
              className="flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-2xl"
            >
              <div className={`relative ${active ? "text-[var(--accent)]" : "text-[var(--text-soft)]"}`}>
                {active ? <div className="absolute -top-2 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[var(--accent)]" /> : null}
                <Icon />
              </div>
              <span className={`text-[10px] font-medium ${active ? "text-[var(--text)]" : "text-[var(--text-soft)]"}`}>
                {item.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}
