import { fetchHtml } from '../lib/fetch.ts'
import type { ScrapeResult, Scraper } from '../lib/types.ts'

export const provider = 'anthropic' as const

// anthropic.com/pricing publishes tier prices ($17/$20/$100/$200) but not the
// per-5h message limits — those live in help-center articles with unstable
// URLs. Scraping would replace a complete hand-curated entry (with limits)
// with one that lacks limits, regressing the comparison view. Probe the page,
// record observations, and let the merge layer preserve the catalog.
async function scrape(): Promise<ScrapeResult> {
  const warnings: string[] = []
  try {
    const html = await fetchHtml('https://www.anthropic.com/pricing')
    if (!/\$20/.test(html) || !/\$100/.test(html)) {
      warnings.push('pricing page reached but $20/$100 markers missing — page structure changed?')
    }
  } catch (e) {
    warnings.push(`anthropic.com/pricing fetch failed: ${(e as Error).message}`)
  }
  warnings.push('per-5h message limits not on anthropic.com/pricing; plans preserved from hand-curated catalog')
  return { plans: [], warnings }
}

const scraper: Scraper = { provider, scrape }
export default scraper
