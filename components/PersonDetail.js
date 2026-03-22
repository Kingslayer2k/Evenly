"use client";

import { useRouter } from "next/navigation";
import ActivityFeed from "./ActivityFeed";
import { formatBalance } from "../lib/utils";

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

export default function PersonDetail({ person, activityItems }) {
  const router = useRouter();
  const primaryGroup = person?.sharedGroups?.[0] || null;

  return (
    <main className="min-h-screen bg-[var(--bg)] pb-24">
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[color:var(--surface)]/95 px-6 py-4 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-[460px] items-center justify-between">
          <button
            type="button"
            onClick={() => router.push("/people")}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--text)] transition hover:opacity-90"
            aria-label="Back to people"
          >
            <BackIcon />
          </button>
          <div className="text-[20px] font-bold tracking-[-0.03em] text-[var(--text)]">Person</div>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--text-muted)]"
            aria-label="Person options"
          >
            •••
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[460px] px-6 pt-6">
        <section className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] px-6 py-8 text-center shadow-[var(--shadow-soft)]">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[var(--surface-accent)] text-[28px] font-semibold text-[var(--accent-strong)]">
            {person.displayName.slice(0, 1).toUpperCase()}
          </div>
          <h1 className="mt-4 text-[28px] font-bold tracking-[-0.04em] text-[var(--text)]">{person.displayName}</h1>
          <div
            className={`mt-3 text-[32px] font-bold tracking-[-0.05em] ${
              person.balance > 0 ? "text-[var(--success)]" : person.balance < 0 ? "text-[var(--danger)]" : "text-[var(--text-muted)]"
            }`}
          >
            {formatBalance(person.balance)}
          </div>
          <div className="mt-2 text-[15px] text-[var(--text-muted)]">
            {person.balance > 0 ? "they owe you" : person.balance < 0 ? "you owe them" : "settled up"}
          </div>
        </section>

        <section className="mt-5 rounded-[16px] border border-[var(--border)] bg-[var(--surface)] px-5 py-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">Shared groups</div>
          <div className="mt-4 space-y-3">
            {person.sharedGroups.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => router.push(`/groups/${group.id}`)}
                className="flex w-full items-center justify-between rounded-[14px] bg-[var(--surface-muted)] px-4 py-4 text-left transition hover:opacity-90"
              >
                <span className="text-[15px] font-medium text-[var(--text)]">{group.name}</span>
                <span className="text-[var(--accent)]">•</span>
              </button>
            ))}
          </div>
        </section>

        <div className="mt-5">
          <ActivityFeed
            title="Recent activity"
            items={activityItems}
            emptyTitle="No shared activity yet"
            emptyCopy="Once you split more with this person, their shared history will appear here."
          />
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-[var(--border)] bg-[color:var(--surface)]/95 px-6 py-4 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-[460px] gap-3">
          <button
            type="button"
            onClick={() => primaryGroup && router.push(`/groups/${primaryGroup.id}`)}
            className="min-h-12 flex-1 rounded-[12px] bg-[var(--accent)] text-[15px] font-medium text-white transition hover:opacity-90"
          >
            Settle up
          </button>
          <button
            type="button"
            onClick={() => primaryGroup && router.push(`/groups/${primaryGroup.id}`)}
            className="min-h-12 flex-1 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] text-[15px] font-medium text-[var(--text)] transition hover:bg-[var(--surface-muted)]"
          >
            Add expense
          </button>
        </div>
      </div>
    </main>
  );
}
