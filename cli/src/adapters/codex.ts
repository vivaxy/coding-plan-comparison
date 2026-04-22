import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import type { Adapter, DateRange } from './types.js'
import type { ToolUsage, ToolMetrics } from '../schema.js'

const SESSIONS_DIR = path.join(os.homedir(), '.codex', 'sessions')
const SQLITE_PATH = path.join(os.homedir(), '.codex', 'logs_1.sqlite')

function dateToYYYYMMDD(d: Date): { yyyy: string; mm: string; dd: string } {
  const yyyy = String(d.getFullYear())
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return { yyyy, mm, dd }
}

// Returns true if the YYYY/MM/DD directory is within the date range.
function isDirInRange(yyyy: string, mm: string | null, dd: string | null, range: DateRange): boolean {
  const from = dateToYYYYMMDD(range.from)
  const to = dateToYYYYMMDD(range.to)

  if (mm === null) {
    // Only year level — include if year overlaps
    return yyyy >= from.yyyy && yyyy <= to.yyyy
  }
  if (dd === null) {
    // Year+month level
    const yymm = `${yyyy}${mm}`
    const fromYYMM = `${from.yyyy}${from.mm}`
    const toYYMM = `${to.yyyy}${to.mm}`
    return yymm >= fromYYMM && yymm <= toYYMM
  }
  // Full date
  const yyyymmdd = `${yyyy}${mm}${dd}`
  const fromYYYYMMDD = `${from.yyyy}${from.mm}${from.dd}`
  const toYYYYMMDD = `${to.yyyy}${to.mm}${to.dd}`
  return yyyymmdd >= fromYYYYMMDD && yyyymmdd <= toYYYYMMDD
}

interface SessionStats {
  sessions: number
  messages: number
  byModel: Record<string, { messages: number }>
}

async function scanSessions(range: DateRange): Promise<SessionStats> {
  const stats: SessionStats = { sessions: 0, messages: 0, byModel: {} }

  let yearEntries: string[]
  try {
    yearEntries = await fs.readdir(SESSIONS_DIR)
  } catch {
    return stats
  }

  for (const yyyy of yearEntries) {
    if (!/^\d{4}$/.test(yyyy)) continue
    if (!isDirInRange(yyyy, null, null, range)) continue

    const yearDir = path.join(SESSIONS_DIR, yyyy)
    let monthEntries: string[]
    try {
      monthEntries = await fs.readdir(yearDir)
    } catch {
      continue
    }

    for (const mm of monthEntries) {
      if (!/^\d{2}$/.test(mm)) continue
      if (!isDirInRange(yyyy, mm, null, range)) continue

      const monthDir = path.join(yearDir, mm)
      let dayEntries: string[]
      try {
        dayEntries = await fs.readdir(monthDir)
      } catch {
        continue
      }

      for (const dd of dayEntries) {
        if (!/^\d{2}$/.test(dd)) continue
        if (!isDirInRange(yyyy, mm, dd, range)) continue

        const dayDir = path.join(monthDir, dd)
        let files: string[]
        try {
          files = await fs.readdir(dayDir)
        } catch {
          continue
        }

        for (const file of files) {
          if (!file.endsWith('.jsonl')) continue
          const filePath = path.join(dayDir, file)
          await processJSONLFile(filePath, stats)
        }
      }
    }
  }

  return stats
}

