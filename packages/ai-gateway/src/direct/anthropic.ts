import Anthropic from '@anthropic-ai/sdk'
import type { CompletionRequest, Effort, GatewayAdapter } from '../types.js'
import { estimateCostUsd } from '../pricing.js'

// Haiku 4.5 (and any older model) doesn't take `output_config.effort` and
// still uses the legacy `thinking: {type: "enabled", budget_tokens}` form;
// budget_tokens is REJECTED (400) on every current Fable/Opus/Sonnet
// 5-series model, which use adaptive thinking + `output_config.effort`
// instead. Keep this set in sync with whichever models the deployment
// actually routes to — see the claude-api skill's thinking/effort table.
const LEGACY_THINKING_MODELS = new Set(['claude-haiku-4-5'])

const EFFORT_TO_LEGACY_BUDGET_TOKENS: Record<Effort, number> = {
  low: 1024,
  medium: 4096,
  high: 10000,
  xhigh: 24000,
  max: 32000,
}

export function createAnthropicDirectAdapter(apiKey: string): GatewayAdapter {
  const client = new Anthropic({ apiKey })

  return {
    async complete(model: string, req: CompletionRequest) {
      const legacy = LEGACY_THINKING_MODELS.has(model)
      let maxTokens = req.maxTokens ?? 8192
      let thinking: { type: 'adaptive' } | { type: 'enabled'; budget_tokens: number } | undefined
      let outputConfig: { effort: Effort } | undefined

      if (req.effort) {
        if (legacy) {
          const budget = EFFORT_TO_LEGACY_BUDGET_TOKENS[req.effort]
          // budget_tokens must be less than max_tokens; leave headroom for the reply.
          maxTokens = Math.max(maxTokens, budget + 4096)
          thinking = { type: 'enabled', budget_tokens: budget }
        } else {
          thinking = { type: 'adaptive' }
          outputConfig = { effort: req.effort }
        }
      }

      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        ...(req.system ? { system: req.system } : {}),
        messages: req.messages,
        ...(thinking ? { thinking } : {}),
        ...(outputConfig ? { output_config: outputConfig } : {}),
      })

      if (response.stop_reason === 'refusal') {
        const category = response.stop_details && 'category' in response.stop_details
          ? response.stop_details.category
          : 'unspecified'
        throw new Error(`Anthropic declined the request (category: ${category ?? 'unspecified'})`)
      }

      let text = ''
      for (const block of response.content) {
        if (block.type === 'text') text += block.text
      }

      const inputTokens = response.usage.input_tokens
      const outputTokens = response.usage.output_tokens
      return {
        text,
        inputTokens,
        outputTokens,
        costUsd: estimateCostUsd(`anthropic/${model}`, inputTokens, outputTokens),
      }
    },
  }
}
