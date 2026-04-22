import type { UsageProfile, ToolUsage } from './schema.js'

export function aggregate(tools: ToolUsage[], range: { from: Date; to: Date }): UsageProfile {
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    range: {
      from: range.from.toISOString().slice(0, 10),
      to: range.to.toISOString().slice(0, 10),
    },
    tools,
  }
}
