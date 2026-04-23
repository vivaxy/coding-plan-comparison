import type { Plan } from '../../../web/src/lib/schema.ts'

export const PROVIDERS = [
  'anthropic', 'openai', 'cursor', 'windsurf', 'github', 'google', 'zed', 'amazon',
] as const satisfies ReadonlyArray<Plan['provider']>

const TIERS = ['frontier', 'strong', 'fast'] as const

const LIMIT_KINDS = [
  'messages-5h', 'messages-weekly', 'tokens-monthly',
  'requests-monthly', 'premium-requests-monthly', 'credits-monthly',
] as const

function bad(id: string, msg: string): never {
  throw new Error(`plan "${id}": ${msg}`)
}

export function assertPlan(plan: unknown): asserts plan is Plan {
  if (!plan || typeof plan !== 'object') throw new Error('plan must be an object')
  const p = plan as Record<string, unknown>
  const id = (typeof p.id === 'string' ? p.id : '<no id>')
  if (typeof p.id !== 'string' || !p.id) bad(id, 'id must be a non-empty string')
  if (typeof p.provider !== 'string' || !(PROVIDERS as readonly string[]).includes(p.provider)) {
    bad(id, `provider "${String(p.provider)}" not one of ${PROVIDERS.join(',')}`)
  }
  if (typeof p.name !== 'string' || !p.name) bad(id, 'name must be a non-empty string')
  if (typeof p.monthlyPriceUsd !== 'number' || p.monthlyPriceUsd < 0) {
    bad(id, 'monthlyPriceUsd must be a non-negative number')
  }
  if (!Array.isArray(p.models)) bad(id, 'models must be an array')
  for (const [i, m] of (p.models as unknown[]).entries()) {
    if (!m || typeof m !== 'object') bad(id, `models[${i}] must be an object`)
    const mm = m as Record<string, unknown>
    if (typeof mm.name !== 'string' || !mm.name) bad(id, `models[${i}].name must be a non-empty string`)
    if (typeof mm.tier !== 'string' || !(TIERS as readonly string[]).includes(mm.tier)) {
      bad(id, `models[${i}].tier "${String(mm.tier)}" not one of ${TIERS.join(',')}`)
    }
    if (mm.payAsYouGoUsd !== undefined) {
      const payg = mm.payAsYouGoUsd as Record<string, unknown>
      if (typeof payg?.input !== 'number' || typeof payg?.output !== 'number') {
        bad(id, `models[${i}].payAsYouGoUsd must have numeric input and output`)
      }
    }
  }
  if (!Array.isArray(p.limits)) bad(id, 'limits must be an array')
  for (const [i, l] of (p.limits as unknown[]).entries()) {
    if (!l || typeof l !== 'object') bad(id, `limits[${i}] must be an object`)
    const ll = l as Record<string, unknown>
    if (typeof ll.kind !== 'string' || !(LIMIT_KINDS as readonly string[]).includes(ll.kind)) {
      bad(id, `limits[${i}].kind "${String(ll.kind)}" not one of ${LIMIT_KINDS.join(',')}`)
    }
    if (typeof ll.value !== 'number' || ll.value < 0) {
      bad(id, `limits[${i}].value must be a non-negative number`)
    }
    if (ll.appliesTo !== undefined && !Array.isArray(ll.appliesTo)) {
      bad(id, `limits[${i}].appliesTo must be an array`)
    }
  }
}
