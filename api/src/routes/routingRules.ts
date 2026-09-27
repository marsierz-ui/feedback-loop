import type { Context } from 'hono'
import { z } from 'zod'
import type { Bindings } from '../env.js'
import { getEnv } from '../env.js'
import { createDb } from '../lib/db.js'
import { requireAdmin } from '../lib/adminAuth.js'

const createRuleSchema = z
  .object({
    matchType: z.enum(['bug', 'feature', 'any']),
    matchSeverity: z.enum(['critical', 'high', 'medium', 'low']).nullish(),
    gateway: z.enum(['openrouter', 'vercel-ai-gateway', 'direct']),
    provider: z.enum(['anthropic', 'openai']).nullish(),
    model: z.string().min(1).max(200),
    effort: z.enum(['low', 'medium', 'high', 'xhigh', 'max']).default('medium'),
    priority: z.number().int().default(0),
  })
  .refine((v) => (v.gateway === 'direct') === (v.provider != null), {
    message: 'provider is required when gateway is "direct", and must be omitted otherwise',
  })

export async function handleCreateRoutingRule(c: Context<{ Bindings: Bindings }>): Promise<Response> {
  const env = getEnv(c)
  const unauthorized = requireAdmin(c, env)
  if (unauthorized) return unauthorized

  const projectId = c.req.param('projectId')
  const parsed = createRuleSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map((i) => i.message).join('; ') }, 400)
  }

  const db = createDb(env)
  const { data: rule, error } = await db
    .from('routing_rules')
    .insert({
      project_id: projectId,
      match_type: parsed.data.matchType,
      match_severity: parsed.data.matchSeverity ?? null,
      gateway: parsed.data.gateway,
      provider: parsed.data.provider ?? null,
      model: parsed.data.model,
      effort: parsed.data.effort,
      priority: parsed.data.priority,
    })
    .select()
    .single()

  if (error || !rule) return c.json({ error: error?.message ?? 'Failed to create routing rule' }, 500)
  return c.json({ rule }, 201)
}

export async function handleListRoutingRules(c: Context<{ Bindings: Bindings }>): Promise<Response> {
  const env = getEnv(c)
  const unauthorized = requireAdmin(c, env)
  if (unauthorized) return unauthorized

  const projectId = c.req.param('projectId')
  const db = createDb(env)
  const { data: rules, error } = await db
    .from('routing_rules')
    .select('*')
    .eq('project_id', projectId)
    .order('priority', { ascending: false })

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ rules })
}
