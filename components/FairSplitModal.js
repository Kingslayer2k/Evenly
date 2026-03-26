"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { bottomSheet, overlayFade } from "../lib/animations";
import { calculateFairSplit, formatCurrency } from "../lib/utils";

function toCents(value) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
}

function fromCents(value) {
  if (!Number.isFinite(Number(value))) return "";
  return (Number(value) / 100).toFixed(2);
}

function buildInitialItemValues(splitEntries, initialDetails) {
  const nextItemValues = {};
  (splitEntries || []).forEach((entry) => {
    const existing = initialDetails?.items?.find((item) => item.id === entry.id);
    nextItemValues[entry.id] = existing ? fromCents(existing.itemsCents) : "";
  });
  return nextItemValues;
}

function buildInitialSharedRows(initialDetails) {
  if (initialDetails?.sharedCosts?.length) {
    return initialDetails.sharedCosts.map((row, index) => ({
      id: row.id || `shared-${index}`,
      label: row.label || "Shared",
      value: fromCents(row.amountCents),
    }));
  }

  return [
    { id: "tax", label: "Tax", value: "" },
    { id: "tip", label: "Tip", value: "" },
    { id: "delivery", label: "Delivery", value: "" },
  ];
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14" />
    </svg>
  );
}

export default function FairSplitModal({
  isOpen,
  onClose,
  totalCents,
  members = [],
  contacts = [],
  selectedParticipantIds = [],
  selectedContactIds = [],
  initialDetails = null,
  onApply,
}) {
  const splitEntries = useMemo(() => {
    const memberEntries = members
      .filter((member) => selectedParticipantIds.includes(member.id))
      .map((member) => ({
        id: member.id,
        label: member.display_name,
        kind: "member",
      }));
    const contactEntries = contacts
      .filter((contact) => selectedContactIds.includes(contact.id))
      .map((contact) => ({
        id: contact.id,
        label: contact.display_name,
        kind: "contact",
      }));
    return [...memberEntries, ...contactEntries];
  }, [contacts, members, selectedContactIds, selectedParticipantIds]);

  const [itemValues, setItemValues] = useState(() => buildInitialItemValues(splitEntries, initialDetails));
  const [sharedRows, setSharedRows] = useState(() => buildInitialSharedRows(initialDetails));

  const calculation = useMemo(() => {
    return calculateFairSplit(
      splitEntries.map((entry) => ({
        ...entry,
        itemsCents: toCents(itemValues[entry.id]),
      })),
      sharedRows.map((row) => ({
        id: row.id,
        label: row.label,
        amountCents: toCents(row.value),
      })),
      totalCents,
    );
  }, [itemValues, sharedRows, splitEntries, totalCents]);

  if (!isOpen) return null;

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
          aria-label="Split by items"
          className="scroll-sheet fixed inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-[28px] border border-[var(--border)] bg-[var(--surface)] px-5 pt-5 pb-[calc(var(--safe-bottom)+24px)] shadow-[0_-8px_28px_rgba(28,25,23,0.12)]"
          initial={bottomSheet.initial}
          animate={bottomSheet.animate}
          exit={bottomSheet.exit}
          transition={bottomSheet.transition}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-[var(--border)]" />

          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-[24px] font-bold tracking-[-0.04em] text-[var(--text)]">Split by items</h3>
              <p className="mt-2 text-[14px] leading-5 text-[var(--text-muted)]">
                Add what each person ordered, then layer in tax, tip, or delivery.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--text)]"
              aria-label="Close fair split calculator"
            >
              ×
            </button>
          </div>

          <div className="mt-5 rounded-[22px] bg-[var(--surface-accent)] px-4 py-3">
            <div className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--accent-strong)]">
              Expense total
            </div>
            <div className="mt-2 text-[28px] font-bold tracking-[-0.04em] text-[var(--accent-strong)]">
              {formatCurrency(calculation.combinedTotalCents / 100)}
            </div>
          </div>

          <div className="mt-5">
            <div className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
              Ordered items
            </div>
            <div className="mt-3 space-y-3">
              {splitEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-[22px] border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[16px] font-semibold text-[var(--text)]">{entry.label}</div>
                      <div className="mt-1 text-[13px] text-[var(--text-muted)]">
                        {entry.kind === "contact" ? "Tracked contact" : "Group member"}
                      </div>
                    </div>
                    <div className="flex h-11 min-w-[116px] items-center rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-3">
                      <span className="text-[15px] font-semibold text-[var(--text)]">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={itemValues[entry.id] || ""}
                        onChange={(event) =>
                          setItemValues((previous) => ({
                            ...previous,
                            [entry.id]: event.target.value,
                          }))
                        }
                        className="ml-2 w-full bg-transparent text-right text-[16px] text-[var(--text)] outline-none"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between gap-4">
              <div className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                Shared costs
              </div>
              <button
                type="button"
                onClick={() =>
                  setSharedRows((previous) => [
                    ...previous,
                    { id: `shared-${Date.now()}`, label: "", value: "" },
                  ])
                }
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--surface-muted)] px-3 text-[14px] font-semibold text-[var(--accent-strong)]"
              >
                <PlusIcon />
                Add row
              </button>
            </div>
            <div className="mt-3 space-y-3">
              {sharedRows.map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-[1fr_118px_44px] gap-2 rounded-[22px] border border-[var(--border)] bg-[var(--surface-soft)] p-3"
                >
                  <input
                    type="text"
                    value={row.label}
                    onChange={(event) =>
                      setSharedRows((previous) =>
                        previous.map((entry) =>
                          entry.id === row.id ? { ...entry, label: event.target.value } : entry,
                        ),
                      )
                    }
                    placeholder="Tax, delivery..."
                    className="h-11 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-3 text-[16px] text-[var(--text)] outline-none"
                  />
                  <div className="flex h-11 items-center rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-3">
                    <span className="text-[15px] font-semibold text-[var(--text)]">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={row.value}
                      onChange={(event) =>
                        setSharedRows((previous) =>
                          previous.map((entry) =>
                            entry.id === row.id ? { ...entry, value: event.target.value } : entry,
                          ),
                        )
                      }
                      placeholder="0.00"
                      className="ml-2 w-full bg-transparent text-right text-[16px] text-[var(--text)] outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setSharedRows((previous) =>
                        previous.length > 1 ? previous.filter((entry) => entry.id !== row.id) : previous,
                      )
                    }
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--text-muted)]"
                    aria-label={`Remove ${row.label || "shared cost"} row`}
                  >
                    <MinusIcon />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
              Live breakdown
            </div>

            <div className="mt-3 space-y-2">
              {calculation.calculations.map((entry) => (
                <div key={entry.id} className="rounded-[18px] bg-[var(--surface-muted)] px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-[15px] font-semibold text-[var(--text)]">{entry.label}</div>
                    <div className="text-[16px] font-bold text-[var(--text)]">
                      {formatCurrency(entry.totalCents / 100)}
                    </div>
                  </div>
                  <div className="mt-1 text-[13px] text-[var(--text-muted)]">
                    Items {formatCurrency(entry.itemsCents / 100)} + shared {formatCurrency(entry.sharedShareCents / 100)}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-[16px] bg-[var(--surface-soft)] px-3 py-3">
                <div className="text-[12px] text-[var(--text-muted)]">Items</div>
                <div className="mt-1 text-[16px] font-semibold text-[var(--text)]">
                  {formatCurrency(calculation.itemTotalCents / 100)}
                </div>
              </div>
              <div className="rounded-[16px] bg-[var(--surface-soft)] px-3 py-3">
                <div className="text-[12px] text-[var(--text-muted)]">Shared costs</div>
                <div className="mt-1 text-[16px] font-semibold text-[var(--text)]">
                  {formatCurrency(calculation.sharedTotalCents / 100)}
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={!calculation.isValid}
            onClick={() =>
              onApply?.({
                items: splitEntries.map((entry) => ({
                  id: entry.id,
                  label: entry.label,
                  kind: entry.kind,
                  itemsCents: toCents(itemValues[entry.id]),
                })),
                sharedCosts: sharedRows
                  .map((row) => ({
                    id: row.id,
                    label: row.label || "Shared",
                    amountCents: toCents(row.value),
                  }))
                  .filter((row) => row.amountCents > 0),
                calculations: calculation.calculations,
                participantShares: calculation.participantShares,
                combinedTotalCents: calculation.combinedTotalCents,
              })
            }
            className="mt-5 flex min-h-[52px] w-full items-center justify-center rounded-full bg-[var(--accent)] px-5 text-[16px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Apply fair split
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
