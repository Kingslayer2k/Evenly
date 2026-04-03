# Smart Split & Settle Up — Design Spec
**Date:** 2026-04-03  
**Status:** Approved

---

## Overview

Four interconnected changes that together make splitting and settling the headline feature of Evenly:

1. **Smart Split engine** — history-based split suggestion that blends allocation history + balance pressure
2. **"How to split" redesign** — Smart Split as hero in AddExpenseModal, FairSplit renamed to "By items"
3. **Settle up with payment deeplinks** — Venmo, Cash App, PayPal via bottom sheet
4. **Surface elevation** — debt and Smart Split status made prominent on home and group detail

Dark mode is the primary target. All color decisions use existing CSS variables (`--danger`, `--accent`, etc.) except where noted.

---

## 1. Smart Split Algorithm

### Inputs
- All past expenses in the group (from `expensesByGroup` or a fresh query)
- Current group members
- The current user's membership ID

### Signals (blended 50/50)

**Signal A — Allocation history (50%)**  
For each member, calculate their average share % across all past expenses where `split_type = 'custom'` and `shares` is populated. Equal-split expenses contribute `1/N` to each member's average. Minimum 3 expenses required for this signal to carry weight; below that it falls back to equal.

**Signal B — Balance pressure (50%)**  
Compute each member's current net balance relative to equal split. Members who have been overpaying get a smaller suggested share; underpayers get a larger one. The adjustment is capped at ±15% of equal share per expense to avoid overcorrection.

### Blending
```
smartShare[member] = 0.5 * allocationShare[member] + 0.5 * balancePressureShare[member]
```
Shares are normalized to sum to 100% after blending. Cents are distributed with largest-remainder rounding.

### Fallback states
- **< 3 expenses:** Smart Split falls back to equal split, card explains "Not enough history yet — using equal split. It gets smarter after a few expenses."
- **Single member:** N/A, no split needed.
- **All expenses are equal split:** Signal A = equal for all; only Signal B contributes.

### Where it lives
A new pure function `calculateSmartSplit(members, expenses, currentUserId)` in `lib/utils.js`. Returns `{ shares: { [memberId]: cents }, explanation: string, confidence: 'low' | 'medium' | 'high' }`.

Confidence levels:
- `low`: 3–5 expenses
- `medium`: 6–14 expenses  
- `high`: 15+ expenses

---

## 2. AddExpenseModal — "How to split" Redesign

### Layout
Replace the current `Equal / Custom` toggle + "Split by items" button with a unified **"How to split"** section:

**Smart Split hero card** (dark gradient, full width):
- Header: `✦ Smart Split` + "Based on your group's history"
- Body: member chips showing suggested percentages (e.g. `Alex · 38%`)
- Footer: `"Tap to preview full breakdown →"`
- State badge: `Selected` when active
- When no history: shows `"Equal split"` chips with explanation text
- Tapping opens a Smart Split preview sheet (see below)

**Secondary row** (below the hero card, three equal pills):
- `Equal` | `Custom` | `By items`
- Selecting any of these deselects Smart Split
- "By items" is the renamed FairSplit — opens existing `FairSplitModal`, no logic changes

### Smart Split preview sheet
A bottom sheet (new component: `SmartSplitModal`) showing:
- Full per-member breakdown with progress bars and dollar amounts
- Explanation text: e.g. "Based on 14 past expenses · rebalancing Sam's underpayment"
- Confidence indicator (low / medium / high shown as subtle label)
- "Apply Smart Split" CTA + "Cancel" link

### Data flow
- `AddExpenseModal` receives a new `expenses` prop — `GroupDetailPage` must be updated to pass the group's expense array (already in scope as `recentExpenses` / loaded via `loadGroupDetailBundle`)
- On open, `calculateSmartSplit` runs and result is stored in component state
- If user selects Smart Split and saves, `splitType = 'custom'`, `splitMethod = 'smart'`, shares stored as usual
- `split_details.smart` stores the explanation string for display in `ExpenseDetail`

---

## 3. Settle Up — Payment Deeplinks

### SettlementCard changes
- Debt rows (`youOwe`) get a primary CTA: `"Pay [name] $X →"`  
  - Button style: `bg: rgba(--danger, 0.15)`, `color: --danger`, `border: rgba(--danger, 0.35)`
- Owed rows (`owedToYou`) keep the existing `"Request from [name]"` button, no changes
- Debt amounts displayed in `--danger` color (`#f87171` dark / `#dc2626` light)

### PaymentModal changes
The existing `PaymentModal` is extended (not replaced) to show a payment app sheet when the action is `"pay"`:

