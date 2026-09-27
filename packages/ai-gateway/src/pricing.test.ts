import { describe, expect, it } from 'vitest'
import { estimateCostUsd } from './pricing.js'

describe('estimateCostUsd', () => {
  it('computes cost from known per-model input/output rates', () => {
    // claude-sonnet-5: $2/$10 per 1M tokens
    const cost = estimateCostUsd('anthropic/claude-sonnet-5', 1_000_000, 1_000_000)
    expect(cost).toBeCloseTo(12, 6)
  })

  it('falls back to a conservative estimate for an unknown model', () => {
    const known = estimateCostUsd('anthropic/claude-sonnet-5', 1000, 1000)
    const unknown = estimateCostUsd('some-provider/unreleased-model', 1000, 1000)
    expect(unknown).toBeGreaterThan(0)
    expect(unknown).not.toBe(known)
  })

  it('returns 0 for 0 tokens', () => {
    expect(estimateCostUsd('anthropic/claude-opus-5', 0, 0)).toBe(0)
  })
})
