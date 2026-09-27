import type { CompletionRequest, GatewayAdapter } from '../types.js'
import { estimateCostUsd } from '../pricing.js'

// Raw HTTP (OpenAI has no first-class citizen in this repo the way
// Anthropic does): our Effort scale (low/medium/high/xhigh/max) matches
// OpenAI's own `reasoning_effort` values directly, so it's passed through
// unmapped. Support is model-dependent; an unsupported value is rejected by
// OpenAI's API, not silently ignored. `max_completion_tokens` replaces the
// older `max_tokens` field for reasoning-capable models.
export function createOpenAIDirectAdapter(apiKey: string): GatewayAdapter {
  return {
    async complete(model: string, req: CompletionRequest) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_completion_tokens: req.maxTokens ?? 8192,
          messages: [
            ...(req.system ? [{ role: 'system', content: req.system }] : []),
            ...req.messages,
          ],
          ...(req.effort ? { reasoning_effort: req.effort } : {}),
        }),
      })
      if (!res.ok) {
        throw new Error(`OpenAI request failed: ${res.status} ${await res.text()}`)
      }
      const data = (await res.json()) as {
        choices: Array<{ message: { content: string } }>
        usage: { prompt_tokens: number; completion_tokens: number }
      }
      const inputTokens = data.usage?.prompt_tokens ?? 0
      const outputTokens = data.usage?.completion_tokens ?? 0
      return {
        text: data.choices[0]?.message?.content ?? '',
        inputTokens,
        outputTokens,
        costUsd: estimateCostUsd(`openai/${model}`, inputTokens, outputTokens),
      }
    },
  }
}
