import type { UsageProfile } from './schema.js'
import type { Adapter, DateRange } from './adapters/types.js'
import { aggregate } from './aggregate.js'
import { output } from './output.js'
import claudeCode from './adapters/claudeCode.js'
import codex from './adapters/codex.js'
import cursor from './adapters/cursor.js'
import windsurf from './adapters/windsurf.js'
import copilot from './adapters/copilot.js'
import gemini from './adapters/gemini.js'

const ALL_ADAPTERS: Adapter[] = [claudeCode, codex, cursor, windsurf, copilot, gemini]

function parseDate(s: string, label: string, endOfDay = false): Date {
  const d = new Date(endOfDay ? `${s}T23:59:59.999` : s)
  if (isNaN(d.getTime())) {
    console.error(`Invalid date for ${label}: "${s}". Expected YYYY-MM-DD.`)
    process.exit(1)
  }
  return d
}

function printUsage(): void {
  console.log(`
Usage: coding-plan-comparison [options]

Options:
  --json              Print JSON only (suppress summary table)
  --copy              Copy JSON to macOS clipboard via pbcopy
  --since YYYY-MM-DD  Start of date range (default: 30 days ago)
  --until YYYY-MM-DD  End of date range (default: today)
  --tools a,b,c       Comma-separated tool names to run (default: all)
  --help              Print this usage and exit
`.trim())
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  let jsonOnly = false
  let copy = false
  let sinceArg: string | undefined
  let untilArg: string | undefined
  let toolsArg: string | undefined

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--help') {
      printUsage()
      process.exit(0)
    } else if (arg === '--json') {
      jsonOnly = true
    } else if (arg === '--copy') {
      copy = true
    } else if (arg === '--since') {
      sinceArg = args[++i]
    } else if (arg === '--until') {
      untilArg = args[++i]
    } else if (arg === '--tools') {
      toolsArg = args[++i]
    } else {
      console.error(`Unknown argument: ${arg}`)
      printUsage()
      process.exit(1)
    }
  }

  const today = new Date()
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(today.getDate() - 30)

  const range: DateRange = {
    from: sinceArg ? parseDate(sinceArg, '--since') : thirtyDaysAgo,
    to: untilArg ? parseDate(untilArg, '--until', true) : today,
  }

  const toolFilter = toolsArg ? toolsArg.split(',').map((t) => t.trim()) : null

  let adapters: Adapter[] = ALL_ADAPTERS
  if (toolFilter !== null) {
    adapters = adapters.filter((a) => toolFilter.includes(a.name))
  }

  const results = []
  for (const adapter of adapters) {
    const detected = await adapter.detect()
    if (!detected) continue
    const usage = await adapter.collect(range)
    results.push(usage)
  }

  const profile: UsageProfile = aggregate(results, range)

  await output(profile, jsonOnly, copy)

  process.exit(0)
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
