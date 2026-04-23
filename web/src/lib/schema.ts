// Source of truth for shared types. cli/src/schema.ts is auto-generated from this file.
// See cli/scripts/sync-schema.mjs.

export type Tool = 'claude-code' | 'codex' | 'cursor' | 'windsurf' | 'copilot' | 'gemini'

export type Tier = 'frontier' | 'strong' | 'fast'

export const TIER_RANK: Record<Tier, number> = { frontier: 3, strong: 2, fast: 1 }

export const WEEKS_PER_MONTH = 52 / 12  // 4.333…

export const AVG_TOKENS_PER_MESSAGE = 2000  // rough tokens per user+assistant turn
export const AVG_TOKENS_PER_REQ = 3000  // rough tokens per non-message request

// The top-level output of the CLI — pasted into the webpage
export interface UsageProfile {
  schemaVersion: 1;
  generatedAt: string;   // ISO-8601 datetime
  range: { from: string; to: string };  // ISO date strings, inclusive
  tools: ToolUsage[];
}

// One entry per AI coding tool detected or probed
export interface ToolUsage {
  tool: Tool;
  verdict: 'rich' | 'partial' | 'minimal' | 'manual';
  metrics: ToolMetrics | null;     // null when verdict === 'manual'
  manualPrompts?: ManualPrompt[];  // present when the user must fill numbers manually
}

// Aggregated usage counters for one tool over the requested date range
export interface ToolMetrics {
  sessions: number;
  messages: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreateTokens: number;
  byModel: Record<string, ModelMetrics>;
}

export type ModelMetrics = Pick<ToolMetrics,
  'messages' | 'inputTokens' | 'outputTokens' | 'cacheReadTokens' | 'cacheCreateTokens'>;

// A field the user must fill in manually (for server-side data)
export interface ManualPrompt {
  field: string;   // e.g. "cursor.premiumRequestsUsed"
  label: string;   // human-readable label shown in the webpage form
  hint: string;    // where to find this value (URL or instructions)
}

// ─── Plan catalog (hand-maintained in plans.json) ────────────────────────────

export interface Plan {
  id: string;           // e.g. "anthropic-max-100"
  provider: 'anthropic' | 'openai' | 'cursor' | 'windsurf' | 'github' | 'google' | 'zed' | 'amazon';
  name: string;         // e.g. "Claude Max $100"
  monthlyPriceUsd: number;
  models: PlanModel[];
  limits: PlanLimit[];
}

export interface PlanModel {
  name: string;   // e.g. "claude-opus-4-6"
  tier: Tier;
  // Pay-as-you-go API prices for this model ($/1M tokens)
  // Used as baseline for equivalent-dollar normalization
  payAsYouGoUsd?: { input: number; output: number };
}

export interface PlanLimit {
  // What kind of quota this is
  kind:
    | 'messages-5h'
    | 'messages-weekly'
    | 'tokens-monthly'
    | 'requests-monthly'
    | 'premium-requests-monthly'
    | 'credits-monthly';
  value: number;
  appliesTo?: string[];  // model names or tier names this limit applies to
}
