import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parse } from './zed.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(HERE, '__fixtures__/zed.html')

describe('zed.parse', () => {
  let html: string
  before(async () => { html = await readFile(FIXTURE, 'utf8') })

  it('extracts at least one plan', () => {
    const { plans } = parse(html)
    assert.ok(plans.length >= 1)
  })

  it('all plans have provider "zed"', () => {
    const { plans } = parse(html)
    assert.ok(plans.every(p => p.provider === 'zed'))
  })

  it('includes a free Personal plan', () => {
    const { plans } = parse(html)
    const personal = plans.find(p => p.id === 'zed-personal')
    assert.ok(personal, 'zed-personal plan missing')
    assert.equal(personal.monthlyPriceUsd, 0)
  })

  it('includes a paid Pro plan', () => {
    const { plans } = parse(html)
    const pro = plans.find(p => p.id === 'zed-pro')
    assert.ok(pro, 'zed-pro plan missing')
    assert.ok(pro.monthlyPriceUsd > 0)
  })

  it('returns 0 plans for text with no pricing markers', () => {
    const { plans, warnings } = parse('<html><body>Nothing here</body></html>')
    assert.equal(plans.length, 0)
    assert.ok(warnings.length > 0)
  })
})
