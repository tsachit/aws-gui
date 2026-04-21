import type { EcsInstance } from './types/electron-api'

const TTL_MS = 10 * 60 * 1000

interface CacheEntry {
  instances: EcsInstance[]
  fetchedAt: number
}

const cache = new Map<string, CacheEntry>()

function key(cluster: string, service: string): string {
  return `${cluster}::${service}`
}

export function getCachedInstances(cluster: string, service: string): EcsInstance[] | null {
  const entry = cache.get(key(cluster, service))
  if (!entry) return null
  if (Date.now() - entry.fetchedAt > TTL_MS) {
    cache.delete(key(cluster, service))
    return null
  }
  return entry.instances
}

export function setCachedInstances(cluster: string, service: string, instances: EcsInstance[]): void {
  cache.set(key(cluster, service), { instances, fetchedAt: Date.now() })
}

export function invalidateCache(cluster?: string, service?: string): void {
  if (cluster && service) cache.delete(key(cluster, service))
  else cache.clear()
}

let _selectedCluster: string | null = null
let _selectedService: string | null = null

export function getSelectedCluster(): string | null { return _selectedCluster }
export function setSelectedCluster(c: string): void { _selectedCluster = c }
export function getSelectedService(): string | null { return _selectedService }
export function setSelectedService(s: string): void { _selectedService = s }
