import type { Plan, PlanLimit, PlanModel, Tier } from '../lib/schema.js'
import { TIER_RANK, AVG_TOKENS_PER_MESSAGE, WEEKS_PER_MONTH, AVG_TOKENS_PER_REQ } from '../lib/schema.js'
import plans from '../data/plans.json'
import * as echarts from 'echarts'

function bestTier(models: PlanModel[]): Tier {
  return models.reduce<PlanModel>((best, m) =>
    TIER_RANK[m.tier] > TIER_RANK[best.tier] ? m : best
  , models[0]).tier
}

/** Pick the most meaningful limit to display, in priority order. */
const LIMIT_PRIORITY = [
  'messages-5h',
  'premium-requests-monthly',
  'requests-monthly',
  'messages-weekly',
  'tokens-monthly',
  'credits-monthly',
] as const

function primaryLimit(limits: PlanLimit[]): PlanLimit | null {
  for (const kind of LIMIT_PRIORITY) {
    const found = limits.find((l) => l.kind === kind)
    if (found) return found
  }
  return limits[0] ?? null
}

function formatLimit(limit: PlanLimit | null): string {
  if (!limit) return '—'
  switch (limit.kind) {
    case 'messages-5h':          return `~${limit.value} msgs / 5h`
    case 'messages-weekly':      return `${limit.value} msgs/wk`
    case 'tokens-monthly':       return `${(limit.value / 1_000_000).toFixed(1)}M tokens/mo`
    case 'requests-monthly':     return `${limit.value} req/mo`
    case 'premium-requests-monthly': return `${limit.value} req/mo`
    case 'credits-monthly':      return `${limit.value} credits/mo`
    default:                     return `${limit.value}`
  }
}

/**
 * Estimate how many M-tokens the plan's primary limit is equivalent to.
 * Returns null if not computable.
 */
function estimatedCapacityMTokens(plan: Plan): number | null {
  const limit = primaryLimit(plan.limits as PlanLimit[])
  if (!limit) return null

  if (limit.kind === 'tokens-monthly') {
    return limit.value / 1_000_000
  }
  if (limit.kind === 'messages-5h') {
    // 4 active coding hours/day ÷ 5h window × 30 days = 24 windows/mo
    const windowsPerMonth = 24
    return (limit.value * windowsPerMonth * AVG_TOKENS_PER_MESSAGE) / 1_000_000
  }
  if (limit.kind === 'messages-weekly') {
    return (limit.value * WEEKS_PER_MONTH * AVG_TOKENS_PER_MESSAGE) / 1_000_000
  }
  if (limit.kind === 'premium-requests-monthly' || limit.kind === 'requests-monthly') {
    return (limit.value * AVG_TOKENS_PER_REQ) / 1_000_000
  }
  return null
}

function costPerMToken(plan: Plan): string {
  if (plan.monthlyPriceUsd === 0) return 'Free'
  const cap = estimatedCapacityMTokens(plan)
  if (!cap || cap === 0) return '—'
  return `$${(plan.monthlyPriceUsd / cap).toFixed(2)}`
}

/** Rough equivalent dollar value using best model's PAYG blended rate (50% in / 50% out). */
function equivalentApiUsd(plan: Plan): number | null {
  const cap = estimatedCapacityMTokens(plan)
  if (!cap) return null
  const best = (plan.models as PlanModel[]).reduce<PlanModel | null>((b, m) => {
    if (!m.payAsYouGoUsd) return b
    if (!b || !b.payAsYouGoUsd) return m
    const mRate = (m.payAsYouGoUsd.input + m.payAsYouGoUsd.output) / 2
    const bRate = (b.payAsYouGoUsd.input + b.payAsYouGoUsd.output) / 2
    return mRate > bRate ? m : b
  }, null)
  if (!best?.payAsYouGoUsd) return null
  const blended = (best.payAsYouGoUsd.input + best.payAsYouGoUsd.output) / 2
  return cap * blended
}

function planLabel(plan: Plan): string {
  const providerShort: Record<string, string> = {
    anthropic: 'Anthropic',
    openai: 'OpenAI',
    cursor: 'Cursor',
    windsurf: 'Windsurf',
    github: 'GitHub',
    google: 'Google',
  }
  const prefix = providerShort[plan.provider] ?? plan.provider
  // Strip provider prefix from name if already present to avoid repetition
  let short = plan.name
  if (short.toLowerCase().startsWith(prefix.toLowerCase())) {
    short = short.slice(prefix.length).trim()
  }
  return `${prefix} ${short}`.trim()
}

