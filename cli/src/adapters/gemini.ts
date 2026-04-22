import type { Adapter, DateRange } from './types.js'
import type { ToolUsage } from '../schema.js'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'

const GEMINI_DIR = join(homedir(), '.gemini')

export class GeminiAdapter implements Adapter {
  readonly name = 'gemini'

  async detect(): Promise<boolean> {
    try {
      const s = await stat(GEMINI_DIR)
      return s.isDirectory()
    } catch {
      return false
    }
  }

  async collect(_range: DateRange): Promise<ToolUsage> {
    return {
      tool: 'gemini',
      verdict: 'manual',
      metrics: null,
      manualPrompts: [
        {
          field: 'gemini.monthlyRequestsUsed',
          label: 'API requests used this month',
          hint: 'Visit https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas'
        }
      ],
      notes: ['Gemini CLI stores config only. Fill in usage from the Google Cloud Console.']
    }
  }
}

export default new GeminiAdapter()