**Sheet contents (pay action):**
```
[label] Pay [name] · $X.XX
[sublabel] Opens app with amount pre-filled

[Venmo]    — muted slate blue panel
[Cash App] — muted sage green panel  
[PayPal]   — muted navy panel
[Mark as paid (cash)] — dimmest, neutral panel
```

**Deeplink formats:**
None of these apps support amount pre-fill without a recipient handle (which we don't store). The links simply open each app so the user can complete the payment manually. The sheet shows the amount prominently so the user knows what to enter.

- Venmo: `venmo://` (opens Venmo app)
- Cash App: `https://cash.app/` (opens or falls back to web)
- PayPal: `https://www.paypal.com/myaccount/transfer/homepage/pay` (opens PayPal send flow)

All links open via `window.open(url, '_blank')`.

The sheet sublabel reads: **"Open the app and send [name] this amount"** (not "pre-filled" — that would be misleading).

"Mark as paid (cash)" calls the existing settlement record creation flow.

### Colors (dark mode, using existing variables)
- Debt text: `var(--danger)` (`#f87171` dark / `#dc2626` light)
- Debt button bg: `rgba(248, 113, 113, 0.15)` (hardcoded alpha — CSS vars can't be used in `rgba()`)
- Debt button border: `rgba(248, 113, 113, 0.35)`
- Debt card bg: `#1c1414` (dark mode only; light mode uses `var(--surface-soft)`)
- "Settle everything" CTA on home: same red treatment on green hero background

---

## 4. Surface Elevation

### Home page (`app/groups/page.js`)
Add two cards **above** the existing group card stack (only shown when `user` is authenticated and groups exist):

1. **Net balance hero** — green gradient card, shows aggregate net balance across all groups. Balance number uses `--danger` if negative, `--accent-strong` if positive.
2. **Action-needed card** — red-bordered card, shows the single largest individual `youOwe` item across all groups (by dollar amount). `"Pay →"` CTA opens PaymentModal. Hidden if no debts exist across any group.

Both cards are computed from `displayGroups` (already available) — no new data fetching.

### Group detail page (`components/GroupDetailPage.js`)
Add two cards **above** the expense list, below the group header:

1. **Settle up card** (elevated) — replaces the current `SettlementCard` position; now appears higher on the page with red debt styling.
2. **Smart Split nudge card** — green-bordered card, shown when `expenseCount >= 3`. Text: "Based on X expenses, we know how this group splits. Tap + to use it on your next expense." Hidden if fewer than 3 expenses.

The existing `SettlementCard` component is updated in-place to adopt the new red debt styling.

---

## 5. Rename: FairSplit → "By items"

- `FairSplitModal`: update header from "Split by items" (already correct) — no change needed
- `AddExpenseModal`: "Split by items" button label stays, just moves to the secondary pill row
- `ExpenseDetail`: anywhere `split_method === 'fair'` displays as "Split by items" (already the label used)
- Internal variable names (`fairSplitDetails`, `isFairSplitOpen`, etc.) stay as-is — no rename of internals, just UI labels

---

## 6. New Component: `SmartSplitModal`

A bottom sheet in the style of `FairSplitModal`:
- Props: `isOpen`, `onClose`, `result` (output of `calculateSmartSplit`), `members`, `totalCents`, `onApply`
- Shows the breakdown with per-member progress bars + dollar amounts
- Confidence label + explanation text at the bottom
- "Apply Smart Split" → calls `onApply(result.shares)`
- Lazy-loaded via `dynamic()` in `AddExpenseModal`

---

## 7. Files Touched

| File | Change |
|------|--------|
| `lib/utils.js` | Add `calculateSmartSplit()` |
| `components/AddExpenseModal.js` | Redesign "How to split" section, add SmartSplit hero card + secondary pills, load SmartSplitModal |
| `components/SmartSplitModal.js` | New component |
| `components/FairSplitModal.js` | No changes (UI label already correct) |
| `components/SettlementCard.js` | Red debt styling, updated CTA to open PaymentModal |
| `components/PaymentModal.js` | Add payment app sheet with deeplinks |
| `components/GroupDetailPage.js` | Add settle up card elevation + Smart Split nudge card |
| `app/groups/page.js` | Add net balance hero + action-needed card above stack |

---

## 8. Out of Scope

- Payment recipient handles (Venmo username, Cash App tag) — deferred
- Zelle integration — no public universal deeplink
- Smart Split across multiple groups (per-group only)
- Persistent Smart Split on/off toggle per group
