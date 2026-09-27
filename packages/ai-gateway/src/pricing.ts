// Per-1M-token USD prices, keyed "<provider>/<model>" so one table serves
// both gateway-routed calls (OpenRouter/Vercel AI Gateway already qualify
// their model ids this way) and direct BYOK calls (each direct adapter
// prefixes its own bare model id with its provider name before looking up).
// Anthropic rows are first-party API rates. OpenAI rows are
// maintainer-supplied estimates — re-check against the provider's own
// pricing page before relying on them for real budgeting; this table is
// meant to be kept current by whoever maintains the deployment, not treated
// as authoritative forever. An unknown model falls back to a conservative
// estimate rather than silently reporting zero cost.
const PRICES_PER_MILLION_USD: Record<string, { input: number; output: number }> = {
  // Anthropic — https://platform.claude.com/docs pricing.
  'anthropic/claude-fable-5-1': { input: 10, output: 50 },
  'anthropic/claude-fable-5': { input: 10, output: 50 },
  'anthropic/claude-opus-5-5': { input: 4, output: 20 },
  'anthropic/claude-opus-5': { input: 5, output: 25 },
  'anthropic/claude-opus-4-8': { input: 5, output: 25 },
  'anthropic/claude-opus-4-7': { input: 5, output: 25 },
  'anthropic/claude-opus-4-6': { input: 5, output: 25 },
  'anthropic/claude-sonnet-5': { input: 2, output: 10 },
  'anthropic/claude-sonnet-4-6': { input: 3, output: 15 },
  'anthropic/claude-haiku-4-5': { input: 1, output: 5 },

  // OpenAI — maintainer-supplied estimates, verify before trusting.
  'openai/gpt-5': { input: 1.25, output: 10 },
  'openai/gpt-5.6-sol': { input: 5, output: 30 },
  'openai/gpt-5.6-terra': { input: 2, output: 12 },
  'openai/gpt-5.6-luna': { input: 0.2, output: 1.2 },
}

const FALLBACK_PRICE = { input: 5, output: 15 }

export function estimateCostUsd(providerQualifiedModel: string, inputTokens: number, outputTokens: number): number {
  const price = PRICES_PER_MILLION_USD[providerQualifiedModel] ?? FALLBACK_PRICE
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000
}
