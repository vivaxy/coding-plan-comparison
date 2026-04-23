import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import type { Plan } from '../../web/src/lib/schema.ts'
import type { Scraper } from './lib/types.ts'
import { assertPlan } from './lib/assert.ts'
import { mergePlans } from './lib/merge.ts'
import anthropic from './scrapers/anthropic.ts'
import openai    from './scrapers/openai.ts'
import cursor    from './scrapers/cursor.ts'
import windsurf  from './scrapers/windsurf.ts'
import github    from './scrapers/github.ts'
import google    from './scrapers/google.ts'
import zed       from './scrapers/zed.ts'
import amazon    from './scrapers/amazon.ts'

const SCRAPERS: Scraper[] = [anthropic, openai, cursor, windsurf, github, google, zed, amazon]

const HERE = dirname(fileURLToPath(import.meta.url))
const PLANS_JSON = resolve(HERE, '../../web/src/data/plans.json')

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2))
  const write = args.has('--write')

  const existing: Plan[] = JSON.parse(await readFile(PLANS_JSON, 'utf8'))

  const results = await Promise.allSettled(
    SCRAPERS.map(async s => ({ provider: s.provider, outcome: await s.scrape() })),
  )

  const scraped: Plan[] = []
  console.log('Per-vendor results:')
  console.log('─────────────────────────────────────────')
  for (const [i, r] of results.entries()) {
    const provider = SCRAPERS[i].provider
    if (r.status === 'rejected') {
      console.log(`  ${provider.padEnd(10)} — THREW: ${(r.reason as Error)?.message ?? r.reason}`)
      continue
    }
    const { plans, warnings } = r.value.outcome
    for (const p of plans) {
      try {
        assertPlan(p)
        scraped.push(p)
      } catch (e) {
        console.log(`  ${provider.padEnd(10)} — INVALID plan dropped: ${(e as Error).message}`)
      }
    }
    console.log(`  ${provider.padEnd(10)} — ${String(plans.length).padStart(2)} plan(s), ${warnings.length} warning(s)`)
    for (const w of warnings) console.log(`    • ${w}`)
  }

  const merged = mergePlans(scraped, existing)
  const nextJson = JSON.stringify(merged, null, 2) + '\n'
  const currentJson = await readFile(PLANS_JSON, 'utf8')

  console.log('')
  console.log('Catalog summary:')
  console.log('─────────────────────────────────────────')
  console.log(`  existing: ${existing.length} plans`)
  console.log(`  merged:   ${merged.length} plans (${scraped.length} scraped, ${merged.length - scraped.length} preserved)`)
  console.log('')

  if (nextJson === currentJson) {
    console.log('No changes vs current plans.json.')
    return
  }

  console.log('Diff vs current plans.json:')
  console.log('─────────────────────────────────────────')
  printIdDiff(existing, merged)

  if (write) {
    await writeFile(PLANS_JSON, nextJson)
    console.log(`\nWROTE ${PLANS_JSON}`)
  } else {
    console.log('\nDry run — pass --write to overwrite plans.json.')
  }
}

function printIdDiff(before: Plan[], after: Plan[]): void {
  const beforeById = new Map(before.map(p => [p.id, p]))
  const afterById = new Map(after.map(p => [p.id, p]))
  const added   = [...afterById.keys()].filter(id => !beforeById.has(id))
  const removed = [...beforeById.keys()].filter(id => !afterById.has(id))
  const changed = [...afterById.keys()].filter(id => {
    const b = beforeById.get(id)
    if (!b) return false
    return JSON.stringify(b) !== JSON.stringify(afterById.get(id))
  })
  for (const id of added)   console.log(`  + ${id}`)
  for (const id of removed) console.log(`  - ${id}`)
  for (const id of changed) {
    const b = beforeById.get(id)!
    const a = afterById.get(id)!
    const bits: string[] = []
    if (b.monthlyPriceUsd !== a.monthlyPriceUsd) bits.push(`$${b.monthlyPriceUsd} → $${a.monthlyPriceUsd}`)
    if (b.models.length !== a.models.length)     bits.push(`${b.models.length} → ${a.models.length} models`)
    if (b.limits.length !== a.limits.length)     bits.push(`${b.limits.length} → ${a.limits.length} limits`)
    if (!bits.length)                             bits.push('field-level changes')
    console.log(`  ~ ${id} (${bits.join(', ')})`)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
