import { fetchHtml } from '../lib/fetch.ts'
import type { ScrapeResult, Scraper } from '../lib/types.ts'

export const provider = 'openai' as const

// openai.com blocks Node fetch (403 on /chatgpt/pricing, /api/pricing, and
// help.openai.com — requires cookies/headless browser). Probe once, record
// the outcome, and return 0 plans so the merge layer preserves hand-curated entries.
async function scrape(): Promise<ScrapeResult> {
  const warnings: string[] = []
  try {
    await fetchHtml('https://openai.com/chatgpt/pricing/')
    warnings.push('openai.com/chatgpt/pricing now returns content — scraper can be written')
  } catch (e) {
    warnings.push(`openai.com blocks Node fetch (${(e as Error).message}); plans preserved from hand-curated catalog`)
  }
  return { plans: [], warnings }
}

const scraper: Scraper = { provider, scrape }
export default scraper