async function processJSONLFile(filePath: string, stats: SessionStats): Promise<void> {
  let content: string
  try {
    content = await fs.readFile(filePath, 'utf-8')
  } catch {
    return
  }

  const lines = content.split('\n')
  let sessionModel = 'unknown'
  let sessionSeen = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    let event: { type: string; payload: Record<string, unknown> }
    try {
      event = JSON.parse(trimmed) as typeof event
    } catch {
      continue
    }

    if (event.type === 'session_meta') {
      const payload = event.payload
      if (!sessionSeen) {
        stats.sessions++
        sessionSeen = true
      }
      if (typeof payload['model_provider'] === 'string' && payload['model_provider']) {
        sessionModel = payload['model_provider']
      }
    } else if (event.type === 'event_msg') {
      const payload = event.payload as Record<string, unknown>
      if (payload['type'] === 'user_message') {
        stats.messages++
        const model = sessionModel
        if (!stats.byModel[model]) {
          stats.byModel[model] = { messages: 0 }
        }
        stats.byModel[model].messages++
      }
    }
  }
}

interface SqliteTokenResult {
  inputTokens: number
  outputTokens: number
}

async function probeSqliteTokens(_range: DateRange): Promise<SqliteTokenResult | null> {
  try {
    const Database = (await import('better-sqlite3')).default
    const db = new Database(SQLITE_PATH, { readonly: true, fileMustExist: true })

    try {
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all() as Array<{ name: string }>

      for (const { name: tableName } of tables) {
        const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
          name: string
        }>
        const colNames = columns.map((c) => c.name.toLowerCase())

        const hasInput = colNames.find((c) => c.includes('input_token') || c === 'tokens')
        const hasOutput = colNames.find((c) => c.includes('output_token'))

        if (hasInput) {
          let inputSum = 0
          let outputSum = 0

          const rows = db.prepare(`SELECT * FROM ${tableName} LIMIT 1000`).all() as Array<
            Record<string, unknown>
          >
          for (const row of rows) {
            for (const col of Object.keys(row)) {
              const lower = col.toLowerCase()
              if (lower.includes('input_token') || lower === 'tokens') {
                inputSum += Number(row[col]) || 0
              }
              if (lower.includes('output_token')) {
                outputSum += Number(row[col]) || 0
              }
            }
          }

          db.close()
          if (hasOutput) {
            return { inputTokens: inputSum, outputTokens: outputSum }
          }
          return { inputTokens: inputSum, outputTokens: 0 }
        }
      }

      db.close()
      return null
    } catch {
      try { db.close() } catch { /* ignore */ }
      return null
    }
  } catch {
    return null
  }
}

export class CodexAdapter implements Adapter {
  readonly name = 'codex'

  async detect(): Promise<boolean> {
    try {
      await fs.access(SESSIONS_DIR)
      return true
    } catch {
      return false
    }
  }

  async collect(range: DateRange): Promise<ToolUsage> {
    const sessionStats = await scanSessions(range)
    const sqliteResult = await probeSqliteTokens(range)

    const byModel: ToolMetrics['byModel'] = {}
    for (const [model, data] of Object.entries(sessionStats.byModel)) {
      byModel[model] = {
        messages: data.messages,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreateTokens: 0,
      }
    }

    // Ensure there's at least an 'unknown' bucket if we have sessions but no model breakdown
    if (sessionStats.sessions > 0 && Object.keys(byModel).length === 0) {
      byModel['unknown'] = {
        messages: sessionStats.messages,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreateTokens: 0,
      }
    }

    if (sqliteResult !== null && (sqliteResult.inputTokens > 0 || sqliteResult.outputTokens > 0)) {
      const metrics: ToolMetrics = {
        sessions: sessionStats.sessions,
        messages: sessionStats.messages,
        inputTokens: sqliteResult.inputTokens,
        outputTokens: sqliteResult.outputTokens,
        cacheReadTokens: 0,
        cacheCreateTokens: 0,
        byModel,
      }
      return { tool: 'codex', verdict: 'rich', metrics }
    }

    const metrics: ToolMetrics = {
      sessions: sessionStats.sessions,
      messages: sessionStats.messages,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreateTokens: 0,
      byModel,
    }
    return {
      tool: 'codex',
      verdict: 'partial',
      metrics,
      notes: ['Token data not available from sqlite; run with --verbose to debug'],
    }
  }
}

export default new CodexAdapter()
