# fetch-plans

Refreshes `web/src/data/plans.json` by scraping vendor pricing pages.

## Requirements

- Node.js 22+
- npm

## Usage

```sh
cd web
npm install
npm run fetch-plans             # dry-run: print summary + diff
npm run fetch-plans -- --write  # overwrite src/data/plans.json
```

Running without `--write` is always safe — it prints the per-vendor summary and a diff against the current file, but writes nothing.

## Testing

```sh
cd web
npm run fetch-plans:test      # runs all unit tests via node:test
npm run fetch-plans:typecheck # TypeScript type-check only
```

Tests use saved fixture HTML from `scrapers/__fixtures__/`. They never hit the network.

## Architecture

```
scripts/fetch-plans/
  fetch-plans.ts          # entry point: orchestrates scrapers, merges, diffs, writes
  tsconfig.json           # extends web/tsconfig.json with NodeNext + Node type overrides
  lib/
    fetch.ts              # fetchHtml(url): browser UA, 10s timeout, one retry on 5xx/network error
    assert.ts             # assertPlan(plan): runtime Plan validator; throws on invalid field
    merge.ts              # mergePlans(scraped, existing): per-provider replace-or-preserve
    types.ts              # shared interfaces: ScrapeResult, Scraper
  scrapers/
    <vendor>.ts           # one file per vendor; exports { provider, parse(html), scrape() }
    __fixtures__/
      <vendor>.html       # snapshot HTML used by tests
```

### Scraper interface

Each scraper file exports:

- `provider` — a `Plan['provider']` literal constant.
- `parse(html: string): ScrapeResult` — pure function: takes HTML, returns `{ plans, warnings }`. Used by unit tests with fixture HTML. Does **not** call the network.
- `default` — a `Scraper` object `{ provider, scrape() }`. `scrape()` fetches the URL then calls `parse()`.

### Merge semantics

`mergePlans` iterates over every provider in `PROVIDERS` order. If the scraped array contains **at least one** plan for that provider, the entire existing set for that provider is replaced. Otherwise the existing entries are kept. This means:

- The script is always safe to re-run — worst case it's a no-op for a failing vendor.
- New providers (Zed, Amazon) are absent from `plans.json` if the scraper returns zero — acceptable as an initial state.

### Validation

`assertPlan` runs on every scraped plan before it enters the merge step. An invalid plan (wrong field types, unknown `provider`, unknown `tier`, etc.) is **dropped** with a console warning rather than written to disk. The design ensures that a newly-added scraper bug can't corrupt the catalog.

## What this does and doesn't scrape

| Vendor | Scraped? | Reason |
|--------|----------|--------|
| GitHub Copilot | ✅ | `docs.github.com` is server-rendered; 5 plans + premium-requests limits extracted from the overview table. |
| Zed AI | ✅ | `zed.dev/pricing` ships pricing inline as static HTML. |
| Amazon Q Developer | ✅ | `aws.amazon.com/q/developer/pricing/` is server-rendered. |
| Anthropic | ❌ | Pricing page lists tier prices but not per-5h message limits. Hand-curated catalog preserved. |
| OpenAI | ❌ | `openai.com` blocks Node fetch (HTTP 403). Needs a headless browser or different approach. |
| Cursor | ❌ | `cursor.com` and `docs.cursor.com` are JS-rendered (Next.js); response body is a JS manifest, not prices. |
| Windsurf | ❌ | `windsurf.com/pricing` is static but does not publish the credits-monthly quota in the catalog — emitting plans without those limits would regress the comparison. |
| Google Gemini Code Assist | ❌ | Google publishes Gemini Code Assist pricing per-hour, not per-month. Doesn't map onto the monthly-fixed schema. |

"Preserve" scrapers still probe their URL on every run and report observed prices as warnings — useful for noticing when a vendor changes pricing without breaking the catalog.

## Out of scope

BYOK (bring-your-own-key) tools — Aider, Cline, Continue — are not in the catalog. They have no `monthlyPriceUsd` or included limits; forcing them into the `Plan` schema would make them appear as zero-cost options in the Recommend view, which is misleading.

## How to add a new scraper

1. **Add the provider token** to `Plan['provider']` in `src/lib/schema.ts`. Run `npm run fetch-plans:typecheck` to verify.

2. **Add to `lib/assert.ts`**: add the new token to the `PROVIDERS` array.

3. **Create `scrapers/<vendor>.ts`** following this skeleton:

   ```ts
   import type { Plan } from '../../../src/lib/schema.ts'
   import { fetchHtml } from '../lib/fetch.ts'
   import type { ScrapeResult, Scraper } from '../lib/types.ts'

   export const provider = '<vendor>' as const

   export function parse(html: string): ScrapeResult {
     const warnings: string[] = []
     const plans: Plan[] = []
     // ... extract plans from html ...
     return { plans, warnings }
   }

   async function scrape(): Promise<ScrapeResult> {
     try {
       const html = await fetchHtml('https://vendor.com/pricing')
       return parse(html)
     } catch (e) {
       return { plans: [], warnings: [`fetch failed: ${(e as Error).message}`] }
     }
   }

   const scraper: Scraper = { provider, scrape }
   export default scraper
   ```

4. **Save a fixture** and write unit tests in `scrapers/<vendor>.test.ts`. Inspect the real HTML first:

   ```sh
   # From web/
   npx tsx -e "
     import { fetchHtml } from './scripts/fetch-plans/lib/fetch.ts'
     import { writeFile } from 'node:fs/promises'
     const html = await fetchHtml('https://vendor.com/pricing')
     await writeFile('scripts/fetch-plans/scrapers/__fixtures__/<vendor>.html', html)
     console.log(html.length, 'bytes')
   "
   ```

5. **Register the scraper** in `fetch-plans.ts`: import it and add to `SCRAPERS`.

6. **Update this README** — add a row to the table above.

## Troubleshooting

**A scraper that used to produce data now returns zero.**
Vendor HTML changed. Run `npm run fetch-plans` to see the warning. Refresh the fixture and re-inspect the HTML structure:

```sh
# From web/
npx tsx -e "
  import { fetchHtml } from './scripts/fetch-plans/lib/fetch.ts'
  import { writeFile } from 'node:fs/promises'
  const html = await fetchHtml('<URL>')
  await writeFile('scripts/fetch-plans/scrapers/__fixtures__/<vendor>.html', html)
  console.log(html.length, 'bytes')
"
```

Then update the selector/regex in `scrapers/<vendor>.ts` and run `npm run fetch-plans:test` to confirm the fix.

**The typecheck fails after adding a new provider.**
Make sure you added the token to both `src/lib/schema.ts` **and** `lib/assert.ts`'s `PROVIDERS` array. The two must stay in sync manually — there is no automated coupling.
