"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { prepareCardBackgroundImage } from "../lib/cardAppearance";
import { copyToClipboard, getDefaultColor, PRESET_COLORS } from "../lib/utils";

function FourSquaresIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9">
      <rect x="4" y="4" width="6" height="6" rx="1.4" />
      <rect x="14" y="4" width="6" height="6" rx="1.4" />
      <rect x="4" y="14" width="6" height="6" rx="1.4" />
      <rect x="14" y="14" width="6" height="6" rx="1.4" />
    </svg>
  );
}

function ImagePlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5Z" />
      <path d="m7.5 16 3.4-3.4a1 1 0 0 1 1.4 0L16.5 17" />
      <path d="m13.5 14 1.1-1.1a1 1 0 0 1 1.4 0l2 2" />
      <circle cx="9" cy="9" r="1.2" />
      <path d="M19 3v4" />
      <path d="M17 5h4" />
    </svg>
  );
}

export default function CreateGroupModal({ isOpen, onClose, onCreate, mode = "group" }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [groupName, setGroupName] = useState("");
  const [tripStartDate, setTripStartDate] = useState("");
  const [tripEndDate, setTripEndDate] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [selectedColor, setSelectedColor] = useState(getDefaultColor(0));
  const [selectedImage, setSelectedImage] = useState("");
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const colorInputRef = useRef(null);
  const imageInputRef = useRef(null);

  function resetState() {
    setCurrentStep(1);
    setGroupName("");
    setTripStartDate("");
    setTripEndDate("");
    setGeneratedCode("");
    setSelectedColor(getDefaultColor(0));
    setSelectedImage("");
    setCopied(false);
    setSharing(false);
    setIsSubmitting(false);
    setError("");
  }

  const inviteLink = useMemo(
    () =>
      generatedCode && typeof window !== "undefined"
        ? `${window.location.origin}/groups?join=${generatedCode}`
        : "",
    [generatedCode],
  );

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(event) {
      if (event.key === "Escape") {
        resetState();
        onClose?.();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) return;
    resetState();
  }, [isOpen]);

  if (!isOpen) return null;

  function resetAndClose() {
    resetState();
    onClose?.();
  }

  async function handleCreate() {
    const trimmedName = groupName.trim();
    if (!trimmedName || isSubmitting) return;

    setIsSubmitting(true);
    setError("");

    const result = await onCreate?.({
      name: trimmedName,
      mode,
      tripStartDate: tripStartDate || null,
      tripEndDate: tripEndDate || null,
      color: selectedColor,
      imageData: selectedImage,
    });

    if (!result?.ok) {
      setIsSubmitting(false);
      setError(result?.message || "Could not create group right now.");
      return;
    }

    setGeneratedCode(result.code);
    setCurrentStep(2);
    setIsSubmitting(false);
  }

  async function handleCopyCode() {
    if (!generatedCode) return;
    const success = await copyToClipboard(generatedCode);
    if (success) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    }
  }

  async function handleShareLink() {
    if (!generatedCode) return;
    setSharing(true);
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Join my Evenly group",
          text: `Join my Evenly group with code ${generatedCode}`,
          url: inviteLink || undefined,
        });
      } else if (inviteLink) {
        await copyToClipboard(inviteLink);
      } else {
        await copyToClipboard(generatedCode);
      }
    } finally {
      setSharing(false);
    }
  }

  async function handleImageInputChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const imageData = await prepareCardBackgroundImage(file);
      setSelectedImage(imageData);
    } catch (nextError) {
      console.error(nextError);
      setError(nextError.message || "Could not load that image.");
    } finally {
      event.target.value = "";
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-[var(--overlay)]" onClick={resetAndClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-x-0 bottom-0 h-[85vh] rounded-t-[24px] border border-[var(--border)] bg-[var(--surface)] transition duration-300 ease-out"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex h-14 items-center justify-between border-b border-[var(--border)] px-5">
          {currentStep === 1 ? (
            <button
              type="button"
              className="text-[16px] font-medium text-[var(--text-muted)]"
              onClick={resetAndClose}
            >
              Cancel
            </button>
          ) : (
            <span />
          )}

          <span />

          {currentStep === 2 ? (
            <button
              type="button"
              className="text-[16px] font-medium text-[var(--accent)]"
              onClick={resetAndClose}
            >
              Done
            </button>
          ) : (
            <span />
          )}
        </div>

        {currentStep === 1 ? (
          <div className="flex h-[calc(85vh-56px)] flex-col">
            <div className="flex-1 overflow-y-auto px-6 pt-6 pb-6">
              <h2 className="text-[28px] font-bold text-[var(--text)]">
                {mode === "trip" ? "New trip" : "New group"}
              </h2>
              <p className="mt-2 text-[15px] font-normal text-[var(--text-muted)]">
                {mode === "trip"
                  ? "Competitions, vacations, and short shared spending in one place."
                  : "Roomies, housemates, and the people you split everyday life with."}
              </p>

              <label className="mt-8 block text-[13px] font-medium text-[var(--text-muted)]">
                {mode === "trip" ? "Trip name" : "Group name"}
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                placeholder={mode === "trip" ? "e.g., ICDC Atlanta 2026" : "e.g., The Apartment"}
                className="mt-2 h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-[16px] font-normal text-[var(--text)] placeholder:text-[var(--text-soft)] outline-none focus:border-[var(--accent)]"
              />

              {mode === "trip" ? (
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[13px] font-medium text-[var(--text-muted)]">
                      Start date
                    </label>
                    <input
                      type="date"
                      value={tripStartDate}
                      onChange={(event) => setTripStartDate(event.target.value)}
                      className="mt-2 h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-[16px] font-normal text-[var(--text)] outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-[var(--text-muted)]">
                      End date
                    </label>
                    <input
                      type="date"
                      value={tripEndDate}
                      onChange={(event) => setTripEndDate(event.target.value)}
                      className="mt-2 h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-[16px] font-normal text-[var(--text)] outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                </div>
              ) : null}

              <div className="mt-6">
                <div className="text-[13px] font-medium text-[var(--text-muted)]">
                  {mode === "trip" ? "Trip color" : "Card color"}
                </div>

                <div className="mt-3 flex flex-wrap gap-3">
                  {PRESET_COLORS.map((color) => {
                    const isSelected = selectedColor.toLowerCase() === color.toLowerCase();
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setSelectedColor(color)}
                        className={`h-10 w-10 rounded-full border-2 transition active:scale-95 ${
                          isSelected
                            ? "border-[var(--accent)] shadow-[0_0_0_4px_rgba(95,125,106,0.16)]"
                            : "border-[var(--surface)] shadow-[0_4px_10px_rgba(28,25,23,0.08)]"
                        }`}
                        style={{ backgroundColor: color }}
                        aria-label={`Select ${color} as the card color`}
                      />
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => colorInputRef.current?.click()}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text)] transition hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-white active:scale-95"
                    aria-label="Open custom color picker"
                  >
                    <FourSquaresIcon />
                  </button>

                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-4 text-[13px] font-semibold text-[var(--text)] transition hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-white active:scale-95"
                    aria-label="Add an image background"
                  >
                    <ImagePlusIcon />
                    Add image
                  </button>

                  <input
                    ref={colorInputRef}
                    type="color"
                    value={selectedColor}
                    onChange={(event) => setSelectedColor(event.target.value)}
                    className="sr-only"
                    tabIndex={-1}
                  />

                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(event) => void handleImageInputChange(event)}
                    className="sr-only"
                    tabIndex={-1}
                  />
                </div>

                <div
                  className="relative mx-auto mt-4 max-w-[360px] overflow-hidden rounded-[24px] border border-white/70 shadow-[0_8px_20px_rgba(28,25,23,0.08)]"
                  style={{ backgroundColor: selectedColor }}
                >
                  {selectedImage ? (
                    <div
                      className="absolute inset-0 bg-cover bg-center"
                      style={{ backgroundImage: `url(${selectedImage})` }}
                    />
                  ) : null}

                  <div className="relative aspect-[3.375/2.125] bg-[rgba(28,25,23,0.18)] px-5 py-5 text-white">
                    <div className="flex h-full flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div
                            className="text-[26px] font-semibold leading-[0.96] tracking-[-0.04em]"
                            style={{ fontFamily: "Tiempos Headline, Georgia, 'Times New Roman', serif" }}
                          >
                            {groupName.trim() || (mode === "trip" ? "Your trip" : "Your group")}
                          </div>
                          <div className="mt-2 text-[14px] text-white/85">
                            {mode === "trip"
                              ? [tripStartDate, tripEndDate].filter(Boolean).join(" → ") || "Dates coming soon"
                              : "You and the crew"}
                          </div>
                        </div>
                        <div className="text-right text-[16px] font-semibold">$0</div>
                      </div>

                      <div className="mt-auto flex items-end justify-between">
                        <div>
                          <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/70">
                            settled up.
                          </div>
                          <div className="mt-2 text-[34px] font-bold tracking-[-0.05em]">
                            +$0.00
                          </div>
                        </div>
                        <div className="text-[12px] text-white/82">0 expenses • code soon</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {error ? (
                <p className="mt-4 text-[13px] font-medium text-[var(--danger)]">{error}</p>
              ) : null}
            </div>

            <div className="mt-auto border-t border-[var(--border)] bg-[var(--surface)] px-6 py-4">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void handleCreate()}
                  disabled={!groupName.trim() || isSubmitting}
                  className="rounded-xl bg-[var(--accent)] px-8 py-3 text-[16px] font-medium text-white transition duration-200 ease-out hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)] disabled:text-[var(--text-soft)]"
                >
                  {isSubmitting ? "Creating..." : "Create"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-[calc(85vh-56px)] overflow-y-auto px-6 pt-6 pb-8">
            <div className="text-center">
              <div className="text-[48px] leading-none">✓</div>
              <h2 className="mt-4 text-[28px] font-bold text-[var(--text)]">
                {mode === "trip" ? "Trip created!" : "Group created!"}
              </h2>
              <p className="mt-2 text-[15px] font-normal text-[var(--text-muted)]">
                Share this code with your friends
              </p>
            </div>

            <div className="mt-8 rounded-xl border-2 border-[var(--border)] bg-[var(--surface-muted)] p-5 text-center">
              <div className="font-mono text-[36px] font-bold tracking-[6px] text-[var(--text)]">
                {generatedCode}
              </div>
              <button
                type="button"
                onClick={() => void handleCopyCode()}
                className="mt-4 rounded-lg border border-[var(--accent)] px-5 py-2 text-[14px] font-medium text-[var(--accent)] transition hover:bg-[var(--surface-soft)]"
              >
                {copied ? "Copied!" : "Copy code"}
              </button>
            </div>

            <div className="my-6 text-center text-[13px] font-normal text-[var(--text-soft)]">or</div>

            <div>
              <div className="text-[13px] font-medium text-[var(--text-muted)]">Share invite link</div>
              <div className="mt-2 rounded-lg bg-[var(--surface-muted)] px-4 py-3 font-mono text-[14px] font-normal text-[var(--accent)]">
                {inviteLink || "Use the code above inside Evenly"}
              </div>
              <button
                type="button"
                onClick={() => void handleShareLink()}
                className="mt-3 rounded-lg border border-[var(--border)] px-5 py-2 text-[14px] font-medium text-[var(--text-muted)] transition hover:bg-[var(--surface-soft)]"
              >
                {sharing ? "Sharing..." : "Share"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
