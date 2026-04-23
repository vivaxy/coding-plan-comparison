import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parse } from './github.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(HERE, '__fixtures__/github.html')

describe('github.parse', () => {
  let html: string
  before(async () => { html = await readFile(FIXTURE, 'utf8') })

  it('extracts 5 plans', () => {
    const { plans } = parse(html)
    assert.equal(plans.length, 5)
  })

  it('all plans have provider "github"', () => {
    const { plans } = parse(html)
    assert.ok(plans.every(p => p.provider === 'github'))
  })

  it('includes Copilot Free at $0 with a premium-requests-monthly limit', () => {
    const { plans } = parse(html)
    const free = plans.find(p => p.id === 'github-copilot-free')
    assert.ok(free, 'Copilot Free plan missing')
    assert.equal(free.monthlyPriceUsd, 0)
    assert.ok(free.limits.some(l => l.kind === 'premium-requests-monthly'))
  })

  it('includes Copilot Pro+ at $39 with 1500 premium requests', () => {
    const { plans } = parse(html)
    const proPlusArr = plans.filter(p => p.id === 'github-copilot-pro-plus')
    assert.equal(proPlusArr.length, 1)
    const proPlus = proPlusArr[0]
    assert.equal(proPlus.monthlyPriceUsd, 39)
    const limit = proPlus.limits.find(l => l.kind === 'premium-requests-monthly')
    assert.ok(limit, 'premium-requests-monthly limit missing from Pro+')
    assert.equal(limit.value, 1500)
  })

  it('includes at least one Claude model per plan', () => {
    const { plans } = parse(html)
    for (const plan of plans) {
      assert.ok(
        plan.models.some(m => m.name.startsWith('claude-')),
        `${plan.id} has no Claude model`,
      )
    }
  })

  it('emits no warnings for valid fixture', () => {
    const { warnings } = parse(html)
    assert.deepEqual(warnings, [])
  })

  it('returns 0 plans and a warning for empty HTML', () => {
    const { plans, warnings } = parse('')
    assert.equal(plans.length, 0)
    assert.ok(warnings.length > 0)
  })
})
