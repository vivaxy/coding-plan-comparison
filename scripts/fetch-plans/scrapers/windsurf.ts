import { fetchHtml } from '../lib/fetch.ts'
import type { ScrapeResult, Scraper } from '../lib/types.ts'

export const provider = 'windsurf' as const

// windsurf.com/pricing publishes tier names + prices ("Free $0/month",
// "Pro $20/month", "Max $200/month", "Teams $40/user/month") but does not
// publish the credits-monthly quota that's in the hand-curated catalog.
// Emitting plans without those limits would regress the comparison view.
// Verify the page is reachable, observe prices for humans, then preserve.
async function scrape(): Promise<ScrapeResult> {
  const warnings: string[] = []
  try {
    const html = await fetchHtml('https://windsurf.com/pricing')
    const body = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
    for (const tier of ['Free', 'Pro', 'Max', 'Teams'] as const) {
      const m = body.match(new RegExp(`${tier}\\s+\\$(\\d+)\\/(?:user\\/)?month`, 'i'))
      if (m) warnings.push(`observed: Windsurf ${tier} $${m[1]}/mo`)
    }
  } catch (e) {
    warnings.push(`windsurf.com/pricing fetch failed: ${(e as Error).message}`)
  }
  warnings.push('credits-monthly quotas not on pricing page; plans preserved from hand-curated catalog')
  return { plans: [], warnings }
}

const scraper: Scraper = { provider, scrape }
export default scraper
