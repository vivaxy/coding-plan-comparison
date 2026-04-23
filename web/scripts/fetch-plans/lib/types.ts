import type { Plan } from '../../../src/lib/schema.ts'

export interface ScrapeResult {
  plans: Plan[]
  warnings: string[]
}

export interface Scraper {
  readonly provider: Plan['provider']
  scrape(): Promise<ScrapeResult>
}
