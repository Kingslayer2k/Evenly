"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { scanReceipt } from "../lib/ocr";

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 8a2 2 0 0 1 2-2h2l1.5-2h5L16 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M5 20h14" />
    </svg>
  );
}

function formatAmount(value) {
  if (!value) return "";
  return Number(value).toFixed(2);
}

export default function ReceiptScanner({ isOpen, onClose, onUseResult }) {
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const [step, setStep] = useState("choose");
  const [progress, setProgress] = useState(0);
  const [imageUrl, setImageUrl] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageUrl]);

  if (!isOpen) return null;

  function reset() {
    setStep("choose");
    setProgress(0);
    setAmount("");
    setDescription("");
    setError("");
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
      setImageUrl("");
    }
  }

  async function handleFile(file) {
    if (!file) return;

    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }

    const nextImageUrl = URL.createObjectURL(file);
    setImageUrl(nextImageUrl);
    setStep("scanning");
    setError("");
    setProgress(0);

    try {
      const result = await scanReceipt(file, setProgress);
      setAmount(formatAmount(result.amount));
      setDescription(result.merchantName || "Receipt");
      setStep("result");
    } catch (scanError) {
      console.error(scanError);
      setError("Couldn’t read that receipt. Try a clearer photo or enter it manually.");
      setStep("error");
    }
  }

  return (
    <div className="fixed inset-0 z-[75] bg-[rgba(28,25,23,0.45)]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-scanner-title"
        className="fixed inset-x-0 bottom-0 rounded-t-[28px] bg-white px-6 pt-6 pb-8 shadow-[0_-18px_44px_rgba(28,25,23,0.16)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-[#E5E7EB]" />

        <h2 id="receipt-scanner-title" className="text-[24px] font-bold tracking-[-0.04em] text-[#1C1917]">
          Scan receipt
        </h2>

        {step === "choose" ? (
          <div className="mt-5 space-y-3">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex min-h-14 w-full items-center gap-3 rounded-[12px] bg-[linear-gradient(135deg,#5F7D6A_0%,#3A4E43_100%)] px-4 text-left text-white transition hover:opacity-95 active:scale-[0.99]"
            >
              <CameraIcon />
              <span className="text-[15px] font-medium">Take photo</span>
            </button>

            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="flex min-h-14 w-full items-center gap-3 rounded-[12px] border border-[#E5E7EB] bg-[#F9FAFB] px-4 text-left text-[#1C1917] transition hover:bg-[#F3F4F6]"
            >
              <UploadIcon />
              <span className="text-[15px] font-medium">Upload from gallery</span>
            </button>
          </div>
        ) : null}

        {step === "scanning" ? (
          <div className="mt-6 rounded-[24px] bg-[#F7F7F5] p-5 text-center">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt="Receipt preview"
                width={112}
                height={160}
                unoptimized
                className="mx-auto h-40 w-28 rounded-[16px] object-cover shadow-sm"
              />
            ) : (
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[#E1F9D8] text-[34px]">
                📄
              </div>
            )}

            <div className="mt-5 text-[18px] font-semibold text-[#1C1917]">Scanning receipt...</div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#E5E7EB]">
              <div
                className="h-full rounded-full bg-[#5F7D6A] transition-all duration-200"
                style={{ width: `${Math.max(8, Math.round(progress * 100))}%` }}
              />
            </div>
          </div>
        ) : null}

        {step === "result" ? (
          <div className="mt-6">
            <div className="rounded-[24px] bg-[#F7F7F5] p-5">
              <div className="text-[18px] font-semibold text-[#1C1917]">Receipt scanned!</div>

              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt="Receipt preview"
                  width={112}
                  height={160}
                  unoptimized
                  className="mt-4 h-40 w-28 rounded-[16px] object-cover shadow-sm"
                />
              ) : null}

              <div className="mt-5">
                <label className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#6B7280]">
                  Amount detected
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="mt-2 h-12 w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[16px] text-[#1C1917] outline-none focus:border-[#5F7D6A]"
                />
              </div>

              <div className="mt-4">
                <label className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#6B7280]">
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="mt-2 h-12 w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[16px] text-[#1C1917] outline-none focus:border-[#5F7D6A]"
                />
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  onUseResult?.({
                    amount,
                    description,
                  });
                  onClose?.();
                }}
                className="min-h-11 rounded-[12px] bg-[#5F7D6A] px-4 text-[15px] font-medium text-white transition hover:bg-[#3A4E43]"
              >
                Use this
              </button>
              <button
                type="button"
                onClick={reset}
                className="min-h-11 rounded-[12px] border border-[#E5E7EB] bg-white px-4 text-[15px] font-medium text-[#6B7280] transition hover:bg-[#F7F7F5]"
              >
                Scan again
              </button>
            </div>
          </div>
        ) : null}

        {step === "error" ? (
          <div className="mt-6 rounded-[24px] bg-[#F7F7F5] p-5">
            <div className="text-[18px] font-semibold text-[#1C1917]">Couldn&apos;t read receipt</div>
            <p className="mt-3 text-[14px] leading-6 text-[#6B7280]">{error}</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={reset}
                className="min-h-11 rounded-[12px] bg-[#5F7D6A] px-4 text-[15px] font-medium text-white transition hover:bg-[#3A4E43]"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={onClose}
                className="min-h-11 rounded-[12px] border border-[#E5E7EB] bg-white px-4 text-[15px] font-medium text-[#6B7280] transition hover:bg-[#F7F7F5]"
              >
                Enter manually
              </button>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={onClose}
          className="mt-5 min-h-11 w-full rounded-[12px] bg-transparent text-[15px] font-medium text-[#6B7280] transition hover:bg-[#F7F7F5]"
        >
          Cancel
        </button>

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />

        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />
      </div>
    </div>
  );
}
