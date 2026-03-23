"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { getExpenseEmoji, stripExpenseEmojiPrefix } from "../lib/utils";

const ReceiptScanner = dynamic(() => import("./ReceiptScanner"), {
  loading: () => null,
});
const FairSplitModal = dynamic(() => import("./FairSplitModal"), {
  loading: () => null,
});

const EXPENSE_EMOJIS = ["💸", "🛒", "🍕", "🍽️", "🎟️", "🏠", "🚕", "☕️", "🎉", "🧾"];

function toCents(value) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.round(parsed * 100);
}

export default function AddExpenseModal({
  isOpen,
  onClose,
  onSubmit,
  members,
  contexts,
  contacts = [],
  initialPayerId,
  rotations = [],
}) {
  const memberIds = (members || []).map((member) => member.id);
  const contactIds = (contacts || []).map((contact) => contact.id);
  const [title, setTitle] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState("💸");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState(initialPayerId || memberIds[0] || "");
  const [splitMode, setSplitMode] = useState("equal");
  const [splitMethod, setSplitMethod] = useState("even");
  const [selectedParticipants, setSelectedParticipants] = useState(memberIds);
  const [selectedContactIds, setSelectedContactIds] = useState([]);
  const [customAmounts, setCustomAmounts] = useState(
    memberIds.reduce((accumulator, memberId) => {
      accumulator[memberId] = "";
      return accumulator;
    }, {}),
  );
  const [customContactAmounts, setCustomContactAmounts] = useState(
    contactIds.reduce((accumulator, contactId) => {
      accumulator[contactId] = "";
      return accumulator;
    }, {}),
  );
  const [contextId, setContextId] = useState(contexts?.[0]?.id || "");
  const [contextName, setContextName] = useState(contexts?.[0]?.name || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isFairSplitOpen, setIsFairSplitOpen] = useState(false);
  const [fairSplitDetails, setFairSplitDetails] = useState(null);
  const [error, setError] = useState("");

  const amountCents = useMemo(() => toCents(amount), [amount]);

  const selectedMembers = useMemo(
    () => (members || []).filter((member) => selectedParticipants.includes(member.id)),
    [members, selectedParticipants],
  );
  const selectedContacts = useMemo(
    () => (contacts || []).filter((contact) => selectedContactIds.includes(contact.id)),
    [contacts, selectedContactIds],
  );

  const customTotalCents = useMemo(() => {
    return selectedParticipants.reduce((sum, memberId) => sum + toCents(customAmounts[memberId]), 0);
  }, [customAmounts, selectedParticipants]);
  const customContactTotalCents = useMemo(() => {
    return selectedContactIds.reduce((sum, contactId) => sum + toCents(customContactAmounts[contactId]), 0);
  }, [customContactAmounts, selectedContactIds]);

  const matchedRotation = useMemo(() => {
    const normalizedTitle = stripExpenseEmojiPrefix(title).trim().toLowerCase();
    if (!normalizedTitle) return null;

    return (rotations || []).find((rotation) => {
      const normalizedRotation = String(rotation?.name || "").trim().toLowerCase();
      return normalizedRotation && (normalizedTitle.includes(normalizedRotation) || normalizedRotation.includes(normalizedTitle));
    }) || null;
  }, [rotations, title]);

  if (!isOpen) return null;

  function toggleParticipant(memberId) {
    if (splitMethod === "fair") {
      setSplitMethod("custom");
      setFairSplitDetails(null);
    }
    setSelectedParticipants((previous) => {
      if (previous.includes(memberId)) {
        return previous.filter((id) => id !== memberId);
      }
      return [...previous, memberId];
    });
  }

  function toggleContact(contactId) {
    if (splitMethod === "fair") {
      setSplitMethod("custom");
      setFairSplitDetails(null);
    }
    setSelectedContactIds((previous) => {
      if (previous.includes(contactId)) {
        return previous.filter((id) => id !== contactId);
      }
      return [...previous, contactId];
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSubmitting) return;

    if (!title.trim()) {
      setError("Give the expense a name first.");
      return;
    }

    const cleanTitle = stripExpenseEmojiPrefix(title).trim();
    if (!cleanTitle) {
      setError("Give the expense a name first.");
      return;
    }

    if (!amountCents) {
      setError("Add a real amount before saving.");
      return;
    }

    if (!paidBy) {
      setError("Pick who paid.");
      return;
    }

    if (!selectedParticipants.length) {
      setError("Keep at least one group member in the split.");
      return;
    }

    let shares = null;
    let contactShares = {};
    let effectiveSplitType = splitMode;
    let effectiveSplitMethod = splitMethod;
    let effectiveSplitDetails = fairSplitDetails ? { fair: fairSplitDetails } : {};

    if (matchedRotation?.id) {
      effectiveSplitDetails = {
        ...effectiveSplitDetails,
        rotation: {
          id: matchedRotation.id,
          name: matchedRotation.name,
        },
      };
    }

    if (splitMethod === "fair" && fairSplitDetails) {
      effectiveSplitType = "custom";
      effectiveSplitMethod = "fair";
      shares = {};
      contactShares = {};

      fairSplitDetails.calculations.forEach((entry) => {
        if (entry.kind === "contact") {
          contactShares[entry.id] = Number(entry.totalCents || 0);
        } else {
          shares[entry.id] = Number(entry.totalCents || 0);
        }
      });

      const fairTotal = Object.values(shares).reduce((sum, value) => sum + Number(value || 0), 0)
        + Object.values(contactShares).reduce((sum, value) => sum + Number(value || 0), 0);

      if (fairTotal !== amountCents) {
        setError("The fair split needs to match the expense total.");
        return;
      }
    } else if (splitMode === "custom") {
      if (customTotalCents + customContactTotalCents !== amountCents) {
        setError("Custom shares need to add up to the full amount.");
        return;
      }

      shares = selectedParticipants.reduce((accumulator, memberId) => {
        accumulator[memberId] = toCents(customAmounts[memberId]);
        return accumulator;
      }, {});
      contactShares = selectedContactIds.reduce((accumulator, contactId) => {
        accumulator[contactId] = toCents(customContactAmounts[contactId]);
        return accumulator;
      }, {});
    } else if (selectedContactIds.length) {
      effectiveSplitType = "custom";
      const totalSplitCount = selectedParticipants.length + selectedContactIds.length;
      const baseShare = Math.floor(amountCents / totalSplitCount);
      let remainder = amountCents - baseShare * totalSplitCount;
      const allocation = {};

      for (const memberId of selectedParticipants) {
        allocation[`member:${memberId}`] = baseShare + (remainder > 0 ? 1 : 0);
        remainder = Math.max(0, remainder - 1);
      }

      for (const contactId of selectedContactIds) {
        allocation[`contact:${contactId}`] = baseShare + (remainder > 0 ? 1 : 0);
        remainder = Math.max(0, remainder - 1);
      }

      shares = selectedParticipants.reduce((accumulator, memberId) => {
        accumulator[memberId] = allocation[`member:${memberId}`] || 0;
        return accumulator;
      }, {});
      contactShares = selectedContactIds.reduce((accumulator, contactId) => {
        accumulator[contactId] = allocation[`contact:${contactId}`] || 0;
        return accumulator;
      }, {});
    }

    setIsSubmitting(true);
    setError("");

    const result = await onSubmit?.({
      title: `${selectedEmoji} ${cleanTitle}`,
      amountCents,
      paidBy,
      participants: selectedParticipants,
      splitType: effectiveSplitType,
      splitMethod: effectiveSplitMethod,
      shares,
      contactParticipants: selectedContactIds,
      contactShares,
      contextId: contextId || null,
      contextName: contextName.trim() || null,
      splitDetails: Object.keys(effectiveSplitDetails).length ? effectiveSplitDetails : null,
    });

    if (!result?.ok) {
      setIsSubmitting(false);
      setError(result?.message || "Could not save the expense.");
      return;
    }

    setIsSubmitting(false);
    onClose?.();
  }

  function handleContextInputChange(event) {
    const nextName = event.target.value;
    setContextName(nextName);

    const matchingContext = (contexts || []).find((context) => {
      const label = String(context.name || "").trim().toLowerCase();
      return label === nextName.trim().toLowerCase();
    });

    setContextId(matchingContext?.id || "");
  }

  return (
    <div className="fixed inset-0 z-50 bg-[var(--overlay)]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-x-0 bottom-0 max-h-[100dvh] overflow-y-auto rounded-t-[28px] border border-[var(--border)] bg-[var(--surface)] px-6 pt-6 pb-[calc(var(--safe-bottom)+24px)] shadow-[0_-10px_40px_rgba(28,25,23,0.14)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-[var(--border)]" />

        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[28px] font-bold tracking-[-0.04em] text-[var(--text)]">Add expense</h2>
            <p className="mt-2 text-[14px] leading-5 text-[var(--text-muted)]">
              Drop in what happened and we&apos;ll update everyone live.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--text)] transition hover:opacity-90"
            aria-label="Close add expense modal"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="flex min-h-[52px] w-full items-center justify-center gap-3 rounded-[12px] bg-[linear-gradient(135deg,#5F7D6A_0%,#3A4E43_100%)] px-4 text-[15px] font-medium text-white transition hover:opacity-95 active:scale-[0.99]"
            >
              <span className="text-[18px]">📷</span>
              <span>Scan receipt</span>
            </button>
          </div>

          <div>
            <label className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
              What was it?
            </label>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Groceries, dinner, gas..."
              className="mt-2 h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-[16px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div>
            <label className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
              Emoji
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {EXPENSE_EMOJIS.map((emoji) => {
                const active = selectedEmoji === emoji;
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setSelectedEmoji(emoji)}
                    className={`flex h-11 w-11 items-center justify-center rounded-2xl border text-[20px] transition ${
                      active
                        ? "border-[var(--accent)] bg-[var(--surface-accent)]"
                        : "border-[var(--border)] bg-[var(--surface-muted)]"
                    }`}
                    aria-label={`Use ${emoji} for this expense`}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
              Amount
            </label>
            <div className="mt-2 flex h-12 items-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 focus-within:border-[var(--accent)]">
              <span className="text-[18px] font-semibold text-[var(--text)]">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                  if (splitMethod === "fair") {
                    setSplitMethod("custom");
                    setFairSplitDetails(null);
                  }
                }}
                placeholder="0.00"
                className="ml-2 w-full bg-transparent text-[16px] text-[var(--text)] outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                Paid by
              </label>
              <select
                value={paidBy}
                onChange={(event) => setPaidBy(event.target.value)}
                className="mt-2 h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-[16px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
              >
                {(members || []).map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.display_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                Context
              </label>
              <input
                type="text"
                value={contextName}
                onChange={handleContextInputChange}
                placeholder="Shared, spring break, groceries..."
                className="mt-2 h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-[16px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
              />
              {(contexts || []).length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {(contexts || []).map((context) => {
                    const label = context.name || "Shared";
                    const active = contextId === context.id || contextName.trim() === label;
                    return (
                      <button
                        key={context.id}
                        type="button"
                        onClick={() => {
                          setContextId(context.id);
                          setContextName(label);
                        }}
                    className={`min-h-11 rounded-full px-3 py-2 text-[13px] font-medium transition ${
                      active
                        ? "bg-[var(--surface-accent)] text-[var(--accent-strong)]"
                        : "bg-[var(--surface-muted)] text-[var(--text-muted)] hover:bg-[var(--surface-accent)]"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>

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

          <div>
            <div className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
              In the split
            </div>
            <div className="mt-3 space-y-3">
              {(members || []).map((member) => {
                const checked = selectedParticipants.includes(member.id);
                return (
                  <div
                    key={member.id}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <label className="flex items-center gap-3 text-[15px] text-[var(--text)]">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleParticipant(member.id)}
                          className="h-4 w-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
                        />
                        <span>{member.display_name}</span>
                      </label>

                      {splitMode === "custom" && checked ? (
                        <div className="flex h-10 items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3">
                          <span className="text-[14px] font-semibold text-[var(--text)]">$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={customAmounts[member.id] || ""}
                            onChange={(event) =>
                              setCustomAmounts((previous) => ({
                                ...previous,
                                [member.id]: event.target.value,
                              }))
                            }
                            className="ml-2 w-24 bg-transparent text-right text-[14px] text-[var(--text)] outline-none"
                            placeholder="0.00"
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {(contacts || []).length ? (
            <div>
              <div className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                Contacts not on Evenly
              </div>
              <div className="mt-3 space-y-3">
                {(contacts || []).map((contact) => {
                  const checked = selectedContactIds.includes(contact.id);
                  return (
                    <div
                      key={contact.id}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <label className="flex items-center gap-3 text-[15px] text-[var(--text)]">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleContact(contact.id)}
                            className="h-4 w-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
                          />
                          <span>{contact.display_name}</span>
                        </label>

                        {splitMode === "custom" && checked ? (
                          <div className="flex h-10 items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3">
                            <span className="text-[14px] font-semibold text-[var(--text)]">$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={customContactAmounts[contact.id] || ""}
                              onChange={(event) =>
                                setCustomContactAmounts((previous) => ({
                                  ...previous,
                                  [contact.id]: event.target.value,
                                }))
                              }
                              className="ml-2 w-24 bg-transparent text-right text-[14px] text-[var(--text)] outline-none"
                              placeholder="0.00"
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {splitMethod === "fair" && fairSplitDetails ? (
            <div className="rounded-2xl bg-[var(--surface-accent)] px-4 py-3 text-[14px] text-[var(--accent-strong)]">
              Fair split ready: items plus shared costs are balanced across {(fairSplitDetails.calculations || []).length} people.
            </div>
          ) : splitMode === "equal" ? (
            <div className="rounded-2xl bg-[var(--surface-accent)] px-4 py-3 text-[14px] text-[var(--accent-strong)]">
              {selectedMembers.length || selectedContacts.length
                ? `Each person covers about $${(amountCents / 100 / (selectedMembers.length + selectedContacts.length) || 0).toFixed(2)}.`
                : "Pick at least one person to split this with."}
            </div>
          ) : (
            <div className="rounded-2xl bg-[var(--surface-accent)] px-4 py-3 text-[14px] text-[var(--accent-strong)]">
              Custom total: ${((customTotalCents + customContactTotalCents) / 100).toFixed(2)} of ${(amountCents / 100).toFixed(2)}
            </div>
          )}

          {matchedRotation ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-[14px] text-[var(--text-muted)]">
              Matches the <span className="font-semibold text-[var(--text)]">{matchedRotation.name}</span> rotation. We&apos;ll carry that link into the saved expense.
            </div>
          ) : null}

          {error ? <p className="text-[14px] font-medium text-[var(--danger)]">{error}</p> : null}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-full border border-[var(--border)] px-5 py-3 text-[15px] font-semibold text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="min-h-11 rounded-full bg-[var(--accent)] px-6 py-3 text-[15px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Saving..." : "Save expense"}
            </button>
          </div>
        </form>
      </div>

      {isScannerOpen ? (
        <ReceiptScanner
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onUseResult={({ amount: detectedAmount, description }) => {
            if (detectedAmount) {
              setAmount(String(detectedAmount));
            }
            if (description) {
              setSelectedEmoji(getExpenseEmoji({ title: description }));
              setTitle(stripExpenseEmojiPrefix(description));
            }
            setError("");
          }}
        />
      ) : null}

      {isFairSplitOpen ? (
        <FairSplitModal
          key={`fair-${amountCents}-${selectedParticipants.join("-")}-${selectedContactIds.join("-")}`}
          isOpen={isFairSplitOpen}
          onClose={() => setIsFairSplitOpen(false)}
          totalCents={amountCents}
          members={members}
          contacts={contacts}
          selectedParticipantIds={selectedParticipants}
          selectedContactIds={selectedContactIds}
          initialDetails={fairSplitDetails}
          onApply={(details) => {
            const nextCustomAmounts = { ...customAmounts };
            const nextCustomContactAmounts = { ...customContactAmounts };
            const nextParticipantIds = [];
            const nextContactIds = [];

            details.calculations.forEach((entry) => {
              if (entry.kind === "contact") {
                nextCustomContactAmounts[entry.id] = (entry.totalCents / 100).toFixed(2);
                nextContactIds.push(entry.id);
              } else {
                nextCustomAmounts[entry.id] = (entry.totalCents / 100).toFixed(2);
                nextParticipantIds.push(entry.id);
              }
            });

            setCustomAmounts(nextCustomAmounts);
            setCustomContactAmounts(nextCustomContactAmounts);
            setSelectedParticipants(nextParticipantIds);
            setSelectedContactIds(nextContactIds);
            setSplitMode("custom");
            setSplitMethod("fair");
            setFairSplitDetails(details);
            setError("");
            setIsFairSplitOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
