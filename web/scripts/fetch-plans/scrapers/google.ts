import { fetchHtml } from '../lib/fetch.ts'
import type { ScrapeResult, Scraper } from '../lib/types.ts'

export const provider = 'google' as const

// cloud.google.com/products/gemini/pricing publishes Gemini Code Assist
// Standard/Enterprise as hourly commitments ($0.031/hour ≈ $22.80/month), not
// the flat $19/$45 monthly rates in the hand-curated catalog. It also omits
// the free Individual tier. Hourly pricing doesn't map onto the monthly-fixed
// schema the webapp uses, so we preserve the existing catalog.
async function scrape(): Promise<ScrapeResult> {
  const warnings: string[] = []
  try {
    const html = await fetchHtml('https://cloud.google.com/products/gemini/pricing')
    if (!html.includes('Code Assist')) {
      warnings.push('pricing page reached but "Code Assist" marker missing')
    }
  } catch (e) {
    warnings.push(`cloud.google.com pricing fetch failed: ${(e as Error).message}`)
  }
  warnings.push('Gemini Code Assist is priced per-hour on vendor page; monthly plans preserved from hand-curated catalog')
  return { plans: [], warnings }
}

const scraper: Scraper = { provider, scrape }
export default scraper
