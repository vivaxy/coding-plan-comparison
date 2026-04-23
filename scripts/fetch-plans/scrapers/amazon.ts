import { load, type CheerioAPI } from 'cheerio'
import type { Plan } from '../../../web/src/lib/schema.ts'
import { fetchHtml } from '../lib/fetch.ts'
import type { ScrapeResult, Scraper } from '../lib/types.ts'

export const provider = 'amazon' as const

const URL = 'https://aws.amazon.com/q/developer/pricing/'

// aws.amazon.com/q/developer/pricing is server-rendered. The first <table>'s
// header row announces both tiers inline:
//   " | Free Tier: Advanced capabilities at zero cost | Pro Tier: Expanded limits $19/mo. per user"
export function parse(html: string): ScrapeResult {
  const warnings: string[] = []
  const plans: Plan[] = []

  const $: CheerioAPI = load(html)
  const firstTable = $('table').first()
  if (!firstTable.length) {
    warnings.push('no tables on AWS Q pricing page')
    return { plans, warnings }
  }
  const headerText = firstTable.find('tr').first().text().replace(/\s+/g, ' ')

  const hasFree = /Free\s*Tier/i.test(headerText)
  const proMatch = headerText.match(/Pro\s*Tier[^$]*\$(\d+)\s*\/\s*mo/i)

  if (hasFree) {
    plans.push({
      id: 'amazon-q-free',
      provider,
      name: 'Amazon Q Developer Free',
      monthlyPriceUsd: 0,
      models: [{ name: 'amazon-q-agent', tier: 'fast' }],
      limits: [],
    })
  } else {
    warnings.push('Free Tier row not matched')
  }

  if (proMatch) {
    plans.push({
      id: 'amazon-q-pro',
      provider,
      name: 'Amazon Q Developer Pro',
      monthlyPriceUsd: Number(proMatch[1]),
      models: [
        { name: 'claude-sonnet-4-6', tier: 'strong', payAsYouGoUsd: { input: 3, output: 15 } },
        { name: 'amazon-q-agent',    tier: 'fast' },
      ],
      limits: [],
    })
  } else {
    warnings.push('Pro Tier price not matched')
  }

  return { plans, warnings }
}

async function scrape(): Promise<ScrapeResult> {
  try {
    const html = await fetchHtml(URL)
    return parse(html)
  } catch (e) {
    return { plans: [], warnings: [`aws.amazon.com/q/developer/pricing fetch failed: ${(e as Error).message}`] }
  }
}

const scraper: Scraper = { provider, scrape }
export default scraper