export function renderCompare(app: HTMLElement): void {
  // ── 1. Scaffold ────────────────────────────────────────────────────────────
  app.innerHTML = `
    <h2>Compare Plans</h2>
    <table>
      <thead>
        <tr>
          <th>Provider</th>
          <th>Plan</th>
          <th>Price/mo</th>
          <th>Best Model Tier</th>
          <th>Limit Type</th>
          <th>Limit Value</th>
          <th>Est. $/1M tokens</th>
        </tr>
      </thead>
      <tbody id="compare-tbody"></tbody>
    </table>
    <div id="compare-chart" style="width:100%;height:300px;margin-top:24px"></div>
  `

  // ── 2. Sort plans ──────────────────────────────────────────────────────────
  const sorted = [...(plans as Plan[])].sort(
    (a, b) => a.monthlyPriceUsd - b.monthlyPriceUsd,
  )

  // ── 3. Populate table rows ─────────────────────────────────────────────────
  const tbody = app.querySelector<HTMLTableSectionElement>('#compare-tbody')!

  for (const plan of sorted) {
    const tier = bestTier(plan.models as PlanModel[])
    const limit = primaryLimit(plan.limits as PlanLimit[])

    const tr = document.createElement('tr')

    const tdProvider = document.createElement('td')
    tdProvider.textContent = plan.provider.charAt(0).toUpperCase() + plan.provider.slice(1)
    tr.appendChild(tdProvider)

    const tdName = document.createElement('td')
    tdName.textContent = plan.name
    tr.appendChild(tdName)

    const tdPrice = document.createElement('td')
    tdPrice.textContent = plan.monthlyPriceUsd === 0 ? 'Free' : `$${plan.monthlyPriceUsd}`
    tr.appendChild(tdPrice)

    const tdTier = document.createElement('td')
    const badge = document.createElement('span')
    badge.className = `badge badge-${tier}`
    badge.textContent = tier
    tdTier.appendChild(badge)
    tr.appendChild(tdTier)

    const tdLimitType = document.createElement('td')
    tdLimitType.textContent = limit ? limit.kind : '—'
    tr.appendChild(tdLimitType)

    const tdLimitVal = document.createElement('td')
    tdLimitVal.textContent = formatLimit(limit)
    tr.appendChild(tdLimitVal)

    const tdCost = document.createElement('td')
    tdCost.textContent = costPerMToken(plan)
    tr.appendChild(tdCost)

    tbody.appendChild(tr)
  }

  // ── 4. ECharts bar+line chart ──────────────────────────────────────────────
  const chartEl = app.querySelector<HTMLDivElement>('#compare-chart')!
  const chart = echarts.init(chartEl)

  const labels = sorted.map(planLabel)
  const prices = sorted.map((p) => p.monthlyPriceUsd)
  const apiEquiv = sorted.map((p) => {
    const v = equivalentApiUsd(p)
    return v !== null ? +v.toFixed(2) : null
  })

  chart.setOption({
    backgroundColor: '#1e293b',
    textStyle: { color: '#94a3b8' },
    grid: { left: 60, right: 70, top: 40, bottom: 80 },
    tooltip: { trigger: 'axis', backgroundColor: '#0f172a', borderColor: '#334155', textStyle: { color: '#e2e8f0' } },
    legend: {
      top: 8,
      textStyle: { color: '#94a3b8' },
      data: ['Monthly Price (USD)', 'Equiv. API Value (USD)'],
    },
    xAxis: {
      type: 'category',
      data: labels,
      axisLabel: { color: '#94a3b8', rotate: 35, fontSize: 11, interval: 0 },
      axisLine: { lineStyle: { color: '#334155' } },
      axisTick: { lineStyle: { color: '#334155' } },
    },
    yAxis: [
      {
        type: 'value',
        name: 'Price (USD)',
        nameTextStyle: { color: '#94a3b8' },
        axisLabel: { color: '#94a3b8', formatter: (v: number) => `$${v}` },
        splitLine: { lineStyle: { color: '#1e293b' } },
      },
      {
        type: 'value',
        name: 'API Equiv. (USD)',
        nameTextStyle: { color: '#94a3b8' },
        axisLabel: { color: '#94a3b8', formatter: (v: number) => `$${v}` },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: 'Monthly Price (USD)',
        type: 'bar',
        data: prices,
        itemStyle: { color: '#38bdf8' },
        barMaxWidth: 40,
      },
      {
        name: 'Equiv. API Value (USD)',
        type: 'line',
        yAxisIndex: 1,
        data: apiEquiv,
        lineStyle: { color: '#a78bfa', width: 2 },
        itemStyle: { color: '#a78bfa' },
        symbol: 'circle',
        symbolSize: 5,
        connectNulls: false,
      },
    ],
  })

  window.addEventListener('resize', () => chart.resize())
}
