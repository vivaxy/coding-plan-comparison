import type { Adapter, DateRange } from './types.js'
import type { ToolUsage, ModelMetrics } from '../schema.js'
import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { emptyToolMetrics } from './util.js'

const PROJECTS_DIR = join(homedir(), '.claude', 'projects')

export class ClaudeCodeAdapter implements Adapter {
  readonly name = 'claude-code'

  async detect(): Promise<boolean> {
    try {
      const s = await stat(PROJECTS_DIR)
      return s.isDirectory()
    } catch {
      return false
    }
  }

  async collect(range: DateRange): Promise<ToolUsage> {
    let slugDirs: string[]
    try {
      slugDirs = await readdir(PROJECTS_DIR)
    } catch {
      return { tool: 'claude-code', verdict: 'rich', metrics: emptyToolMetrics() }
    }

    const metrics = emptyToolMetrics()
    const seenSessions = new Set<string>()

    for (const slug of slugDirs) {
      const slugPath = join(PROJECTS_DIR, slug)
      let slugStat: Awaited<ReturnType<typeof stat>>
      try {
        slugStat = await stat(slugPath)
      } catch {
        continue
      }
      if (!slugStat.isDirectory()) continue

      let files: string[]
      try {
        files = await readdir(slugPath)
      } catch {
        continue
      }

      for (const file of files) {
        if (!file.endsWith('.jsonl')) continue
        const filePath = join(slugPath, file)

        const rl = createInterface({
          input: createReadStream(filePath),
          crlfDelay: Infinity,
        })

        for await (const line of rl) {
          if (!line.trim()) continue

          let record: unknown
          try {
            record = JSON.parse(line)
          } catch {
            continue
          }

          if (
            typeof record !== 'object' ||
            record === null ||
            (record as Record<string, unknown>)['type'] !== 'assistant'
          ) {
            continue
          }

          const r = record as Record<string, unknown>
          const message = r['message'] as Record<string, unknown> | undefined
          if (!message || typeof message !== 'object') continue

          const usage = message['usage'] as Record<string, unknown> | undefined
          if (!usage || typeof usage !== 'object') continue

          const timestamp = r['timestamp']
          if (typeof timestamp !== 'string') continue
          const ts = new Date(timestamp)
          if (isNaN(ts.getTime())) continue
          if (ts < range.from || ts > range.to) continue

          const sessionId = r['sessionId']
          if (typeof sessionId === 'string') {
            seenSessions.add(sessionId)
          }

          const inputTokens = (usage['input_tokens'] as number) || 0
          const outputTokens = (usage['output_tokens'] as number) || 0
          const cacheReadTokens = (usage['cache_read_input_tokens'] as number) || 0
          const cacheCreateTokens = (usage['cache_creation_input_tokens'] as number) || 0

          metrics.messages += 1
          metrics.inputTokens += inputTokens
          metrics.outputTokens += outputTokens
          metrics.cacheReadTokens += cacheReadTokens
          metrics.cacheCreateTokens += cacheCreateTokens

          const model = typeof message['model'] === 'string' ? message['model'] : 'unknown'
          if (!metrics.byModel[model]) {
            const modelMetrics: ModelMetrics = {
              messages: 0,
              inputTokens: 0,
              outputTokens: 0,
              cacheReadTokens: 0,
              cacheCreateTokens: 0,
            }
            metrics.byModel[model] = modelMetrics
          }
          const m = metrics.byModel[model]
          m.messages += 1
          m.inputTokens += inputTokens
          m.outputTokens += outputTokens
          m.cacheReadTokens += cacheReadTokens
          m.cacheCreateTokens += cacheCreateTokens
        }
      }
    }

    metrics.sessions = seenSessions.size

    const result: ToolUsage = {
      tool: 'claude-code',
      verdict: 'rich',
      metrics,
    }
    return result
  }
}

export default new ClaudeCodeAdapter()
