// Per-1M-token USD prices, keyed by gateway-qualified model id. This is the
// one place cost math happens: both adapters report raw token counts and
// look the price up here, so the console's cost ledger stays comparable
// across gateways even though each gateway bills slightly differently.
// Update as models/prices change; an unknown model falls back to a
// conservative estimate rather than silently reporting zero cost.
const PRICES_PER_MILLION_USD: Record<string, { input: number; output: number }> = {
  'anthropic/claude-opus-5-5': { input: 15, output: 75 },
  'anthropic/claude-sonnet-5': { input: 3, output: 15 },
  'anthropic/claude-haiku-4-5': { input: 0.8, output: 4 },
  'openai/gpt-5': { input: 5, output: 15 },
}

const FALLBACK_PRICE = { input: 5, output: 15 }

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = PRICES_PER_MILLION_USD[model] ?? FALLBACK_PRICE
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000
}
