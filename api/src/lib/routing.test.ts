import { describe, expect, it } from 'vitest'
import { selectRoutingRule, type RoutingRuleRow } from './routing.js'

function rule(overrides: Partial<RoutingRuleRow>): RoutingRuleRow {
  return {
    id: 'r1',
    match_type: 'any',
    match_severity: null,
    gateway: 'openrouter',
    provider: null,
    model: 'anthropic/claude-haiku-4-5',
    effort: 'low',
    priority: 0,
    enabled: true,
    ...overrides,
  }
}

describe('selectRoutingRule', () => {
  it('returns null when no rule matches', () => {
    expect(selectRoutingRule([], { type: 'bug' })).toBeNull()
  })

  it('skips disabled rules', () => {
    const rules = [rule({ id: 'disabled', enabled: false })]
    expect(selectRoutingRule(rules, { type: 'bug' })).toBeNull()
  })

  it('prefers an exact type match over "any"', () => {
    const any = rule({ id: 'any' })
    const bug = rule({ id: 'bug', match_type: 'bug' })
    expect(selectRoutingRule([any, bug], { type: 'bug' })?.id).toBe('bug')
  })

  it('prefers an exact severity match over no severity filter', () => {
    const noSeverity = rule({ id: 'no-severity', match_type: 'bug' })
    const critical = rule({ id: 'critical', match_type: 'bug', match_severity: 'critical' })
    expect(selectRoutingRule([noSeverity, critical], { type: 'bug', severity: 'critical' })?.id).toBe('critical')
  })

  it('does not match a rule whose severity filter differs from the context', () => {
    const criticalOnly = rule({ id: 'critical', match_type: 'bug', match_severity: 'critical' })
    expect(selectRoutingRule([criticalOnly], { type: 'bug', severity: 'low' })).toBeNull()
  })

  it('breaks ties on priority', () => {
    const low = rule({ id: 'low-priority', match_type: 'bug', priority: 0 })
    const high = rule({ id: 'high-priority', match_type: 'bug', priority: 10 })
    expect(selectRoutingRule([low, high], { type: 'bug' })?.id).toBe('high-priority')
  })

  it('routes a feature request separately from a bug', () => {
    const bugRule = rule({ id: 'bug', match_type: 'bug' })
    const featureRule = rule({ id: 'feature', match_type: 'feature' })
    expect(selectRoutingRule([bugRule, featureRule], { type: 'feature' })?.id).toBe('feature')
  })
})
