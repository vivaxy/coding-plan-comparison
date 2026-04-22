import type { Plan, PlanLimit, ToolMetrics, Tier } from './schema'
import { AVG_TOKENS_PER_MESSAGE, WEEKS_PER_MONTH } from './schema'

// $/1M tokens baseline prices by model tier (fallback if payAsYouGoUsd missing)
export const TIER_BASELINE_USD: Record<Tier, { input: number; output: number }> = {
  frontier: { input: 15, output: 75 },
  strong: { input: 3, output: 15 },
  fast: { input: 0.25, output: 1.25 },
}

type TokenPrice = { input: number; output: number }

/**
 * Build a lookup table of model name → payAsYouGoUsd from all plans.
 * When the same model appears in multiple plans, any plan with a price wins
 * over one without; ties keep the first found.
 */
function buildModelPriceLookup(allPlans: Plan[]): Map<string, TokenPrice> {
  const lookup = new Map<string, TokenPrice>()
  for (const plan of allPlans) {
    for (const model of plan.models) {
      if (model.payAsYouGoUsd && !lookup.has(model.name)) {
        lookup.set(model.name, model.payAsYouGoUsd)
      }
    }
  }
  return lookup
}

/**
 * Convert a ToolMetrics object to an equivalent-USD monthly figure.
 * Uses per-model payAsYouGoUsd from the plans catalog where available,
 * falling back to TIER_BASELINE_USD for unknown models.
 *
 * For tools that only have message counts (no token data), uses
 * messages * AVG_TOKENS_PER_MESSAGE as an estimate.
 */
export function metricsToUsd(metrics: ToolMetrics, allPlans: Plan[]): number {
  const priceLookup = buildModelPriceLookup(allPlans)

  let totalUsd = 0

  const modelNames = Object.keys(metrics.byModel)

  if (modelNames.length > 0) {
    // Per-model breakdown available — use actual token counts per model
    for (const modelName of modelNames) {
      const modelMetrics = metrics.byModel[modelName]
      const price = priceLookup.get(modelName) ?? TIER_BASELINE_USD.strong

      const inputTokens =
        modelMetrics.inputTokens +
        modelMetrics.cacheReadTokens +
        modelMetrics.cacheCreateTokens
      const outputTokens = modelMetrics.outputTokens

      if (inputTokens > 0 || outputTokens > 0) {
        totalUsd +=
          (inputTokens * price.input + outputTokens * price.output) / 1_000_000
      } else if (modelMetrics.messages > 0) {
        // No token data for this model — estimate from message count
        const avgPrice = (price.input + price.output) / 2
        totalUsd +=
          (modelMetrics.messages * AVG_TOKENS_PER_MESSAGE * avgPrice) /
          1_000_000
      }
    }
  } else {
    // No per-model breakdown — use aggregate token counts with strong-tier baseline
    const price = TIER_BASELINE_USD.strong

    const inputTokens =
      metrics.inputTokens + metrics.cacheReadTokens + metrics.cacheCreateTokens
    const outputTokens = metrics.outputTokens

    if (inputTokens > 0 || outputTokens > 0) {
      totalUsd +=
        (inputTokens * price.input + outputTokens * price.output) / 1_000_000
    } else if (metrics.messages > 0) {
      const avgPrice = (price.input + price.output) / 2
      totalUsd +=
        (metrics.messages * AVG_TOKENS_PER_MESSAGE * avgPrice) / 1_000_000
    }
  }

  return totalUsd
}

/**
 * Resolve the price to use for a given PlanLimit.
 * If appliesTo is specified, look for the best matching model in the plan;
 * otherwise fall back to the plan's frontier model or TIER_BASELINE_USD.frontier.
 */
function resolveLimitPrice(limit: PlanLimit, plan: Plan): TokenPrice {
  if (limit.appliesTo && limit.appliesTo.length > 0) {
    // Find the first plan model whose name matches one of the appliesTo entries
    for (const target of limit.appliesTo) {
      const match = plan.models.find((m) => m.name === target)
      if (match?.payAsYouGoUsd) {
        return match.payAsYouGoUsd
      }
    }
    // No exact name match — try tier-name matching (e.g. "frontier-models")
    for (const target of limit.appliesTo) {
      const TIERS: Tier[] = ['frontier', 'strong', 'fast']
      const tierMatch = TIERS.find(
        (t) => target.includes(t),
      )
      if (tierMatch) {
        const tierModel = plan.models.find((m) => m.tier === tierMatch)
        if (tierModel?.payAsYouGoUsd) {
          return tierModel.payAsYouGoUsd
        }
        return TIER_BASELINE_USD[tierMatch]
      }
    }
  }

  // No appliesTo or no match — use the plan's frontier model
  const frontierModel = plan.models.find((m) => m.tier === 'frontier')
  if (frontierModel?.payAsYouGoUsd) {
    return frontierModel.payAsYouGoUsd
  }

  return TIER_BASELINE_USD.frontier
}

/**
 * Convert a single PlanLimit to its equivalent monthly USD capacity.
 */
function limitToUsd(limit: PlanLimit, plan: Plan): number {
  const price = resolveLimitPrice(limit, plan)
  // Use average of input + output as the representative price per token
  const avgPrice = (price.input + price.output) / 2

  switch (limit.kind) {
    case 'tokens-monthly':
      return (limit.value * avgPrice) / 1_000_000

    case 'messages-5h':
      // Cap to 4 active hours/day (realistic maximum)
      // limit.value messages per 5h window → value * (4/5) windows/hour * 24h * 30days
      // simplified: value * 4 * 30 / 5
      return (
        (limit.value * 4 * 30 * AVG_TOKENS_PER_MESSAGE * avgPrice) /
        (5 * 1_000_000)
      )

    case 'messages-weekly':
      return (
        (limit.value * WEEKS_PER_MONTH * AVG_TOKENS_PER_MESSAGE * avgPrice) / 1_000_000
      )

    case 'requests-monthly':
    case 'premium-requests-monthly':
    case 'credits-monthly':
      return (limit.value * AVG_TOKENS_PER_MESSAGE * avgPrice) / 1_000_000
  }
}

/**
 * Convert a plan's limits into equivalent-USD monthly capacity.
 * This is what the plan "gives you" expressed in the same units as metricsToUsd.
 *
 * Picks the LOWEST capacity from all limits (the binding constraint).
 * If no limits defined, returns a large number (effectively unlimited).
 */
export function planCapacityUsd(plan: Plan): number {
  if (plan.limits.length === 0) {
    return Number.MAX_SAFE_INTEGER
  }

  const capacities = plan.limits.map((limit) => limitToUsd(limit, plan))
  return Math.min(...capacities)
}

/**
 * Compute the capability weight for a plan based on the best model tier it offers.
 * frontier = 1.0, strong = 0.7, fast = 0.4
 */
export function planCapabilityWeight(plan: Plan): number {
  const tierWeights: Record<Tier, number> = {
    frontier: 1.0,
    strong: 0.7,
    fast: 0.4,
  }

  let best = 0
  for (const model of plan.models) {
    const weight = tierWeights[model.tier]
    if (weight > best) {
      best = weight
    }
  }

  return best > 0 ? best : tierWeights.fast
}
