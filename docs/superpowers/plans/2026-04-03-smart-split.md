# Smart Split & Settle Up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a history-based Smart Split engine, elevate it as the hero split mode in AddExpenseModal, add PayPal to the payment sheet, apply red debt styling throughout, and surface both features on home and group detail.

**Architecture:** Pure algorithm function in `lib/utils.js` → new `SmartSplitModal` component → redesigned `AddExpenseModal` split section → updated `SettlementCard` + `PaymentModal` → surface elevation in `GroupDetailPage` and `app/groups/page.js`.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind CSS 4, Framer Motion, Supabase

---

## Pre-flight

Before starting, confirm the project builds cleanly:

```bash
cd /Users/aryasockalingam/Documents/evenly
npm run lint && npm run build
```

Expected: no errors. If there are pre-existing errors, note them — don't fix them as part of this work.

---

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `lib/utils.js` | Modify | Add `calculateSmartSplit()` |
| `components/SmartSplitModal.js` | Create | New bottom-sheet component |
| `components/AddExpenseModal.js` | Modify | "How to split" redesign, Smart Split hero card |
| `utils/payment-links.js` | Modify | Add `buildPayPalLink()` |
| `components/PaymentModal.js` | Modify | Add PayPal, muted dark-mode button styling |
| `components/SettlementCard.js` | Modify | Red debt styling, updated CTA copy |
| `components/GroupDetailPage.js` | Modify | Pass `expenses` prop, elevate SettlementCard, add Smart Split nudge |
| `app/groups/page.js` | Modify | Net balance hero + action-needed card above stack |

---

## Task 1: `calculateSmartSplit` in `lib/utils.js`

**Files:**
- Modify: `lib/utils.js`

- [ ] **Step 1: Add the function** at the end of `lib/utils.js`, after `getUserSettlementSummary`:

```js
export function calculateSmartSplit(members, expenses, totalCents) {
  const memberIds = (members || []).map((m) => m.id);
  const n = memberIds.length;

  const equalShares = Object.fromEntries(
    memberIds.map((id, i) => [
      id,
      Math.floor(totalCents / n) + (i < totalCents % n ? 1 : 0),
    ]),
  );

  if (n === 0 || !totalCents) {
    return { shares: equalShares, explanation: "", confidence: "low", expenseCount: 0 };
  }

  const relevantExpenses = (expenses || []).filter(
    (e) => Number(e.amount_cents || 0) > 0 && Array.isArray(e.participants) && e.participants.length > 0,
  );
  const expenseCount = relevantExpenses.length;

  // Confidence level
  const confidence = expenseCount >= 15 ? "high" : expenseCount >= 6 ? "medium" : "low";

  // Not enough history — return equal split
  if (expenseCount < 3) {
    return {
      shares: equalShares,
      explanation: "Not enough history yet — using equal split. Gets smarter after a few more expenses.",
      confidence: "low",
      expenseCount,
    };
  }

  // --- Signal A: allocation history ---
  // For each expense, compute each member's fraction of the total allocated to the group.
  const allocationSums = Object.fromEntries(memberIds.map((id) => [id, 0]));
  const allocationCounts = Object.fromEntries(memberIds.map((id) => [id, 0]));

  for (const expense of relevantExpenses) {
    const shares = computeExpenseShares(expense);
    const expenseTotal = Object.values(shares).reduce((sum, c) => sum + Number(c || 0), 0);
    if (expenseTotal <= 0) continue;
    for (const memberId of memberIds) {
      allocationSums[memberId] += Number(shares[memberId] || 0) / expenseTotal;
      allocationCounts[memberId] += 1;
    }
  }

  // Average fraction per member, default to 1/n if no data
  const rawAllocation = Object.fromEntries(
    memberIds.map((id) => [
      id,
      allocationCounts[id] > 0 ? allocationSums[id] / allocationCounts[id] : 1 / n,
    ]),
  );
  const allocationTotal = memberIds.reduce((sum, id) => sum + rawAllocation[id], 0);
  const normalizedAllocation = Object.fromEntries(
    memberIds.map((id) => [id, rawAllocation[id] / (allocationTotal || 1)]),
  );

  // --- Signal B: balance pressure ---
  // Positive balance = overpaying (should get smaller share next time).
  // Negative balance = underpaying (should get larger share next time).
  const balances = computeBalancesForGroup(members, relevantExpenses);
  const totalSpent = relevantExpenses.reduce((sum, e) => sum + Number(e.amount_cents || 0), 0);
  const equalFraction = 1 / n;

  const pressureRaw = Object.fromEntries(
    memberIds.map((id) => {
      const balanceFraction = totalSpent > 0 ? (balances[id] || 0) / totalSpent : 0;
      // Reduce share for overpayers, increase for underpayers. Cap at ±15% of equal.
      const adjustment = Math.max(
        -0.15 * equalFraction,
        Math.min(0.15 * equalFraction, -balanceFraction * 0.1),
      );
      return [id, equalFraction + adjustment];
    }),
  );
  const pressureTotal = memberIds.reduce((sum, id) => sum + pressureRaw[id], 0);
  const normalizedPressure = Object.fromEntries(
    memberIds.map((id) => [id, pressureRaw[id] / (pressureTotal || 1)]),
  );

  // --- Blend 50/50 and normalize ---
  const blendedRaw = Object.fromEntries(
    memberIds.map((id) => [
      id,
      0.5 * normalizedAllocation[id] + 0.5 * normalizedPressure[id],
    ]),
  );
  const blendedTotal = memberIds.reduce((sum, id) => sum + blendedRaw[id], 0);
  const blended = Object.fromEntries(
    memberIds.map((id) => [id, blendedRaw[id] / (blendedTotal || 1)]),
  );

  // --- Allocate cents using largest-remainder method ---
  const shares = allocateCentsByWeights(
    memberIds.map((id) => ({ id, weight: blended[id] })),
    totalCents,
  );

  const explanation = `Based on ${expenseCount} past expense${expenseCount === 1 ? "" : "s"}`;

  return { shares, explanation, confidence, expenseCount };
}
```

