# feedback-loop

Drop-in feedback widget → multi-project admin console → AI-agent fixes,
with model and effort chosen per project/category and routed through
OpenRouter or Vercel AI Gateway.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the design and how this compares
to existing tools ([BugPilot](https://github.com/rodlunt/bugpilot) in
particular).

## Layout

- `widget/` — embeddable capture widget
- `api/` — backend (ingestion, triage routing, fix-agent dispatch)
- `console/` — admin web app
- `packages/ai-gateway/` — OpenRouter / Vercel AI Gateway adapter
- `db/schema.sql` — Postgres schema (Supabase)

## Status

`packages/ai-gateway` and `api/` are implemented: ingestion, routing,
triage (via OpenRouter, Vercel AI Gateway, or a direct BYOK call to
Anthropic/OpenAI), and cost-ledger recording. See `api/README.md` for setup
and routes. `widget/` and `console/` are not yet implemented — the API's
admin routes exist but currently need a shared bearer token (see
`ARCHITECTURE.md` → "Known gap: admin auth is a stopgap") until the console
brings real auth.
