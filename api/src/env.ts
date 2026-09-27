import type { Context } from 'hono'

export interface Env {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
  /** Base64-encoded 32-byte AES-256-GCM key for provider_credentials. */
  CREDENTIALS_ENCRYPTION_KEY: string
  /** Stopgap shared bearer token guarding the admin routes — see ../README.md. */
  ADMIN_API_KEY: string
  OPENROUTER_API_KEY?: string
  VERCEL_AI_GATEWAY_API_KEY?: string
}

const REQUIRED_KEYS = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'CREDENTIALS_ENCRYPTION_KEY', 'ADMIN_API_KEY'] as const

export type Bindings = Record<string, string | undefined>

function nodeProcessEnv(): Record<string, string | undefined> {
  // Guarded: `process` isn't declared on every runtime this could deploy to
  // (e.g. Cloudflare Workers), only on Node and Vercel Node functions.
  return typeof process !== 'undefined' ? process.env : {}
}

// Reads config from whichever the current runtime actually populates:
// `c.env` (Cloudflare Workers / Vercel Edge Bindings) or `process.env`
// (Node). Throws with the specific missing key rather than failing later
// with an opaque undefined-property error.
export function getEnv(c: Context<{ Bindings: Bindings }>): Env {
  const merged = { ...nodeProcessEnv(), ...c.env }
  for (const key of REQUIRED_KEYS) {
    if (!merged[key]) throw new Error(`Missing required environment variable: ${key}`)
  }
  return merged as unknown as Env
}
