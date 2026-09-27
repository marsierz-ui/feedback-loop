import type { Context } from 'hono'
import type { Bindings, Env } from '../env.js'

// Stopgap: a single shared admin bearer token, checked against
// ADMIN_API_KEY. This guards project/routing-rule/credential management
// until the console ships real per-user auth (Supabase Auth + RLS) — see
// ARCHITECTURE.md. Every admin route must call this before touching the DB.
// Returns a 401 Response to send as-is, or null when the caller is authorized.
export function requireAdmin(c: Context<{ Bindings: Bindings }>, env: Env): Response | null {
  const header = c.req.header('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token || token !== env.ADMIN_API_KEY) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  return null
}