- [ ] **Step 2: Verify lint passes**

```bash
npm run lint
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add lib/utils.js
git commit -m "feat: add calculateSmartSplit algorithm (allocation history + balance pressure)"
```

---

## Task 2: `SmartSplitModal` component

**Files:**
- Create: `components/SmartSplitModal.js`

- [ ] **Step 1: Create the component**

```js
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { bottomSheet, overlayFade } from "../lib/animations";
import { formatCurrency } from "../lib/utils";
import useBodyScrollLock from "../hooks/useBodyScrollLock";

function ConfidenceBadge({ confidence }) {
  const labels = { low: "Learning", medium: "Good data", high: "Strong data" };
  const colors = {
    low: "text-[var(--text-muted)] bg-[var(--surface-muted)]",
    medium: "text-[var(--accent-strong)] bg-[var(--surface-accent)]",
    high: "text-[var(--accent-strong)] bg-[var(--surface-accent)]",
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${colors[confidence] || colors.low}`}>
      {labels[confidence] || "Learning"}
    </span>
  );
}

export default function SmartSplitModal({
  isOpen,
  onClose,
  result,
  members = [],
  totalCents,
  onApply,
}) {
  useBodyScrollLock();

  if (!isOpen || !result) return null;

  const { shares, explanation, confidence } = result;
  const totalShare = Object.values(shares).reduce((sum, c) => sum + Number(c || 0), 0);
  const maxShare = Math.max(...Object.values(shares).map(Number), 1);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[80] bg-[var(--overlay)]"
        initial={overlayFade.initial}
        animate={overlayFade.animate}
        exit={overlayFade.exit}
        transition={overlayFade.transition}
        onClick={onClose}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Smart Split breakdown"
          className="scroll-sheet fixed inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-[28px] border border-[var(--border)] bg-[var(--surface)] px-5 pt-5 pb-[calc(var(--safe-bottom)+24px)] shadow-[0_-8px_28px_rgba(28,25,23,0.12)]"
          initial={bottomSheet.initial}
          animate={bottomSheet.animate}
          exit={bottomSheet.exit}
          transition={bottomSheet.transition}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-[var(--border)]" />

          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[16px] text-[var(--accent-strong)]">✦</span>
                <h3 className="text-[24px] font-bold tracking-[-0.04em] text-[var(--text)]">Smart Split</h3>
              </div>
              <p className="mt-2 text-[14px] leading-5 text-[var(--text-muted)]">
                Suggested breakdown based on your group&apos;s history.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--text)]"
              aria-label="Close Smart Split"
            >
              ×
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {members.map((member) => {
              const cents = Number(shares[member.id] || 0);
              const pct = totalShare > 0 ? Math.round((cents / totalShare) * 100) : 0;
              const barWidth = maxShare > 0 ? (cents / maxShare) * 100 : 0;
              return (
                <div
                  key={member.id}
                  className="rounded-[20px] border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-[15px] font-semibold text-[var(--text)]">{member.display_name}</div>
                    <div className="text-[16px] font-bold text-[var(--text)]">{formatCurrency(cents / 100)}</div>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                      <div
                        className="h-full rounded-full bg-[var(--accent)]"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <div className="w-8 text-right text-[12px] font-medium text-[var(--text-muted)]">{pct}%</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 rounded-[16px] bg-[var(--surface-muted)] px-4 py-3">
            <div className="text-[13px] text-[var(--text-muted)]">{explanation}</div>
            <ConfidenceBadge confidence={confidence} />
          </div>

          <button
            type="button"
            onClick={() => onApply?.(result)}
            className="mt-5 flex min-h-[52px] w-full items-center justify-center rounded-full bg-[var(--accent)] px-5 text-[16px] font-semibold text-white transition hover:opacity-90"
          >
            Apply Smart Split
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Verify lint passes**

```bash
npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add components/SmartSplitModal.js
git commit -m "feat: add SmartSplitModal component"
```

---

## Task 3: Redesign "How to split" in `AddExpenseModal`

**Files:**
- Modify: `components/AddExpenseModal.js`

This task replaces the existing `Equal / Custom` toggle + "Split by items" button with a unified "How to split" section: Smart Split hero card on top, `Equal | Custom | By items` secondary pills below.

- [ ] **Step 1: Add `SmartSplitModal` import and `expenses` prop**

At the top of `AddExpenseModal.js`, add the dynamic import after `FairSplitModal`:

```js
const SmartSplitModal = dynamic(() => import("./SmartSplitModal"), {
  loading: () => null,
});
```

Update the function signature to accept `expenses`:

```js
export default function AddExpenseModal({
  isOpen,
  onClose,
  onSubmit,
  members,
  contexts,
  contacts = [],
  initialPayerId,
  rotations = [],
  initialExpense = null,
  groupType = "group",
  expenses = [],
}) {
```

- [ ] **Step 2a: Add `calculateSmartSplit` to the import at the top of `AddExpenseModal.js`**

Find:
```js
import { getExpenseEmoji, stripExpenseEmojiPrefix } from "../lib/utils";
```
Replace with:
```js
import { calculateSmartSplit, getExpenseEmoji, stripExpenseEmojiPrefix } from "../lib/utils";
```

- [ ] **Step 2b: Add state + memo inside the component**

After `const [isFairSplitOpen, setIsFairSplitOpen] = useState(false);`, add:

```js
const [isSmartSplitOpen, setIsSmartSplitOpen] = useState(false);
```

After `const amountCents = useMemo(() => toCents(amount), [amount]);`, add:

```js
const smartSplitResult = useMemo(
  () => (members?.length ? calculateSmartSplit(members, expenses, amountCents || 10000) : null),
  [members, expenses, amountCents],
);
```

- [ ] **Step 3: Replace the split section in the JSX**

Find the existing split section in the JSX (starts with `<div>` containing `<div className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">Split</div>`):

```jsx
          <div>
            <div className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
              Split
            </div>
            <div className="mt-2 inline-flex rounded-full bg-[var(--surface-muted)] p-1">
              {["equal", "custom"].map((mode) => {
                const active = splitMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setSplitMode(mode);
                      setSplitMethod(mode);
                      setFairSplitDetails(null);
                    }}
                    className={`rounded-full px-4 py-2 text-[14px] font-semibold capitalize transition ${
                      active
                        ? "bg-[var(--surface)] text-[var(--text)] shadow-[0_2px_6px_rgba(28,25,23,0.08)]"
                        : "text-[var(--text-muted)]"
                    }`}
                  >
                    {mode}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setIsFairSplitOpen(true)}
              className={`mt-3 inline-flex min-h-11 items-center rounded-full px-4 text-[14px] font-semibold transition ${
                splitMethod === "fair"
                  ? "bg-[var(--surface-accent)] text-[var(--accent-strong)]"
                  : "bg-[var(--surface-muted)] text-[var(--text-muted)] hover:bg-[var(--surface-accent)]"
              }`}
            >
              Split by items
            </button>
          </div>
```

Replace it with:

```jsx
          <div>
            <div className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
              How to split
            </div>

            {/* Smart Split hero card */}
            <button
              type="button"
              onClick={() => {
                if (splitMethod === "smart") {
                  setIsSmartSplitOpen(true);
                } else {
                  setSplitMode("custom");
                  setSplitMethod("smart");
                  setFairSplitDetails(null);
                  if (smartSplitResult?.shares) {
                    const next = { ...customAmounts };
                    for (const [id, cents] of Object.entries(smartSplitResult.shares)) {
                      next[id] = (Number(cents) / 100).toFixed(2);
                    }
                    setCustomAmounts(next);
                    setSelectedParticipants(members.map((m) => m.id));
                  }
                }
              }}
              className={`mt-2 w-full rounded-[20px] p-4 text-left transition active:scale-[0.99] ${
                splitMethod === "smart"
                  ? "bg-[linear-gradient(135deg,var(--accent),#2d4438)] text-white"
                  : "bg-[linear-gradient(135deg,var(--surface-accent),var(--surface-muted))] border border-[var(--border)]"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={splitMethod === "smart" ? "text-white/80" : "text-[var(--accent-strong)]"}>✦</span>
                    <span className={`text-[16px] font-bold ${splitMethod === "smart" ? "text-white" : "text-[var(--text)]"}`}>
                      Smart Split
                    </span>
                  </div>
                  <div className={`mt-0.5 text-[12px] ${splitMethod === "smart" ? "text-white/70" : "text-[var(--text-muted)]"}`}>
                    Based on your group&apos;s history
                  </div>
                </div>
                {splitMethod === "smart" && (
                  <div className="rounded-full border border-white/30 bg-white/15 px-3 py-1 text-[12px] font-semibold text-white">
                    Selected
                  </div>
                )}
              </div>
              {smartSplitResult?.shares && members.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {members.slice(0, 4).map((member) => {
                    const cents = Number(smartSplitResult.shares[member.id] || 0);
                    const total = Object.values(smartSplitResult.shares).reduce((s, c) => s + Number(c), 0);
                    const pct = total > 0 ? Math.round((cents / total) * 100) : 0;
                    return (
                      <span
                        key={member.id}
                        className={`rounded-full px-2.5 py-1 text-[12px] font-medium ${
                          splitMethod === "smart"
                            ? "bg-white/15 text-white/90"
                            : "bg-[var(--surface-muted)] text-[var(--text-muted)]"
                        }`}
                      >
                        {member.display_name} · {pct}%
                      </span>
                    );
                  })}
                  {members.length > 4 && (
                    <span className={`rounded-full px-2.5 py-1 text-[12px] font-medium ${splitMethod === "smart" ? "bg-white/15 text-white/90" : "bg-[var(--surface-muted)] text-[var(--text-muted)]"}`}>
                      +{members.length - 4} more
                    </span>
                  )}
                </div>
              )}
              <div className={`mt-2 text-[11px] ${splitMethod === "smart" ? "text-white/50" : "text-[var(--text-muted)]"}`}>
                {splitMethod === "smart" ? "Tap to preview full breakdown →" : "Tap to apply suggested split →"}
              </div>
            </button>

            {/* Secondary split mode pills */}
            <div className="mt-2 flex gap-2">
              {[
                { key: "equal", label: "Equal" },
                { key: "custom", label: "Custom" },
                { key: "fair", label: "By items" },
              ].map(({ key, label }) => {
                const active = splitMethod === key || (key === "custom" && splitMode === "custom" && splitMethod !== "fair" && splitMethod !== "smart");
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      if (key === "fair") {
                        setIsFairSplitOpen(true);
                      } else {
                        setSplitMode(key);
                        setSplitMethod(key);
                        setFairSplitDetails(null);
                      }
                    }}
                    className={`flex-1 rounded-[12px] border py-2.5 text-[13px] font-semibold transition ${
                      active
                        ? "border-[var(--accent)] bg-[var(--surface-accent)] text-[var(--accent-strong)]"
                        : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
```

- [ ] **Step 4: Add SmartSplitModal to the JSX** (after the FairSplitModal block, before the closing `</motion.div>`):

```jsx
      {isSmartSplitOpen && smartSplitResult ? (
        <SmartSplitModal
          isOpen={isSmartSplitOpen}
          onClose={() => setIsSmartSplitOpen(false)}
          result={smartSplitResult}
          members={members}
          totalCents={amountCents}
          onApply={(result) => {
            const next = { ...customAmounts };
            for (const [id, cents] of Object.entries(result.shares)) {
              next[id] = (Number(cents) / 100).toFixed(2);
            }
            setCustomAmounts(next);
            setSelectedParticipants(members.map((m) => m.id));
            setSplitMode("custom");
            setSplitMethod("smart");
            setIsSmartSplitOpen(false);
          }}
        />
      ) : null}
```

- [ ] **Step 5: Lint and build**

```bash
npm run lint && npm run build
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/AddExpenseModal.js
git commit -m "feat: redesign How to split with Smart Split as hero mode"
```

---

## Task 4: Add PayPal to payment links + update `PaymentModal` styling

**Files:**
- Modify: `utils/payment-links.js`
- Modify: `components/PaymentModal.js`

- [ ] **Step 1: Add `buildPayPalLink` to `utils/payment-links.js`**

Append after `buildZelleLink`:

```js
export function buildPayPalLink({ amount }) {
  // Opens PayPal send-money flow. No recipient pre-fill without a PayPal.me handle.
  return {
    primaryUrl: `https://www.paypal.com/myaccount/transfer/homepage/pay`,
    fallbackUrl: "https://www.paypal.com/",
  };
}
```

- [ ] **Step 2: Update `PaymentModal.js` imports and methods array**

At the top, add `buildPayPalLink` to the import:

```js
import {
  buildAppleCashLink,
  buildCashAppLink,
  buildPayPalLink,
  buildVenmoLink,
  buildZelleLink,
  openExternalPaymentLink,
} from "../utils/payment-links";
```

Find the `methods` useMemo and add PayPal after Cash App:

```js
      {
        key: "paypal",
        label: "PayPal",
        emoji: "🅿️",
        action: buildPayPalLink({ amount }),
      },
```

- [ ] **Step 3: Update button styling in `PaymentModal.js` for dark-mode-first muted appearance**

Find the methods list button in the JSX:

```jsx
                <button
                  key={method.key}
                  type="button"
                  onClick={() => {
                    setSelectedMethod(method.key);
                    if (method.action) {
                      openExternalPaymentLink(method.action);
                    }
                  }}
                  className="flex min-h-14 w-full items-center justify-between rounded-[12px] border border-[var(--border)] bg-[var(--surface-muted)] px-4 text-left transition hover:opacity-90 active:scale-[0.99]"
                >
```

Replace the `className` with one that applies per-method tinting:

```jsx
                <button
                  key={method.key}
                  type="button"
                  onClick={() => {
                    setSelectedMethod(method.key);
                    if (method.action) {
                      openExternalPaymentLink(method.action);
                    }
                  }}
                  className={`flex min-h-14 w-full items-center justify-between rounded-[12px] border px-4 text-left transition hover:opacity-90 active:scale-[0.99] ${
                    method.key === "venmo"
                      ? "border-[#2a3a55] bg-[#1a2235]"
                      : method.key === "cash_app"
                        ? "border-[#2a4030] bg-[#162218]"
                        : method.key === "paypal"
                          ? "border-[#222a44] bg-[#141828]"
                          : method.key === "apple_cash"
                            ? "border-[var(--border)] bg-[var(--surface-muted)]"
                            : "border-[var(--border)] bg-[var(--surface-soft)]"
                  }`}
                >
```

Also update the label color inside the button. Find:

```jsx
                    <span className="text-[16px] font-medium text-[var(--text)]">{method.label}</span>
```

Replace with:

```jsx
                    <span className={`text-[16px] font-medium ${
                      method.key === "venmo" ? "text-[#9ab0cc]"
                      : method.key === "cash_app" ? "text-[#7a9e84]"
                      : method.key === "paypal" ? "text-[#8a9ab8]"
                      : "text-[var(--text)]"
                    }`}>{method.label}</span>
```

- [ ] **Step 4: Update the sublabel copy**

Find:

```jsx
        <div className="mt-2 text-[32px] font-bold tracking-[-0.05em] text-[var(--accent)]">
          {formatCurrency(amount)}
        </div>
```

Below it, add a sublabel:

```jsx
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">
          Open the app and send {counterpartyName} this amount
        </p>
```

- [ ] **Step 5: Lint and build**

```bash
npm run lint && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add utils/payment-links.js components/PaymentModal.js
git commit -m "feat: add PayPal to payment sheet, muted dark-mode button styling"
```

---

## Task 5: Red debt styling in `SettlementCard`

**Files:**
- Modify: `components/SettlementCard.js`

- [ ] **Step 1: Update `SettlementRow` and the card**

Replace the entire file contents with:

```js
"use client";

import { formatCurrency } from "../lib/utils";

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function SettlementRow({ item, variant, onAction }) {
  const isOwe = variant === "owe";

  return (
    <div className={`rounded-[18px] border p-4 ${isOwe ? "border-[rgba(248,113,113,0.3)] bg-[rgba(248,113,113,0.06)]" : "border-[var(--border)] bg-[var(--surface-soft)]"}`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className={`text-[11px] font-semibold uppercase tracking-[0.1em] ${isOwe ? "text-[var(--danger)]" : "text-[var(--text-muted)]"}`}>
            {isOwe ? "You owe" : "Owed to you"}
          </div>
          <div className={`mt-1 text-[22px] font-bold tracking-[-0.04em] ${isOwe ? "text-[var(--danger)]" : "text-[var(--accent-strong)]"}`}>
            {formatCurrency(item.amount)}
          </div>
          <div className={`mt-0.5 text-[13px] ${isOwe ? "text-[var(--danger)]/60" : "text-[var(--text-muted)]"}`}>
            {isOwe ? `to ${item.toName}` : `from ${item.fromName}`}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onAction?.(item, isOwe ? "pay" : "request")}
          className={`inline-flex min-h-11 items-center gap-2 rounded-[12px] px-4 text-[14px] font-semibold transition active:scale-[0.99] ${
            isOwe
              ? "border border-[rgba(248,113,113,0.35)] bg-[rgba(248,113,113,0.12)] text-[var(--danger)] hover:bg-[rgba(248,113,113,0.18)]"
              : "bg-[var(--surface-accent)] text-[var(--accent-strong)] hover:bg-[var(--accent-soft-hover)]"
          }`}
        >
          <span>{isOwe ? `Pay ${item.toName}` : `Request`}</span>
          <ArrowIcon />
        </button>
      </div>
    </div>
  );
}

export default function SettlementCard({ summary, onAction }) {
  const hasItems = summary?.youOwe?.length || summary?.owedToYou?.length;

  return (
    <section className="mt-6 rounded-[28px] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">Settle up</div>

      {hasItems ? (
        <div className="mt-4 space-y-3">
          {(summary?.youOwe || []).map((item) => (
            <SettlementRow
              key={`owe-${item.fromMemberId}-${item.toMemberId}`}
              item={item}
              variant="owe"
              onAction={onAction}
            />
          ))}

          {(summary?.owedToYou || []).map((item) => (
            <SettlementRow
              key={`owed-${item.fromMemberId}-${item.toMemberId}`}
              item={item}
              variant="owed"
              onAction={onAction}
            />
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl bg-[var(--surface-muted)] px-4 py-4 text-center">
          <div className="text-[32px]">✓</div>
          <div className="mt-2 text-[18px] font-medium text-[var(--text)]">All settled up!</div>
          <div className="mt-1 text-[14px] text-[var(--text-muted)]">Everyone is even.</div>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Lint and build**

```bash
npm run lint && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add components/SettlementCard.js
git commit -m "feat: red debt styling in SettlementCard"
```

---

## Task 6: Elevate SettlementCard + Smart Split nudge + pass `expenses` in `GroupDetailPage`

**Files:**
- Modify: `components/GroupDetailPage.js`

- [ ] **Step 1: Pass `expenses` to both `AddExpenseModal` instances**

Find the first `AddExpenseModal` render (around line 1500):

```jsx
        <AddExpenseModal
          key={`expense-${groupId}-${membership?.id || "none"}-${members.length}`}
          isOpen={isExpenseModalOpen}
          onClose={() => setIsExpenseModalOpen(false)}
          onSubmit={handleCreateExpense}
          members={members}
          contexts={contexts}
          contacts={contacts}
          initialPayerId={membership?.id}
          rotations={rotations}
          groupType={isTrip ? "trip" : "group"}
        />
```

Add `expenses={expenses}` prop:

```jsx
        <AddExpenseModal
          key={`expense-${groupId}-${membership?.id || "none"}-${members.length}`}
          isOpen={isExpenseModalOpen}
          onClose={() => setIsExpenseModalOpen(false)}
          onSubmit={handleCreateExpense}
          members={members}
          contexts={contexts}
          contacts={contacts}
          initialPayerId={membership?.id}
          rotations={rotations}
          groupType={isTrip ? "trip" : "group"}
          expenses={expenses}
        />
```

Find the second `AddExpenseModal` render (the edit one, around line 1515) and also add `expenses={expenses}`:

```jsx
        <AddExpenseModal
          key={`edit-${expenseToEdit.id}`}
          isOpen={Boolean(expenseToEdit)}
          onClose={() => setExpenseToEdit(null)}
          onSubmit={handleEditExpense}
          members={members}
          contexts={contexts}
          contacts={contacts}
          initialPayerId={membership?.id}
          rotations={rotations}
          initialExpense={expenseToEdit}
          expenses={expenses}
        />
```

- [ ] **Step 2: Move `SettlementCard` and add Smart Split nudge above the tab section**

**2a — Remove SettlementCard from inside the expenses tab.** Find:

```jsx
            {detailTab === "expenses" ? (
              <>
                <SettlementCard summary={summary} onAction={handleOpenSettlement} />
```

Replace with:

```jsx
            {detailTab === "expenses" ? (
              <>
```

**2b — Insert SettlementCard + Smart Split nudge before the tab buttons.** Find the tab button row — it looks like this:

```jsx
            <div className={
```

...containing the buttons that set `detailTab`. Add this block immediately before that div:

```jsx
            {/* Elevated: Settle up card — always visible */}
            <SettlementCard summary={summary} onAction={handleOpenSettlement} />

            {/* Smart Split nudge — shown once there's enough history */}
            {expenses.length >= 3 && (
              <div className="mt-4 rounded-[22px] border border-[var(--border)] bg-[var(--surface-accent)] px-4 py-4">
                <div className="flex items-center gap-2">
                  <span className="text-[15px] text-[var(--accent-strong)]">✦</span>
                  <div className="text-[14px] font-semibold text-[var(--accent-strong)]">Smart Split ready</div>
                </div>
                <div className="mt-1 text-[13px] leading-5 text-[var(--text-muted)]">
                  Based on {expenses.length} expense{expenses.length === 1 ? "" : "s"}, we know how this group splits. Use it on your next expense.
                </div>
              </div>
            )}
```

- [ ] **Step 3: Lint and build**

```bash
npm run lint && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add components/GroupDetailPage.js
git commit -m "feat: elevate SettlementCard, add Smart Split nudge, pass expenses to AddExpenseModal"
```

---

## Task 7: Net balance hero + action-needed card in `app/groups/page.js`

**Files:**
- Modify: `app/groups/page.js`

- [ ] **Step 1: Add `getUserSettlementSummary` to the import from `lib/utils`**

Find the existing import from `../../lib/utils`:

```js
import {
  computeBalancesForGroup,
  formatBalance,
  formatCurrencyCompact,
  getMemberPreview,
  getStableCardColor,
  needsAttention,
  sumGroupTotal,
} from "../../lib/utils";
```

Add `getUserSettlementSummary` and `formatCurrency`:

```js
import {
  computeBalancesForGroup,
  formatBalance,
  formatCurrency,
  formatCurrencyCompact,
  getMemberPreview,
  getStableCardColor,
  getUserSettlementSummary,
  needsAttention,
  sumGroupTotal,
} from "../../lib/utils";
```

- [ ] **Step 2: Compute net balance and worst debt from `displayGroups`**

In the component, find the `stackHeight` useMemo. Add these two memos after it:

```js
  const netBalanceCents = useMemo(
    () => displayGroups.reduce((sum, group) => sum + Math.round((group.balance || 0) * 100), 0),
    [displayGroups],
  );

  const worstDebt = useMemo(() => {
    let largest = null;
    for (const group of displayGroups) {
      const groupMembers = membersByGroup[group.id] || [];
      const groupExpenses = expensesByGroup[group.id] || [];
      const myMembership = memberships.find((m) => m.group_id === group.id);
      if (!myMembership) continue;
      const summary = getUserSettlementSummary(groupMembers, groupExpenses, myMembership, []);
      for (const item of summary.youOwe) {
        if (!largest || item.amount > largest.amount) {
          largest = { ...item, groupId: group.id, groupName: group.name };
        }
      }
    }
    return largest;
  }, [displayGroups, membersByGroup, expensesByGroup, memberships]);
```

- [ ] **Step 3: Add the hero cards above the group stack**

In the JSX, find the block that renders the stacked cards:

```jsx
        ) : (
          <div>
            <div className="mx-auto w-[88%] max-w-[360px]">
```

Replace with:

```jsx
        ) : (
          <div>
            {/* Net balance hero */}
            <div className="mb-4 rounded-[24px] bg-[linear-gradient(135deg,var(--accent),#2d4438)] p-5 text-center shadow-[var(--shadow-soft)]">
              <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-white/70">Net balance</div>
              <div
                className={`mt-1 text-[40px] font-bold tracking-[-0.05em] ${netBalanceCents < 0 ? "text-[#f87171]" : "text-white"}`}
              >
                {netBalanceCents < 0 ? "-" : netBalanceCents > 0 ? "+" : ""}
                {formatCurrency(Math.abs(netBalanceCents) / 100)}
              </div>
              <div className="mt-1 text-[13px] text-white/60">
                across {displayGroups.length} active {displayGroups.length === 1 ? "group" : "groups"}
              </div>
              {worstDebt && (
                <button
                  type="button"
                  onClick={() => router.push(`/groups/${worstDebt.groupId}`)}
                  className="mt-3 rounded-full border border-[rgba(248,113,113,0.4)] bg-[rgba(248,113,113,0.15)] px-4 py-2 text-[13px] font-semibold text-[#f87171] transition hover:bg-[rgba(248,113,113,0.22)]"
                >
                  Settle everything →
                </button>
              )}
            </div>

            {/* Action needed */}
            {worstDebt && (
              <div className="mb-4 rounded-[22px] border border-[rgba(248,113,113,0.3)] bg-[rgba(248,113,113,0.06)] p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--danger)]">Action needed</div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[14px] font-semibold text-[var(--text)]">
                      You owe {worstDebt.toName} {formatCurrency(worstDebt.amount)}
                    </div>
                    <div className="mt-0.5 text-[12px] text-[var(--danger)]/70">{worstDebt.groupName}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push(`/groups/${worstDebt.groupId}`)}
                    className="rounded-[10px] border border-[rgba(248,113,113,0.35)] bg-[rgba(248,113,113,0.12)] px-4 py-2.5 text-[13px] font-semibold text-[var(--danger)] transition hover:bg-[rgba(248,113,113,0.18)]"
                  >
                    Pay →
                  </button>
                </div>
              </div>
            )}

            <div className="mx-auto w-[88%] max-w-[360px]">
```

- [ ] **Step 4: Lint and build**

```bash
npm run lint && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add app/groups/page.js
git commit -m "feat: add net balance hero and action-needed card to home page"
```

---

## Final verification

- [ ] **Run full lint + build**

```bash
npm run lint && npm run build
```

Expected: clean. No new errors.

- [ ] **Manual smoke test checklist**
  - [ ] Open a group with 3+ expenses → Smart Split hero card shows suggested percentages
  - [ ] Tap Smart Split card → SmartSplitModal opens, shows breakdown + confidence badge
  - [ ] Apply Smart Split → custom amounts update, split method set to "smart"
  - [ ] Switch to Equal/Custom/By items → Smart Split deselects correctly
  - [ ] Group with <3 expenses → Smart Split card shows "Not enough history" explanation
  - [ ] SettlementCard → owe rows show red styling, "Pay [name]" CTA
  - [ ] Tap "Pay [name]" → PaymentModal opens with Venmo, Cash App, PayPal, Apple Cash, Cash/Other
  - [ ] PayPal button → opens paypal.com transfer page
  - [ ] Home page → net balance hero shows; action-needed card appears when you owe money
  - [ ] "Pay →" on action-needed card → navigates to the correct group

- [ ] **Final commit**

```bash
git add -A
git commit -m "feat: Smart Split + Settle Up with payment deeplinks complete"
```
