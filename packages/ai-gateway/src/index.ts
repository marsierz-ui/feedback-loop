import type { Gateway, GatewayAdapter, CompletionRequest, CompletionResult } from './types.js'
import { createOpenRouterAdapter } from './openrouter.js'
import { createVercelAiGatewayAdapter } from './vercel.js'

export type { Gateway, Effort, CompletionRequest, CompletionResult, GatewayAdapter } from './types.js'

export interface GatewayRouterConfig {
  openrouterApiKey?: string
  vercelAiGatewayApiKey?: string
}

// The console picks a routing_rules row (gateway + model + effort) per
// feedback item; this router just dispatches to whichever adapter that
// rule names. Adding a third gateway later means one more branch here and
// nothing else in the codebase changes.
export function createGatewayRouter(config: GatewayRouterConfig) {
  const adapters = new Map<Gateway, GatewayAdapter>()
  if (config.openrouterApiKey) {
    adapters.set('openrouter', createOpenRouterAdapter(config.openrouterApiKey))
  }
  if (config.vercelAiGatewayApiKey) {
    adapters.set('vercel-ai-gateway', createVercelAiGatewayAdapter(config.vercelAiGatewayApiKey))
  }

  return {
    async complete(gateway: Gateway, req: CompletionRequest): Promise<CompletionResult> {
      const adapter = adapters.get(gateway)
      if (!adapter) {
        throw new Error(`No adapter configured for gateway "${gateway}" (missing API key?)`)
      }
      return adapter.complete(req)
    },
  }
}
