import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Env } from '../env.js'

export type Db = SupabaseClient

// Service-role client: the API is the only thing that talks to Postgres
// directly (no RLS-based client-side access), so every request-scoped
// authorization check (API key -> project, admin bearer token) happens in
// route handlers before a query runs — see lib/adminAuth.ts and the
// api_keys lookup in routes/feedback.ts.
export function createDb(env: Env): Db {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
}
