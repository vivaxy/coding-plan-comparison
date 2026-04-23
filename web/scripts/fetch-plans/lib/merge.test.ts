import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Plan } from '../../../src/lib/schema.ts'
import { mergePlans } from './merge.ts'

function plan(overrides: Partial<Plan> & Pick<Plan, 'id' | 'provider' | 'monthlyPriceUsd'>): Plan {
  return { name: 'Test', models: [], limits: [], ...overrides }
}

describe('mergePlans', () => {
  it('uses scraped plans when available for a provider', () => {
    const scraped: Plan[] = [plan({ id: 'github-new', provider: 'github', monthlyPriceUsd: 10 })]
    const existing: Plan[] = [plan({ id: 'github-old', provider: 'github', monthlyPriceUsd: 0 })]
    const merged = mergePlans(scraped, existing)
    assert.equal(merged.length, 1)
    assert.equal(merged[0].id, 'github-new')
  })

  it('preserves existing plans when scraper returns zero for that provider', () => {
    const scraped: Plan[] = []
    const existing: Plan[] = [plan({ id: 'anthropic-pro', provider: 'anthropic', monthlyPriceUsd: 20 })]
    const merged = mergePlans(scraped, existing)
    assert.equal(merged.length, 1)
    assert.equal(merged[0].id, 'anthropic-pro')
  })

  it('adds new providers not in existing', () => {
    const scraped: Plan[] = [plan({ id: 'zed-pro', provider: 'zed', monthlyPriceUsd: 10 })]
    const existing: Plan[] = []
    const merged = mergePlans(scraped, existing)
    assert.equal(merged.length, 1)
    assert.equal(merged[0].id, 'zed-pro')
  })

  it('sorts by provider order then by price ascending', () => {
    const scraped: Plan[] = [
      plan({ id: 'github-pro', provider: 'github', monthlyPriceUsd: 10 }),
      plan({ id: 'github-free', provider: 'github', monthlyPriceUsd: 0 }),
    ]
    const existing: Plan[] = [
      plan({ id: 'anthropic-max', provider: 'anthropic', monthlyPriceUsd: 100 }),
      plan({ id: 'anthropic-pro', provider: 'anthropic', monthlyPriceUsd: 20 }),
    ]
    const merged = mergePlans(scraped, existing)
    assert.deepEqual(merged.map(p => p.id), ['anthropic-pro', 'anthropic-max', 'github-free', 'github-pro'])
  })

  it('replaces all existing plans for a provider when scraper emits any', () => {
    const scraped: Plan[] = [plan({ id: 'github-new', provider: 'github', monthlyPriceUsd: 15 })]
    const existing: Plan[] = [
      plan({ id: 'github-a', provider: 'github', monthlyPriceUsd: 0 }),
      plan({ id: 'github-b', provider: 'github', monthlyPriceUsd: 10 }),
    ]
    const merged = mergePlans(scraped, existing)
    const githubPlans = merged.filter(p => p.provider === 'github')
    assert.equal(githubPlans.length, 1)
    assert.equal(githubPlans[0].id, 'github-new')
  })

  it('handles empty scraped and empty existing', () => {
    assert.deepEqual(mergePlans([], []), [])
  })
})
