import type { Gateway, DirectProvider, ModelTarget, CompletionRequest, CompletionResult, GatewayAdapter } from './types.js'
import { createOpenRouterAdapter } from './openrouter.js'
import { createVercelAiGatewayAdapter } from './vercel.js'
import { createAnthropicDirectAdapter } from './direct/anthropic.js'
import { createOpenAIDirectAdapter } from './direct/openai.js'

export type { Gateway, DirectProvider, Effort, ModelTarget, CompletionRequest, CompletionResult, GatewayAdapter } from './types.js'

export interface GatewayRouterConfig {
  openrouterApiKey?: string
  vercelAiGatewayApiKey?: string
}

const DIRECT_FACTORIES: Record<DirectProvider, (apiKey: string) => GatewayAdapter> = {
  anthropic: createAnthropicDirectAdapter,
  openai: createOpenAIDirectAdapter,
}

// The console picks a ModelTarget per feedback item (a routing_rules row):
// either a named gateway, billed to the platform's own OpenRouter/Vercel AI
// Gateway account, or a direct call using a project's own stored API key.
// Adding a third gateway or direct provider is one more entry in these two
// maps; nothing else in the codebase changes.
export function createGatewayRouter(config: GatewayRouterConfig) {
  const gatewayAdapters: Partial<Record<Gateway, GatewayAdapter>> = {}
  if (config.openrouterApiKey) {
    gatewayAdapters.openrouter = createOpenRouterAdapter(config.openrouterApiKey)
  }
  if (config.vercelAiGatewayApiKey) {
    gatewayAdapters['vercel-ai-gateway'] = createVercelAiGatewayAdapter(config.vercelAiGatewayApiKey)
  }

  return {
    async complete(target: ModelTarget, req: CompletionRequest): Promise<CompletionResult> {
      if (target.via === 'gateway') {
        const adapter = gatewayAdapters[target.gateway]
        if (!adapter) {
          throw new Error(`No adapter configured for gateway "${target.gateway}" (missing API key?)`)
        }
        const result = await adapter.complete(target.model, req)
        return { ...result, target }
      }

      // Direct/BYOK: built fresh per call since the key is per-project
      // (decrypted from provider_credentials), not platform-level.
      const adapter = DIRECT_FACTORIES[target.provider](target.apiKey)
      const result = await adapter.complete(target.model, req)
      return { ...result, target }
    },
  }
}
