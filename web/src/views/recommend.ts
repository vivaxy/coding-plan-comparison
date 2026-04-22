import { rankPlans } from '../lib/score.js'
import type { ToolMetrics, UsageProfile, Plan, Tier } from '../lib/schema.js'
import plans from '../data/plans.json'

function makeEmptyMetrics(messages: number): ToolMetrics {
  return { sessions: 0, messages, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreateTokens: 0, byModel: {} }
}

export function renderRecommend(app: HTMLElement): void {
  const stored = localStorage.getItem('usageProfile')
  if (!stored) {
    app.innerHTML = '<h2>Recommended Plans</h2><p>No usage profile loaded. Go to <a href="#/import">Import</a> first.</p>'
    return
  }

  const profile = JSON.parse(stored) as UsageProfile

  const allMetrics: ToolMetrics[] = profile.tools
    .filter((t) => t.metrics !== null)
    .map((t) => t.metrics as ToolMetrics)

  // Synthesize metrics from manual data if present
  const manualRaw = localStorage.getItem('manualData')
  if (manualRaw) {
    const manual = JSON.parse(manualRaw) as Record<string, number>
    if (manual['cursor.premiumRequestsUsed'] != null) {
      allMetrics.push(makeEmptyMetrics(manual['cursor.premiumRequestsUsed']))
    }
    if (manual['windsurf.flowActionsUsed'] != null) {
      allMetrics.push(makeEmptyMetrics(manual['windsurf.flowActionsUsed']))
    }
    if (manual['copilot.premiumRequestsUsed'] != null) {
      allMetrics.push(makeEmptyMetrics(manual['copilot.premiumRequestsUsed']))
    }
    if (manual['gemini.monthlyRequestsUsed'] != null) {
      allMetrics.push(makeEmptyMetrics(manual['gemini.monthlyRequestsUsed']))
    }
  }

  const ranked = rankPlans(allMetrics, plans as Plan[])

  // Date range
  const from = new Date(profile.range.from)
  const to = new Date(profile.range.to)
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`
  const dateRange = `${fmt(from)} – ${fmt(to)}`

  const totalUsd = ranked.length > 0 ? ranked[0].userUsageUsd : 0
  const toolCount = profile.tools.filter((t) => t.metrics !== null).length

  const allZero = ranked.every((r) => r.score === 0)

  const capabilityBadge = (tier: Tier) =>
    `<span class="badge badge-${tier}">${tier}</span>`

  const rows = ranked.map((r, i) => {
    const rank = i + 1
    const overflow = r.overflowPct === 0
      ? '—'
      : `<span style="color:red">↑${r.overflowPct.toFixed(0)}%</span>`
    return `<tr${rank === 1 ? ' class="rank-1"' : ''}>
      <td>${rank}</td>
      <td>${r.plan.name}</td>
      <td>${r.plan.provider}</td>
      <td>$${r.plan.monthlyPriceUsd}</td>
      <td>${r.coveragePct.toFixed(1)}%</td>
      <td>${overflow}</td>
      <td>${capabilityBadge(r.tier)}</td>
      <td>${r.score.toFixed(3)}</td>
    </tr>`
  }).join('\n')

  const notice = allZero
    ? `<div class="notice">Scores are all 0 — implement the scoring formula in web/src/lib/score.ts to see ranked results.</div>`
    : ''

  app.innerHTML = `
    <h2>Recommended Plans</h2>
    <p>Based on ~$${totalUsd.toFixed(2)}/mo equivalent API usage across ${toolCount} tool${toolCount !== 1 ? 's' : ''} over ${dateRange}</p>
    <table>
      <thead>
        <tr>
          <th>Rank</th><th>Plan</th><th>Provider</th><th>Price/mo</th>
          <th>Coverage</th><th>Overflow</th><th>Capability</th><th>Score</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    ${notice}
    <button id="clear-profile">Clear Profile</button>
  `

  app.querySelector('#clear-profile')!.addEventListener('click', () => {
    localStorage.removeItem('usageProfile')
    localStorage.removeItem('manualData')
    renderRecommend(app)
  })
}
