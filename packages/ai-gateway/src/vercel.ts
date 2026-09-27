import type { CompletionRequest, CompletionResult, GatewayAdapter } from './types.js'
import { estimateCostUsd } from './pricing.js'

// Vercel AI Gateway also exposes an OpenAI-compatible chat/completions
// endpoint, billed to the Vercel account instead of a separate API key.
export function createVercelAiGatewayAdapter(apiKey: string): GatewayAdapter {
  return {
    id: 'vercel-ai-gateway',
    async complete(req: CompletionRequest): Promise<CompletionResult> {
      const res = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
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
          providerOptions: req.effort
            ? { anthropic: { reasoningEffort: req.effort }, openai: { reasoningEffort: req.effort } }
            : undefined,
        }),
      })
      if (!res.ok) {
        throw new Error(`Vercel AI Gateway request failed: ${res.status} ${await res.text()}`)
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
        gateway: 'vercel-ai-gateway',
        model: req.model,
      }
    },
  }
}
