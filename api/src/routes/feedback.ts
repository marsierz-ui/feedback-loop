import type { Context } from 'hono'
import { createGatewayRouter, type ModelTarget } from '@feedback-loop/ai-gateway'
import type { Bindings, Env } from '../env.js'
import { getEnv } from '../env.js'
import { createDb, type Db } from '../lib/db.js'
import { hashApiKey } from '../lib/apiKeys.js'
import { decryptSecret } from '../lib/crypto.js'
import { selectRoutingRule, type RoutingRuleRow } from '../lib/routing.js'
import { runTriage } from '../lib/triage.js'
import { feedbackSubmissionSchema } from '../schemas/feedback.js'

const MAX_SCREENSHOT_BYTES = 4_000_000
const SCREENSHOT_BUCKET = 'feedback-screenshots'

export async function handleFeedback(c: Context<{ Bindings: Bindings }>): Promise<Response> {
  const env = getEnv(c)
  const apiKey = c.req.header('x-api-key')
  if (!apiKey) return c.json({ error: 'Missing x-api-key header' }, 401)

  const db = createDb(env)
  const keyHash = await hashApiKey(apiKey)
  const { data: keyRow } = await db
    .from('api_keys')
    .select('project_id, revoked_at')
    .eq('key_hash', keyHash)
    .maybeSingle()

  if (!keyRow || keyRow.revoked_at) {
    return c.json({ error: 'Invalid or revoked API key' }, 401)
  }

  const { data: project } = await db.from('projects').select('id').eq('id', keyRow.project_id).single()
  if (!project) return c.json({ error: 'Project not found' }, 404)

  let raw: unknown
  try {
    raw = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const parsed = feedbackSubmissionSchema.safeParse(raw)
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => `${i.path.join('.') || 'payload'}: ${i.message}`).join('; ')
    return c.json({ error: `Invalid payload: ${detail}` }, 400)
  }
  const body = parsed.data

  let screenshotUrl: string | null = null
  if (body.screenshot) {
    const match = body.screenshot.match(/^data:image\/(png|jpeg|gif|webp);base64,(.+)$/)
    if (!match) return c.json({ error: 'Screenshot must be a base64 PNG/JPEG/GIF/WebP data URI' }, 400)
    const [, ext, base64] = match
    const approxBytes = (base64.length * 3) / 4
    if (approxBytes > MAX_SCREENSHOT_BYTES) return c.json({ error: 'Screenshot exceeds maximum size' }, 413)

    const bytes = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0))
    const path = `${project.id}/${crypto.randomUUID()}.${ext}`
    const { error: uploadError } = await db.storage.from(SCREENSHOT_BUCKET).upload(path, bytes, {
      contentType: `image/${ext}`,
    })
    if (uploadError) {
      console.error('[feedback-loop] screenshot upload failed', uploadError)
    } else {
      screenshotUrl = db.storage.from(SCREENSHOT_BUCKET).getPublicUrl(path).data.publicUrl
    }
  }

  const { data: item, error: insertError } = await db
    .from('feedback_items')
    .insert({
      project_id: project.id,
      type: body.type,
      description: body.description,
      context: body.context,
      screenshot_url: screenshotUrl,
      reporter: body.reporter ?? null,
    })
    .select('id')
    .single()

  if (insertError || !item) {
    console.error('[feedback-loop] feedback_items insert failed', insertError)
    return c.json({ error: 'Failed to record feedback' }, 500)
  }

  // Triage runs synchronously so its result is reflected before responding;
  // a triage failure (misconfigured routing, provider error) must never
  // fail the submission itself — the item is already saved either way.
  try {
    await triageAndRecord(db, env, project.id, item.id, body)
  } catch (err) {
    console.error('[feedback-loop] triage failed', err)
  }

  return c.json({ ok: true, itemId: item.id }, 201)
}

async function triageAndRecord(
  db: Db,
  env: Env,
  projectId: string,
  itemId: string,
  body: { type: 'bug' | 'feature'; description: string; context: Record<string, unknown> },
): Promise<void> {
  const { data: rules } = await db
    .from('routing_rules')
    .select('*')
    .eq('project_id', projectId)
    .eq('enabled', true)

  const rule = selectRoutingRule((rules ?? []) as RoutingRuleRow[], { type: body.type })
  if (!rule) return // No routing configured yet: item stays "new" for manual triage.

  const target = await resolveTarget(db, env, projectId, rule)
  const router = createGatewayRouter({
    openrouterApiKey: env.OPENROUTER_API_KEY,
    vercelAiGatewayApiKey: env.VERCEL_AI_GATEWAY_API_KEY,
  })

  const { triage, inputTokens, outputTokens, costUsd } = await runTriage(router, target, {
    type: body.type,
    description: body.description,
    context: body.context,
    effort: rule.effort,
  })

  await db.from('cost_ledger').insert({
    project_id: projectId,
    feedback_item_id: itemId,
    gateway: rule.gateway,
    provider: rule.provider,
    model: rule.model,
    effort: rule.effort,
    stage: 'triage',
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_usd: costUsd,
  })

  await db
    .from('feedback_items')
    .update({
      status: triage.classification === 'spam' ? 'spam' : 'triaged',
      severity: triage.severity,
      triage,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId)
}

async function resolveTarget(db: Db, env: Env, projectId: string, rule: RoutingRuleRow): Promise<ModelTarget> {
  if (rule.gateway !== 'direct') {
    return { via: 'gateway', gateway: rule.gateway, model: rule.model }
  }
  if (!rule.provider) throw new Error('Routing rule has gateway "direct" but no provider')

  const { data: credential } = await db
    .from('provider_credentials')
    .select('encrypted_key')
    .eq('project_id', projectId)
    .eq('provider', rule.provider)
    .single()

  if (!credential) throw new Error(`No stored credential for provider "${rule.provider}" on this project`)

  const apiKey = await decryptSecret(credential.encrypted_key, env.CREDENTIALS_ENCRYPTION_KEY)
  return { via: 'direct', provider: rule.provider, model: rule.model, apiKey }
}
