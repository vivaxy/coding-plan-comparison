import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { assertPlan } from './assert.ts'

const validPlan = {
  id: 'test-plan',
  provider: 'github',
  name: 'Test Plan',
  monthlyPriceUsd: 10,
  models: [
    { name: 'some-model', tier: 'strong', payAsYouGoUsd: { input: 3, output: 15 } },
  ],
  limits: [
    { kind: 'premium-requests-monthly', value: 300 },
  ],
}

describe('assertPlan', () => {
  it('passes for a valid plan', () => {
    assert.doesNotThrow(() => assertPlan(structuredClone(validPlan)))
  })

  it('passes for a plan with no limits or payAsYouGoUsd', () => {
    assert.doesNotThrow(() => assertPlan({
      id: 'zed-personal', provider: 'zed', name: 'Zed Personal',
      monthlyPriceUsd: 0, models: [{ name: 'zed-agent', tier: 'fast' }], limits: [],
    }))
  })

  it('throws for missing id', () => {
    assert.throws(() => assertPlan({ ...validPlan, id: '' }), /id must be a non-empty string/)
  })

  it('throws for unknown provider', () => {
    assert.throws(() => assertPlan({ ...validPlan, provider: 'cline' }), /provider "cline" not one of/)
  })

  it('throws for negative price', () => {
    assert.throws(() => assertPlan({ ...validPlan, monthlyPriceUsd: -1 }), /monthlyPriceUsd must be a non-negative number/)
  })

  it('throws for unknown model tier', () => {
    assert.throws(
      () => assertPlan({ ...validPlan, models: [{ name: 'x', tier: 'ultra' }] }),
      /models\[0\]\.tier "ultra" not one of/,
    )
  })

  it('throws for malformed payAsYouGoUsd', () => {
    assert.throws(
      () => assertPlan({ ...validPlan, models: [{ name: 'x', tier: 'fast', payAsYouGoUsd: { input: 'free', output: 0 } }] }),
      /payAsYouGoUsd must have numeric input and output/,
    )
  })

  it('throws for unknown limit kind', () => {
    assert.throws(
      () => assertPlan({ ...validPlan, limits: [{ kind: 'requests-per-day', value: 100 }] }),
      /limits\[0\]\.kind "requests-per-day" not one of/,
    )
  })

  it('throws for negative limit value', () => {
    assert.throws(
      () => assertPlan({ ...validPlan, limits: [{ kind: 'requests-monthly', value: -5 }] }),
      /limits\[0\]\.value must be a non-negative number/,
    )
  })

  it('throws for non-array appliesTo', () => {
    assert.throws(
      () => assertPlan({ ...validPlan, limits: [{ kind: 'requests-monthly', value: 10, appliesTo: 'model-x' }] }),
      /limits\[0\]\.appliesTo must be an array/,
    )
  })

  it('passes for all 8 valid providers', () => {
    const providers = ['anthropic', 'openai', 'cursor', 'windsurf', 'github', 'google', 'zed', 'amazon'] as const
    for (const provider of providers) {
      assert.doesNotThrow(() => assertPlan({ ...validPlan, provider }))
    }
  })
})
