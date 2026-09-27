# @feedback-loop/api

Backend: ingests widget submissions, routes each one to a triage model call
through a gateway or a direct (BYOK) provider call, records spend, and
exposes the admin routes the console (not yet built) will call.

## Environment variables

| Var | Required | Purpose |
|---|---|---|
| `SUPABASE_URL` | yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Service-role key — the API is the only thing that talks to Postgres directly |
| `CREDENTIALS_ENCRYPTION_KEY` | yes | Base64-encoded 32-byte AES-256-GCM key, encrypts `provider_credentials.encrypted_key` at rest. Generate with `openssl rand -base64 32`. |
| `ADMIN_API_KEY` | yes | Stopgap shared bearer token guarding every `/projects*` route — see "Auth" below |
| `OPENROUTER_API_KEY` | no | Platform-level OpenRouter key, used by routing rules with `gateway: "openrouter"` |
| `VERCEL_AI_GATEWAY_API_KEY` | no | Platform-level Vercel AI Gateway key, used by routing rules with `gateway: "vercel-ai-gateway"` |

## Supabase setup

1. Run `db/schema.sql` against the project.
2. Create a **public** storage bucket named `feedback-screenshots` (Storage → New bucket). Screenshots are uploaded there and served via their public URL; there is no separate signed-URL path in this version.

## Auth model

- **`POST /feedback`** — gated by `x-api-key`, a per-project *publishable*
  identifier shipped inside the widget bundle (like a Sentry DSN), not a
  secret. It identifies which project a submission belongs to; it does not
  by itself prove the request came from the host app. Rate limiting and a
  screenshot magic-byte check are not implemented yet (same accepted-risk
  shape as BugPilot's own `/feedback` endpoint — see `ARCHITECTURE.md`).
- **Every `/projects*` route** — gated by `Authorization: Bearer
  <ADMIN_API_KEY>`. This is a deliberate stopgap: a single shared token
  until the console ships real per-user auth (Supabase Auth + RLS). Do not
  expose these routes to anyone who shouldn't be able to create routing
  rules or set provider credentials for any project.
- **Provider credentials are write-only.** `PUT /projects/:id/credentials/:provider`
  stores an encrypted key; there is no route that returns a stored key's
  plaintext, ever. `GET /projects/:id/credentials` only lists which
  providers are configured.

## Local development

```bash
pnpm install
cp .env.example .env   # fill in the vars above
pnpm --filter @feedback-loop/api dev   # http://localhost:8787
```

## Direct (BYOK) providers

Alongside routing through OpenRouter or Vercel AI Gateway, a routing rule
can set `gateway: "direct"` with a `provider` of `"anthropic"` or
`"openai"`. In that mode the call goes straight to the provider's own API
using a key stored per-project via `PUT /projects/:id/credentials/:provider`
— useful when a project already has its own Anthropic or OpenAI account and
wants to bill usage there instead of through a gateway. Google/Gemini direct
support is a natural follow-up, not yet implemented.

## Routes

| Route | Auth | Purpose |
|---|---|---|
| `POST /feedback` | `x-api-key` | Widget ingestion: validates, stores the item, uploads a screenshot if present, runs triage against the matching routing rule, records cost |
| `POST /projects` | admin | Create a project |
| `GET /projects` | admin | List projects |
| `POST /projects/:id/routing-rules` | admin | Add a routing rule (type/severity → gateway/provider/model/effort) |
| `GET /projects/:id/routing-rules` | admin | List a project's routing rules |
| `PUT /projects/:id/credentials/:provider` | admin | Store (or replace) an encrypted BYOK key for `anthropic`/`openai` |
| `GET /projects/:id/credentials` | admin | List which providers have a stored key (never the key itself) |

## Testing

```bash
pnpm --filter @feedback-loop/api test        # vitest
pnpm --filter @feedback-loop/api typecheck   # tsc --noEmit
```
