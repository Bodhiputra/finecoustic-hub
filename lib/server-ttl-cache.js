/** In-process TTL cache for hot server reads (one Vercel instance — best-effort). */

const stores = new Map();

export function getTtlCache(namespace) {
  if (!stores.has(namespace)) {
    stores.set(namespace, new Map());
  }
  return stores.get(namespace);
}

export async function cachedTtl(namespace, key, ttlMs, loader) {
  const store = getTtlCache(namespace);
  const now = Date.now();
  const hit = store.get(key);
  if (hit && now - hit.at < ttlMs) return hit.value;

  const value = await loader();
  store.set(key, { at: now, value });
  return value;
}
