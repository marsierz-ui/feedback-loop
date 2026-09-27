export type Gateway = 'openrouter' | 'vercel-ai-gateway'

export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

export interface CompletionRequest {
  model: string
  system?: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  effort?: Effort
  maxTokens?: number
}

export interface CompletionResult {
  text: string
  inputTokens: number
  outputTokens: number
  /** USD, computed from the gateway's reported usage and its published per-token price. */
  costUsd: number
  gateway: Gateway
  model: string
}

export interface GatewayAdapter {
  readonly id: Gateway
  complete(req: CompletionRequest): Promise<CompletionResult>
}
