"use client";

import { useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";

function GroupsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
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

function MeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.2 3-5.5 7-5.5s7 2.3 7 5.5" />
    </svg>
  );
}

const NAV_ITEMS = [
  { href: "/groups", label: "Groups", icon: GroupsIcon },
  { href: "/people", label: "People", icon: PeopleIcon },
  { href: "/me", label: "Me", icon: MeIcon },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const shouldShow = pathname === "/groups" || pathname === "/people" || pathname === "/me";

  useEffect(() => {
    NAV_ITEMS.forEach((item) => {
      if (item.href !== pathname) {
        router.prefetch(item.href);
      }
    });
  }, [pathname, router]);

  const handleNavigate = useCallback(
    (href) => {
      if (href !== pathname) {
        router.push(href);
      }
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
              <span className={`text-[11px] font-medium ${active ? "text-[var(--text)]" : "text-[var(--text-soft)]"}`}>
                {item.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}
