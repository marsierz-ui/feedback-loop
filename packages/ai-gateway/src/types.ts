export type Gateway = 'openrouter' | 'vercel-ai-gateway'
export type DirectProvider = 'anthropic' | 'openai'
export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

// What a routing_rules row resolves to for one call: either a named
// gateway (billed to the platform's own OpenRouter/Vercel AI Gateway
// account) or a direct, bring-your-own-key call straight to a provider's
// API (billed to the project's own account with that provider).
export type ModelTarget =
  | { via: 'gateway'; gateway: Gateway; model: string }
  | { via: 'direct'; provider: DirectProvider; model: string; apiKey: string }

export interface CompletionRequest {
  system?: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  effort?: Effort
  maxTokens?: number
}

export interface CompletionResult {
  text: string
  inputTokens: number
  outputTokens: number
  /** USD, computed from the reported usage and the pricing table. */
  costUsd: number
  target: ModelTarget
}

// What each provider-specific adapter implements. `model` is passed
// separately from the request body because the router resolves it from the
// ModelTarget, not from adapter-level state.
export interface GatewayAdapter {
  complete(model: string, req: CompletionRequest): Promise<Omit<CompletionResult, 'target'>>
}
