"use client";

function normalizeAmountMatch(value) {
  const parsed = Number.parseFloat(String(value || "").replace(/,/g, ""));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export function extractAmount(text) {
  const patterns = [
    /grand total[^0-9$]*\$?\s*([0-9]+(?:[.,][0-9]{2})?)/i,
    /total due[^0-9$]*\$?\s*([0-9]+(?:[.,][0-9]{2})?)/i,
    /amount due[^0-9$]*\$?\s*([0-9]+(?:[.,][0-9]{2})?)/i,
    /total[^0-9$]*\$?\s*([0-9]+(?:[.,][0-9]{2})?)/i,
    /\$\s*([0-9]+(?:[.,][0-9]{2})?)\s*$/m,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const amount = normalizeAmountMatch(match[1]);
      if (amount) return amount;
    }
  }

  return null;
}

export function extractMerchantName(text) {
  const firstMeaningfulLine = String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length >= 3 && /[a-z]/i.test(line) && !/receipt|invoice|total|thank/i.test(line));

  return firstMeaningfulLine || "Receipt";
}

export async function scanReceipt(file, onProgress) {
  const Tesseract = await import("tesseract.js");
  const recognize = Tesseract.recognize || Tesseract.default?.recognize;

  if (typeof recognize !== "function") {
    throw new Error("Receipt scanner could not load OCR.");
  }

  const result = await recognize(file, "eng", {
    logger(message) {
      if (message?.status === "recognizing text" && typeof onProgress === "function") {
        onProgress(message.progress || 0);
      }
    },
  });

  const text = result?.data?.text || "";
  const amount = extractAmount(text);
  const merchantName = extractMerchantName(text);

  return {
    text,
    amount,
    merchantName,
  };
}
