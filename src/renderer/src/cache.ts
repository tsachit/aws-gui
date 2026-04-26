// Generic key-value cache that survives React navigation (module-level).

export const TTL_10M = 10 * 60 * 1000
export const TTL_5M  =  5 * 60 * 1000
export const TTL_2M  =  2 * 60 * 1000

interface Entry<T> { value: T; fetchedAt: number }
const store = new Map<string, Entry<unknown>>()

export function getCache<T>(key: string, ttlMs: number): T | null {
  const entry = store.get(key) as Entry<T> | undefined
  if (!entry) return null
  if (Date.now() - entry.fetchedAt > ttlMs) { store.delete(key); return null }
  return entry.value
}

export function setCache<T>(key: string, value: T): void {
  store.set(key, { value, fetchedAt: Date.now() })
}

export function clearCache(key: string): void { store.delete(key) }

export function clearCacheByPrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}
