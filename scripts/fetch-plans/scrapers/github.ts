import { load, type CheerioAPI } from 'cheerio'
import type { Plan, PlanModel, Tier } from '../../../web/src/lib/schema.ts'
import { fetchHtml } from '../lib/fetch.ts'
import type { ScrapeResult, Scraper } from '../lib/types.ts'

export const provider = 'github' as const

const URL = 'https://docs.github.com/en/copilot/about-github-copilot/plans-for-github-copilot'

interface ModelMapEntry {
  match: RegExp
  name: string
  tier: Tier
  payg?: { input: number; output: number }
}

const MODEL_MAP: ModelMapEntry[] = [
  { match: /Claude Opus 4\.6/i,   name: 'claude-opus-4-6',   tier: 'frontier', payg: { input: 5,   output: 25 } },
  { match: /Claude Sonnet 4\.6/i, name: 'claude-sonnet-4-6', tier: 'strong',   payg: { input: 3,   output: 15 } },
  { match: /Claude Haiku 4\.5/i,  name: 'claude-haiku-4-5',  tier: 'fast',     payg: { input: 1,   output: 5  } },
  { match: /Gemini 2\.5 Pro/i,    name: 'gemini-2-5-pro',    tier: 'strong' },
  { match: /GPT-4o/i,             name: 'gpt-4o',            tier: 'strong',   payg: { input: 2.5, output: 10 } },
]

interface PlanColumn {
  id: string
  header: string
  monthlyPriceUsd: number
}

const PLAN_COLUMNS: PlanColumn[] = [
  { id: 'github-copilot-free',       header: 'Copilot Free',       monthlyPriceUsd: 0 },
  { id: 'github-copilot-pro',        header: 'Copilot Pro',        monthlyPriceUsd: 10 },
  { id: 'github-copilot-pro-plus',   header: 'Copilot Pro+',       monthlyPriceUsd: 39 },
  { id: 'github-copilot-business',   header: 'Copilot Business',   monthlyPriceUsd: 19 },
  { id: 'github-copilot-enterprise', header: 'Copilot Enterprise', monthlyPriceUsd: 39 },
]

export function parse(html: string): ScrapeResult {
  const warnings: string[] = []
  const plans: Plan[] = []

  const $: CheerioAPI = load(html)
  const overviewTable = $('table').first()
  if (!overviewTable.length) {
    warnings.push('no tables found on GitHub Copilot docs page')
    return { plans, warnings }
  }

  const headers = overviewTable.find('thead th, tr:first-child th').map((_, th) => $(th).text().trim()).get()
  const rows = overviewTable.find('tbody tr').toArray()

  const priceRow = rows.find(r => /pricing/i.test($(r).find('th, td').first().text()))
  const premiumRow = rows.find(r => /premium requests?/i.test($(r).find('th, td').first().text()))

  if (!priceRow || !premiumRow) {
    warnings.push('could not find Pricing / Premium requests rows')
    return { plans, warnings }
  }

  const priceCells = $(priceRow).find('td').map((_, td) => $(td).text().trim()).get()
  const premiumCells = $(premiumRow).find('td').map((_, td) => $(td).text().trim()).get()

  const modelTable = $('table').toArray().find(t => {
    const th0 = $(t).find('thead th, tr:first-child th').first().text().trim()
    return /available models/i.test(th0)
  })
  const modelRows = modelTable
    ? $(modelTable).find('tbody tr').toArray().map(r => $(r).find('th, td').first().text().trim())
    : []

  const models = extractModels(modelRows)

  for (const col of PLAN_COLUMNS) {
    const idx = headers.findIndex(h => h.trim() === col.header)
    if (idx < 1) {
      warnings.push(`column "${col.header}" missing from header row`)
      continue
    }
    const priceText = priceCells[idx - 1] ?? ''
    if (col.monthlyPriceUsd > 0) {
      const m = priceText.match(/\$(\d+(?:\.\d+)?)/)
      if (!m) {
        warnings.push(`${col.id}: no $ price in "${priceText}"`)
      } else if (Number(m[1]) !== col.monthlyPriceUsd) {
        warnings.push(`${col.id}: docs reports $${m[1]}, expected $${col.monthlyPriceUsd}`)
      }
    }

    const limits: Plan['limits'] = []
    const premiumText = premiumCells[idx - 1] ?? ''
    const premiumMatch = premiumText.match(/([\d,]+)/)
    if (premiumMatch) {
      const value = Number(premiumMatch[1].replace(/,/g, ''))
      if (value > 0) limits.push({ kind: 'premium-requests-monthly', value })
    }

    plans.push({
      id: col.id,
      provider,
      name: col.header,
      monthlyPriceUsd: col.monthlyPriceUsd,
      models,
      limits,
    })
  }

  return { plans, warnings }
}

function extractModels(modelRows: string[]): PlanModel[] {
  const models: PlanModel[] = []
  const seen = new Set<string>()
  for (const row of modelRows) {
    for (const entry of MODEL_MAP) {
      if (seen.has(entry.name)) continue
      if (entry.match.test(row)) {
        const m: PlanModel = { name: entry.name, tier: entry.tier }
        if (entry.payg) m.payAsYouGoUsd = entry.payg
        models.push(m)
        seen.add(entry.name)
      }
    }
  }
  return models
}

async function scrape(): Promise<ScrapeResult> {
  try {
    const html = await fetchHtml(URL)
    return parse(html)
  } catch (e) {
    const msg = (e as Error).message
    return { plans: [], warnings: [`fetch failed: ${msg}`] }
  }
}

const scraper: Scraper = { provider, scrape }
export default scraper
