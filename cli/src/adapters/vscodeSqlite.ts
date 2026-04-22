import type { Adapter, DateRange } from './types.js'
import type { ToolUsage, ManualPrompt, Tool } from '../schema.js'
import { stat } from 'node:fs/promises'
import { emptyToolMetrics } from './util.js'

const CHAT_KEY_PATTERNS = ['chat', 'conversation', 'aichat']

function countFromParsed(parsed: unknown): { sessions: number; messages: number } {
  if (Array.isArray(parsed)) {
    return { sessions: parsed.length, messages: parsed.length }
  }
  if (typeof parsed === 'object' && parsed !== null) {
    const obj = parsed as Record<string, unknown>

    for (const key of ['tabs', 'conversations', 'chats', 'messages', 'history']) {
      const val = obj[key]
      if (Array.isArray(val)) {
        let messageCount = 0
        for (const entry of val) {
          if (typeof entry === 'object' && entry !== null) {
            const e = entry as Record<string, unknown>
            for (const msgKey of ['messages', 'bubbles', 'turns']) {
              if (Array.isArray(e[msgKey])) {
                messageCount += (e[msgKey] as unknown[]).length
              }
            }
          }
        }
        return {
          sessions: val.length,
          messages: messageCount > 0 ? messageCount : val.length,
        }
      }
    }

    const keys = Object.keys(obj)
    return { sessions: keys.length, messages: keys.length }
  }
  return { sessions: 0, messages: 0 }
}

interface VscodeSqliteAdapterOptions {
  name: string
  tool: Tool
  dbPath: string
  manualPrompts: ManualPrompt[]
}

export function makeVscodeSqliteAdapter(opts: VscodeSqliteAdapterOptions): Adapter {
  return {
    name: opts.name,

    async detect(): Promise<boolean> {
      try {
        const s = await stat(opts.dbPath)
        return s.isFile()
      } catch {
        return false
      }
    },

    async collect(_range: DateRange): Promise<ToolUsage> {
      const metrics = emptyToolMetrics()

      try {
        const Database = (await import('better-sqlite3')).default
        const db = new Database(opts.dbPath, { readonly: true, fileMustExist: true })

        try {
          const rows = db
            .prepare('SELECT key, value FROM ItemTable')
            .all() as Array<{ key: string; value: string | Buffer }>

          const seenConversationIds = new Set<string>()

          for (const row of rows) {
            const keyLower = row.key.toLowerCase()
            if (!CHAT_KEY_PATTERNS.some((p) => keyLower.includes(p))) continue

            let parsed: unknown
            try {
              const raw = typeof row.value === 'string' ? row.value : row.value.toString('utf8')
              parsed = JSON.parse(raw)
            } catch {
              continue
            }

            metrics.messages += countFromParsed(parsed).messages
            seenConversationIds.add(row.key)
          }

          metrics.sessions = seenConversationIds.size
        } finally {
          db.close()
        }
      } catch {
        // SQLite failure — zero counts remain; manualPrompts carry the data
      }

      return {
        tool: opts.tool,
        verdict: 'minimal',
        metrics,
        manualPrompts: opts.manualPrompts,
      }
    },
  }
}
