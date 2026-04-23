import { fetchHtml } from '../lib/fetch.ts'
import type { ScrapeResult, Scraper } from '../lib/types.ts'

export const provider = 'cursor' as const

// docs.cursor.com and cursor.com/pricing are both Next.js apps — the response
// contains a JS manifest rather than rendered pricing tables. Hand-written
// scraping without a headless browser can't reach the data.
async function scrape(): Promise<ScrapeResult> {
  const warnings: string[] = []
  try {
    const html = await fetchHtml('https://docs.cursor.com/account/plans-and-usage')
    if (!html.includes('Hobby') && !html.includes('Ultra')) {
      warnings.push('docs.cursor.com reached but Hobby/Ultra markers missing')
    }
  } catch (e) {
    warnings.push(`docs.cursor.com fetch failed: ${(e as Error).message}`)
  }
  warnings.push('cursor.com is JS-rendered; plans preserved from hand-curated catalog')
  return { plans: [], warnings }
}

const scraper: Scraper = { provider, scrape }
export default scraper
