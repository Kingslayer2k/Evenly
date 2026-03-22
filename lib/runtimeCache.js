const runtimeCache = new Map();

export function readRuntimeCache(key, maxAgeMs = 15000) {
  if (!key) return null;

  const entry = runtimeCache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > maxAgeMs) {
    runtimeCache.delete(key);
    return null;
  }

  return entry.value;
}

export function writeRuntimeCache(key, value) {
  if (!key) return value;

  runtimeCache.set(key, {
    value,
    timestamp: Date.now(),
  });

  return value;
}

export function clearRuntimeCache(prefixes = []) {
  if (!prefixes.length) {
    runtimeCache.clear();
    return;
  }

  for (const key of runtimeCache.keys()) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      runtimeCache.delete(key);
    }
  }
}

