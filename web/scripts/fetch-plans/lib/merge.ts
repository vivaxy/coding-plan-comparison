import type { Plan } from '../../../src/lib/schema.ts'
import { PROVIDERS } from './assert.ts'

// For each provider in PROVIDERS: if scraped has ≥1 plan, take scraped; else keep existing.
// Returns the merged array sorted by provider (in PROVIDERS order) then by monthlyPriceUsd.
export function mergePlans(scraped: Plan[], existing: Plan[]): Plan[] {
  const scrapedByProvider = groupBy(scraped, p => p.provider)
  const existingByProvider = groupBy(existing, p => p.provider)

  const merged: Plan[] = []
  for (const provider of PROVIDERS) {
    const s = scrapedByProvider.get(provider) ?? []
    const e = existingByProvider.get(provider) ?? []
    const chosen = s.length > 0 ? s : e
    merged.push(...chosen)
  }

  const providerRank = new Map(PROVIDERS.map((p, i) => [p, i]))
  merged.sort((a, b) => {
    const pa = providerRank.get(a.provider) ?? 999
    const pb = providerRank.get(b.provider) ?? 999
    if (pa !== pb) return pa - pb
    return a.monthlyPriceUsd - b.monthlyPriceUsd
  })
  return merged
}

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>()
  for (const item of items) {
    const k = key(item)
    const arr = out.get(k)
    if (arr) arr.push(item)
    else out.set(k, [item])
  }
  return out
}
