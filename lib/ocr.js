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

const SKIP_LINE_PATTERN = /total|amount due|grand total|change|cash|card|thank|table|server|receipt|invoice|subtotal(?!\s)/i;
const SHARED_COST_PATTERN = /\b(tax|tip|gratuity|service\s+fee|delivery\s+fee|delivery|surcharge)\b/i;
const LINE_ITEM_PATTERN = /^(.+?)\s+\$?([0-9]+\.[0-9]{2})\s*$/;
const QTY_PREFIX_PATTERN = /^\d+\s*[xX]\s*/;

export function extractLineItems(text) {
  const items = [];
  const sharedCosts = [];

  for (const raw of String(text || "").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (SKIP_LINE_PATTERN.test(line)) continue;

    const match = line.match(LINE_ITEM_PATTERN);
    if (!match) continue;

    const rawName = match[1].replace(QTY_PREFIX_PATTERN, "").trim();
    const cents = Math.round(Number.parseFloat(match[2]) * 100);
    if (!rawName || !cents || cents <= 0) continue;

    if (SHARED_COST_PATTERN.test(rawName)) {
      sharedCosts.push({ name: rawName, cents });
    } else {
      items.push({ name: rawName, cents });
    }
  }

  return { items, sharedCosts };
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
  const { items, sharedCosts } = extractLineItems(text);

  return {
    text,
    amount,
    merchantName,
    items,
    sharedCosts,
  };
}
