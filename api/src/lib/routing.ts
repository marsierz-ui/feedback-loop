export type Gateway = 'openrouter' | 'vercel-ai-gateway' | 'direct'
export type DirectProvider = 'anthropic' | 'openai'
export type Severity = 'critical' | 'high' | 'medium' | 'low'
export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

export interface RoutingRuleRow {
  id: string
  match_type: 'bug' | 'feature' | 'any'
  match_severity: Severity | null
  gateway: Gateway
  provider: DirectProvider | null
  model: string
  effort: Effort
  priority: number
  enabled: boolean
}

export interface RoutingContext {
  type: 'bug' | 'feature'
  severity?: Severity | null
}

// Picks the enabled rule that matches most specifically: an exact
// match_type beats 'any', an exact match_severity beats "no severity
// filter", and `priority` breaks ties the admin sets explicitly. Returns
// null when nothing matches at all — the caller decides the fallback (in
// routes/feedback.ts: the item stays "new" for manual triage).
export function selectRoutingRule(rules: RoutingRuleRow[], ctx: RoutingContext): RoutingRuleRow | null {
  const candidates = rules.filter((r) => {
    if (!r.enabled) return false
    if (r.match_type !== 'any' && r.match_type !== ctx.type) return false
    if (r.match_severity && r.match_severity !== ctx.severity) return false
    return true
  })
  if (!candidates.length) return null

  function specificity(r: RoutingRuleRow): number {
    let score = 0
    if (r.match_type !== 'any') score += 2
    if (r.match_severity) score += 1
    return score
  }

  return [...candidates].sort((a, b) => specificity(b) - specificity(a) || b.priority - a.priority)[0]
}
