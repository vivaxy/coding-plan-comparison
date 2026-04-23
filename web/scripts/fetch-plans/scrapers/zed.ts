import type { Plan } from '../../../src/lib/schema.ts'
import { fetchHtml } from '../lib/fetch.ts'
import type { ScrapeResult, Scraper } from '../lib/types.ts'

export const provider = 'zed' as const

const URL = 'https://zed.dev/pricing'

// zed.dev/pricing renders as static HTML. Body contains "Personal $0 forever"
// and "Pro ... $10 per month". Zed is new to the catalog, so any data is a net win.
export function parse(html: string): ScrapeResult {
  const warnings: string[] = []
  const plans: Plan[] = []

  const body = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
  const hasPersonal = /Personal\s+\$0/i.test(body)
  const proMatch = body.match(/Pro[^$]*\$(\d+)\s*per\s*month/i)

  if (hasPersonal) {
    plans.push({
      id: 'zed-personal',
      provider,
      name: 'Zed Personal',
      monthlyPriceUsd: 0,
      models: [{ name: 'zed-agent', tier: 'fast' }],
      limits: [],
    })
  } else {
    warnings.push('Personal/Free tier not matched')
  }

  if (proMatch) {
    plans.push({
      id: 'zed-pro',
      provider,
      name: 'Zed Pro',
      monthlyPriceUsd: Number(proMatch[1]),
      models: [
        { name: 'claude-sonnet-4-6', tier: 'strong', payAsYouGoUsd: { input: 3, output: 15 } },
        { name: 'zed-agent',         tier: 'fast' },
      ],
      limits: [],
    })
  } else {
    warnings.push('Pro tier price not matched')
  }

  return { plans, warnings }
}

async function scrape(): Promise<ScrapeResult> {
  try {
    const html = await fetchHtml(URL)
    return parse(html)
  } catch (e) {
    return { plans: [], warnings: [`zed.dev/pricing fetch failed: ${(e as Error).message}`] }
  }
}

const scraper: Scraper = { provider, scrape }
export default scraper
