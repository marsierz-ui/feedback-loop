import type { Context } from 'hono'
import { z } from 'zod'
import type { Bindings } from '../env.js'
import { getEnv } from '../env.js'
import { createDb } from '../lib/db.js'
import { requireAdmin } from '../lib/adminAuth.js'

const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'slug must be lowercase letters, numbers and hyphens'),
  repoOwner: z.string().max(200).nullish(),
  repoName: z.string().max(200).nullish(),
  widgetOrigin: z.string().url().nullish(),
  monthlyBudgetUsd: z.number().positive().nullish(),
})

export async function handleCreateProject(c: Context<{ Bindings: Bindings }>): Promise<Response> {
  const env = getEnv(c)
  const unauthorized = requireAdmin(c, env)
  if (unauthorized) return unauthorized

  const parsed = createProjectSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map((i) => i.message).join('; ') }, 400)
  }

  const db = createDb(env)
  const { data: project, error } = await db
    .from('projects')
    .insert({
      name: parsed.data.name,
      slug: parsed.data.slug,
      repo_owner: parsed.data.repoOwner ?? null,
      repo_name: parsed.data.repoName ?? null,
      widget_origin: parsed.data.widgetOrigin ?? null,
      monthly_budget_usd: parsed.data.monthlyBudgetUsd ?? null,
    })
    .select()
    .single()

  if (error || !project) {
    return c.json({ error: error?.message ?? 'Failed to create project' }, 500)
  }
  return c.json({ project }, 201)
}

export async function handleListProjects(c: Context<{ Bindings: Bindings }>): Promise<Response> {
  const env = getEnv(c)
  const unauthorized = requireAdmin(c, env)
  if (unauthorized) return unauthorized

  const db = createDb(env)
  const { data: projects, error } = await db.from('projects').select('*').order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ projects })
}
