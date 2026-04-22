import type { ToolMetrics } from '../schema.js'

export function emptyToolMetrics(): ToolMetrics {
  return {
    sessions: 0,
    messages: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreateTokens: 0,
    byModel: {},
  }
}
