const runtimeCache = new Map();
const STORAGE_PREFIX = "evenly-cache:";

function getStorageKey(key) {
  return `${STORAGE_PREFIX}${key}`;
}

// Returns cached value regardless of age — for instant display while refreshing in background.
export function readRuntimeCacheStale(key) {
  if (!key) return null;
  const inMemoryEntry = runtimeCache.get(key);
  if (inMemoryEntry) return inMemoryEntry.value;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(getStorageKey(key));
    if (!raw) return null;
    const entry = JSON.parse(raw);
    return entry?.value ?? null;
  } catch {
    return null;
  }
}

export function readRuntimeCache(key, maxAgeMs = 15000) {
  if (!key) return null;

  const inMemoryEntry = runtimeCache.get(key);
  if (inMemoryEntry) {
    if (Date.now() - inMemoryEntry.timestamp > maxAgeMs) {
      runtimeCache.delete(key);
      return null;
    }
    return inMemoryEntry.value;
  }

  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(getStorageKey(key));
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > maxAgeMs) {
      window.localStorage.removeItem(getStorageKey(key));
      return null;
    }
    runtimeCache.set(key, entry);
    return entry.value;
  } catch {
    return null;
  }
}

export function writeRuntimeCache(key, value) {
  if (!key) return value;

  const entry = { value, timestamp: Date.now() };
  runtimeCache.set(key, entry);

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(getStorageKey(key), JSON.stringify(entry));
    } catch (error) {
      console.error("Could not write runtime cache storage:", error);
    }
  }

  return value;
}

export function clearRuntimeCache(prefixes = []) {
  if (!prefixes.length) {
    runtimeCache.clear();
    if (typeof window !== "undefined") {
      const keysToRemove = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k?.startsWith(STORAGE_PREFIX)) keysToRemove.push(k);
      }
      for (const k of keysToRemove) window.localStorage.removeItem(k);
    }
    return;
  }

  for (const key of runtimeCache.keys()) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      runtimeCache.delete(key);
    }
  }

  if (typeof window !== "undefined") {
    const keysToRemove = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const storageKey = window.localStorage.key(i);
      if (storageKey?.startsWith(STORAGE_PREFIX)) {
        const cacheKey = storageKey.slice(STORAGE_PREFIX.length);
        if (prefixes.some((prefix) => cacheKey.startsWith(prefix))) {
          keysToRemove.push(storageKey);
        }
      }
    }
    for (const k of keysToRemove) window.localStorage.removeItem(k);
  }
}
