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
    <main className="min-h-screen bg-[#F7F7F5] pb-24">
      <header className="sticky top-0 z-20 border-b border-[#E5E7EB] bg-white/95 px-6 py-4 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-[460px] items-center justify-between">
          <button
            type="button"
            onClick={() => router.push("/people")}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F3F4F6] text-[#1C1917] transition hover:bg-[#E5E7EB]"
            aria-label="Back to people"
          >
            <BackIcon />
          </button>
          <div className="text-[20px] font-bold tracking-[-0.03em] text-[#1C1917]">Person</div>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F3F4F6] text-[#6B7280]"
            aria-label="Person options"
          >
            •••
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[460px] px-6 pt-6">
        <section className="rounded-[28px] bg-white px-6 py-8 text-center shadow-[0_8px_20px_rgba(28,25,23,0.04)]">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#E1F9D8] text-[28px] font-semibold text-[#3A4E43]">
            {person.displayName.slice(0, 1).toUpperCase()}
          </div>
          <h1 className="mt-4 text-[28px] font-bold tracking-[-0.04em] text-[#1C1917]">{person.displayName}</h1>
          <div className={`mt-3 text-[32px] font-bold tracking-[-0.05em] ${person.balance > 0 ? "text-[#10B981]" : person.balance < 0 ? "text-[#DC2626]" : "text-[#6B7280]"}`}>
            {formatBalance(person.balance)}
          </div>
          <div className="mt-2 text-[15px] text-[#6B7280]">
            {person.balance > 0 ? "they owe you" : person.balance < 0 ? "you owe them" : "settled up"}
          </div>
        </section>

        <section className="mt-5 rounded-[16px] border border-[#E5E7EB] bg-white px-5 py-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6B7280]">Shared groups</div>
          <div className="mt-4 space-y-3">
            {person.sharedGroups.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => router.push(`/groups/${group.id}`)}
                className="flex w-full items-center justify-between rounded-[14px] bg-[#F7F7F5] px-4 py-4 text-left transition hover:bg-[#EEF2EA]"
              >
                <span className="text-[15px] font-medium text-[#1C1917]">{group.name}</span>
                <span className="text-[#5F7D6A]">•</span>
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

      <div className="fixed inset-x-0 bottom-0 border-t border-[#E5E7EB] bg-white/95 px-6 py-4 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-[460px] gap-3">
          <button
            type="button"
            onClick={() => primaryGroup && router.push(`/groups/${primaryGroup.id}`)}
            className="min-h-12 flex-1 rounded-[12px] bg-[#5F7D6A] text-[15px] font-medium text-white transition hover:bg-[#3A4E43]"
          >
            Settle up
          </button>
          <button
            type="button"
            onClick={() => primaryGroup && router.push(`/groups/${primaryGroup.id}`)}
            className="min-h-12 flex-1 rounded-[12px] border border-[#E5E7EB] bg-white text-[15px] font-medium text-[#1C1917] transition hover:bg-[#F7F7F5]"
          >
            Add expense
          </button>
        </div>
      </div>
    </main>
  );
}
