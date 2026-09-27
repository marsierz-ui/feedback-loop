import type { CompletionRequest, CompletionResult, GatewayAdapter } from './types.js'
import { estimateCostUsd } from './pricing.js'

// OpenRouter's chat/completions is OpenAI-compatible. Effort maps to
// `reasoning.effort` for models that support extended thinking; models that
// don't just ignore the field.
export function createOpenRouterAdapter(apiKey: string): GatewayAdapter {
  return {
    id: 'openrouter',
    async complete(req: CompletionRequest): Promise<CompletionResult> {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: req.model,
          max_tokens: req.maxTokens ?? 4096,
          messages: [
            ...(req.system ? [{ role: 'system', content: req.system }] : []),
            ...req.messages,
          ],
          reasoning: req.effort ? { effort: req.effort } : undefined,
        }),
      })
      if (!res.ok) {
        throw new Error(`OpenRouter request failed: ${res.status} ${await res.text()}`)
      }
      const data = await res.json() as {
        choices: Array<{ message: { content: string } }>
        usage: { prompt_tokens: number; completion_tokens: number }
      }
      const inputTokens = data.usage?.prompt_tokens ?? 0
      const outputTokens = data.usage?.completion_tokens ?? 0
      return {
        text: data.choices[0]?.message?.content ?? '',
        inputTokens,
        outputTokens,
        costUsd: estimateCostUsd(req.model, inputTokens, outputTokens),
        gateway: 'openrouter',
        model: req.model,
      }
    },
  }
}
