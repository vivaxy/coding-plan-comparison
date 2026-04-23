import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parse } from './amazon.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(HERE, '__fixtures__/amazon.html')

describe('amazon.parse', () => {
  let html: string
  before(async () => { html = await readFile(FIXTURE, 'utf8') })

  it('extracts 2 plans', () => {
    const { plans } = parse(html)
    assert.equal(plans.length, 2)
  })

  it('all plans have provider "amazon"', () => {
    const { plans } = parse(html)
    assert.ok(plans.every(p => p.provider === 'amazon'))
  })

  it('includes a free plan', () => {
    const { plans } = parse(html)
    const free = plans.find(p => p.id === 'amazon-q-free')
    assert.ok(free, 'amazon-q-free plan missing')
    assert.equal(free.monthlyPriceUsd, 0)
  })

  it('includes a Pro plan at $19', () => {
    const { plans } = parse(html)
    const pro = plans.find(p => p.id === 'amazon-q-pro')
    assert.ok(pro, 'amazon-q-pro plan missing')
    assert.equal(pro.monthlyPriceUsd, 19)
  })

  it('returns 0 plans and warnings for empty HTML', () => {
    const { plans, warnings } = parse('<html><body></body></html>')
    assert.equal(plans.length, 0)
    assert.ok(warnings.length > 0)
  })

  it('returns warnings for HTML with no matching table', () => {
    const { plans, warnings } = parse('<html><body><p>No pricing here</p></body></html>')
    assert.equal(plans.length, 0)
    assert.ok(warnings.some(w => /Free Tier|table/i.test(w)))
  })
})
