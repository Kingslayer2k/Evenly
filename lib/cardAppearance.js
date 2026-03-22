export const CARD_COLORS_STORAGE_KEY = "evenly-card-colors";
export const CARD_IMAGES_STORAGE_KEY = "evenly-card-images";

function readJsonStorage(key) {
  if (typeof window === "undefined") return {};

  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.error(`Could not read ${key}:`, error);
    return {};
  }
}

function writeJsonStorage(key, value) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function readStoredCardColors() {
  return readJsonStorage(CARD_COLORS_STORAGE_KEY);
}

export function readStoredCardImages() {
  return readJsonStorage(CARD_IMAGES_STORAGE_KEY);
}

export function writeStoredCardColors(colors) {
  writeJsonStorage(CARD_COLORS_STORAGE_KEY, colors);
}

export function writeStoredCardImages(images) {
  writeJsonStorage(CARD_IMAGES_STORAGE_KEY, images);
}

export function readStoredCardImage(groupId) {
  const images = readStoredCardImages();
  return images[groupId] || "";
}

export async function prepareCardBackgroundImage(file) {
  if (!file) return "";

  const sourceDataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read that image."));
    reader.readAsDataURL(file);
  });

  const image = await new Promise((resolve, reject) => {
    const nextImage = new Image();
    nextImage.onload = () => resolve(nextImage);
    nextImage.onerror = () => reject(new Error("Could not open that image."));
    nextImage.src = sourceDataUrl;
  });

  const targetWidth = 960;
  const targetHeight = 600;
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext("2d");

  if (!context) {
    return sourceDataUrl;
  }

  const imageRatio = image.width / image.height;
  const targetRatio = targetWidth / targetHeight;

  let drawWidth = targetWidth;
  let drawHeight = targetHeight;
  let offsetX = 0;
  let offsetY = 0;

  if (imageRatio > targetRatio) {
    drawHeight = targetHeight;
    drawWidth = drawHeight * imageRatio;
    offsetX = (targetWidth - drawWidth) / 2;
  } else {
    drawWidth = targetWidth;
    drawHeight = drawWidth / imageRatio;
    offsetY = (targetHeight - drawHeight) / 2;
  }

  context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
  return canvas.toDataURL("image/jpeg", 0.72);
}
