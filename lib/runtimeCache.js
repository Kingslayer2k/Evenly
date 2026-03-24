const runtimeCache = new Map();
const STORAGE_KEY = "evenly-runtime-cache";

function readStorageCache() {
  if (typeof window === "undefined") return {};

  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.error("Could not read runtime cache storage:", error);
    return {};
  }
}

function writeStorageCache(nextValue) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextValue));
  } catch (error) {
    console.error("Could not write runtime cache storage:", error);
  }
}

// Returns cached value regardless of age — for instant display while refreshing in background.
export function readRuntimeCacheStale(key) {
  if (!key) return null;
  const inMemoryEntry = runtimeCache.get(key);
  if (inMemoryEntry) return inMemoryEntry.value;
  const storageCache = readStorageCache();
  return storageCache[key]?.value ?? null;
}

export function readRuntimeCache(key, maxAgeMs = 15000) {
  if (!key) return null;

  const inMemoryEntry = runtimeCache.get(key);
  const storageCache = !inMemoryEntry ? readStorageCache() : null;
  const storedEntry = !inMemoryEntry ? storageCache[key] : null;
  const entry = inMemoryEntry || storedEntry;
  if (!entry) return null;

  if (Date.now() - entry.timestamp > maxAgeMs) {
    runtimeCache.delete(key);
    if (storedEntry) {
      const nextStorageCache = readStorageCache();
      delete nextStorageCache[key];
      writeStorageCache(nextStorageCache);
    }
    return null;
  }

  if (!inMemoryEntry && storedEntry) {
    runtimeCache.set(key, storedEntry);
  }

  return entry.value;
}

export function writeRuntimeCache(key, value) {
  if (!key) return value;

  runtimeCache.set(key, {
    value,
    timestamp: Date.now(),
  });

  const nextStorageCache = readStorageCache();
  nextStorageCache[key] = {
    value,
    timestamp: Date.now(),
  };
  writeStorageCache(nextStorageCache);

  return value;
}

export function clearRuntimeCache(prefixes = []) {
  if (!prefixes.length) {
    runtimeCache.clear();
    writeStorageCache({});
    return;
  }

  const nextStorageCache = readStorageCache();

  for (const key of runtimeCache.keys()) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      runtimeCache.delete(key);
    }
  }

  for (const key of Object.keys(nextStorageCache)) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      delete nextStorageCache[key];
    }
  }

  writeStorageCache(nextStorageCache);
}
