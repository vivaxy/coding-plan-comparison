import type { Plan, Tier } from './schema.js'
import { TIER_RANK } from './schema.js'
import { metricsToUsd, planCapacityUsd, planCapabilityWeight } from './normalize.js'
import type { ToolMetrics } from './schema.js'

export interface PlanScore {
  plan: Plan
  score: number          // higher = better value per dollar
  tier: Tier             // best model tier this plan offers
  userUsageUsd: number   // your usage at API pay-as-you-go rates
  capacityUsd: number    // what this plan gives you (equivalent USD)
  coveragePct: number    // min(userUsage / capacity, 1) * 100
  overflowPct: number    // how much you'd exceed the plan's limit (0 if within limits)
  capabilityWeight: number
}

/**
 * Score a single plan against the user's monthly usage.
 *
 * @param userUsageUsd   - Your total monthly usage expressed as equivalent USD
 *                         (compute with metricsToUsd() from normalize.ts)
 * @param plan           - The plan to evaluate (from plans.json)
 *
 * Returns a number — higher means better cost-effectiveness.
 *
 * ─── Trade-offs to consider ────────────────────────────────────────────────
 *
 * 1. OVERFLOW PENALTY
 *    If userUsageUsd > capacityUsd, the plan can't cover your usage.
 *    How harshly should you penalize this? Options:
 *      a) Hard cutoff: score = 0 if overflow (strict — any overflow = useless)
 *      b) Soft penalty: reduce score proportionally to overflow ratio
 *      c) Ignore overflow: let the ranking float (useful if you're willing to
 *         self-throttle or upgrade mid-month)
 *
 * 2. CAPABILITY WEIGHT
 *    A $20/mo plan with only Sonnet isn't equal to a $20/mo plan with Opus.
 *    planCapabilityWeight() returns 1.0 / 0.7 / 0.4 for frontier/strong/fast.
 *    Should this be linear? Or should frontier plans get a larger bonus?
 *
 * 3. UTILIZATION
 *    A plan you're using at 95% vs 5% capacity — are they equally good?
 *    Very low utilization = you're paying for headroom you don't need.
 *    Very high utilization = you might hit limits and get throttled.
 *    Some scorers prefer plans where coverage ≈ 80-90%.
 *
 * 4. PRICE WEIGHT
 *    Should a $100 plan need to be proportionally better than a $20 plan,
 *    or should it just need to be better? (valuePerDollar naturally handles this)
 *
 * ─── Variables available to you ────────────────────────────────────────────
 *   userUsageUsd       — your monthly usage in equivalent USD
 *   capacityUsd        — this plan's monthly capacity in equivalent USD
 *   capabilityWeight   — 1.0 / 0.7 / 0.4 (model quality factor)
 *   monthlyPriceUsd    — plan's monthly price
 *   coverage           — min(userUsageUsd / capacityUsd, 1)   ← [0, 1]
 *   fit                — 1 if within limits, else <1 (overflow penalty factor)
 *
 * ─── Example approach (do not copy — write your own) ───────────────────────
 *   const coverage = Math.min(userUsageUsd / capacityUsd, 1)
 *   const fit = userUsageUsd <= capacityUsd ? 1 : capacityUsd / userUsageUsd
 *   return (coverage * capabilityWeight * fit) / monthlyPriceUsd
 */
function scorePlan(
  _userUsageUsd: number,
  plan: Plan,
): number {
  const capacityUsd = planCapacityUsd(plan)
  const capabilityWeight = planCapabilityWeight(plan)
  const monthlyPriceUsd = plan.monthlyPriceUsd === 0 ? 0.01 : plan.monthlyPriceUsd

  const priceScore = -monthlyPriceUsd
  const capacityBonus = (1 - 1 / (1 + capacityUsd)) * 1e-3
  const capabilityBonus = capabilityWeight * 1e-6
  return priceScore + capacityBonus + capabilityBonus
}

/**
 * Score all plans and return them sorted best-first.
 * Called by the Recommend view.
 */
export function rankPlans(allMetrics: ToolMetrics[], allPlans: Plan[]): PlanScore[] {
  const userUsageUsd = allMetrics.reduce((sum, m) => sum + metricsToUsd(m, allPlans), 0)

  return allPlans
    .map((plan): PlanScore => {
      const capacityUsd = planCapacityUsd(plan)
      const capabilityWeight = planCapabilityWeight(plan)
      const score = scorePlan(userUsageUsd, plan)
      const coveragePct = Math.min(userUsageUsd / (capacityUsd || 1), 1) * 100
      const overflowPct = userUsageUsd > capacityUsd
        ? ((userUsageUsd - capacityUsd) / capacityUsd) * 100
        : 0
      const tier = plan.models.reduce<Tier>(
        (best, m) => TIER_RANK[m.tier] > TIER_RANK[best] ? m.tier : best,
        plan.models[0]?.tier ?? 'fast',
      )
      return { plan, score, tier, userUsageUsd, capacityUsd, coveragePct, overflowPct, capabilityWeight }
    })
    .sort((a, b) => b.score - a.score)
}
