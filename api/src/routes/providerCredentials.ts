import type { Context } from 'hono'
import { z } from 'zod'
import type { Bindings } from '../env.js'
import { getEnv } from '../env.js'
import { createDb } from '../lib/db.js'
import { requireAdmin } from '../lib/adminAuth.js'
import { encryptSecret } from '../lib/crypto.js'

const setCredentialSchema = z.object({
  apiKey: z.string().min(1).max(2000),
})

// Write-only by design: this route never returns a stored key, and there is
// no GET for the key itself. The console can only show "configured" vs.
// "not configured" per provider (list provider_credentials rows, never
// their encrypted_key column).
export async function handleSetProviderCredential(c: Context<{ Bindings: Bindings }>): Promise<Response> {
  const env = getEnv(c)
  const unauthorized = requireAdmin(c, env)
  if (unauthorized) return unauthorized

  const projectId = c.req.param('projectId')
  const provider = c.req.param('provider')
  if (provider !== 'anthropic' && provider !== 'openai') {
    return c.json({ error: 'provider must be "anthropic" or "openai"' }, 400)
  }

  const parsed = setCredentialSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map((i) => i.message).join('; ') }, 400)
  }

  const encryptedKey = await encryptSecret(parsed.data.apiKey, env.CREDENTIALS_ENCRYPTION_KEY)

  const db = createDb(env)
  const { error } = await db
    .from('provider_credentials')
    .upsert({ project_id: projectId, provider, encrypted_key: encryptedKey }, { onConflict: 'project_id,provider' })

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ ok: true, provider, configured: true })
}

export async function handleListProviderCredentials(c: Context<{ Bindings: Bindings }>): Promise<Response> {
  const env = getEnv(c)
  const unauthorized = requireAdmin(c, env)
  if (unauthorized) return unauthorized

  const projectId = c.req.param('projectId')
  const db = createDb(env)
  const { data, error } = await db.from('provider_credentials').select('provider, created_at').eq('project_id', projectId)
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ credentials: data })
}
