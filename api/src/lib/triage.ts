import type { createGatewayRouter, ModelTarget, Effort } from '@feedback-loop/ai-gateway'

export interface TriageResult {
  classification: 'bug' | 'feature' | 'spam' | 'needs-info'
  severity: 'critical' | 'high' | 'medium' | 'low' | null
  summary: string
}

export interface TriageInput {
  type: 'bug' | 'feature'
  description: string
  context: Record<string, unknown>
  effort: Effort
}

export interface TriageOutcome {
  triage: TriageResult
  inputTokens: number
  outputTokens: number
  costUsd: number
}

const SYSTEM_PROMPT = `You triage user-submitted feedback for a software product.
Read the report and respond with a single JSON object and nothing else:
{"classification": "bug" | "feature" | "spam" | "needs-info", "severity": "critical" | "high" | "medium" | "low" | null, "summary": "one sentence"}
severity only applies when classification is "bug"; use null otherwise.`

export async function runTriage(
  router: ReturnType<typeof createGatewayRouter>,
  target: ModelTarget,
  input: TriageInput,
): Promise<TriageOutcome> {
  const result = await router.complete(target, {
    system: SYSTEM_PROMPT,
    effort: input.effort,
    messages: [
      {
        role: 'user',
        content: `Type: ${input.type}\nDescription: ${input.description}\nContext: ${JSON.stringify(input.context)}`,
      },
    ],
  })

  return {
    triage: parseTriageJson(result.text),
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    costUsd: result.costUsd,
  }
}

function parseTriageJson(text: string): TriageResult {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error(`Triage model did not return JSON: ${text.slice(0, 200)}`)

  const parsed: unknown = JSON.parse(match[0])
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Triage model returned non-object JSON')
  }
  const { classification, severity, summary } = parsed as Record<string, unknown>

  if (classification !== 'bug' && classification !== 'feature' && classification !== 'spam' && classification !== 'needs-info') {
    throw new Error(`Unexpected triage classification: ${String(classification)}`)
  }
  const validSeverities = new Set(['critical', 'high', 'medium', 'low'])
  const resolvedSeverity = typeof severity === 'string' && validSeverities.has(severity) ? (severity as TriageResult['severity']) : null

  return {
    classification,
    severity: resolvedSeverity,
    summary: typeof summary === 'string' ? summary : '',
  }
}
