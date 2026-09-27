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

Repo scaffold: schema, gateway adapter package, and workspace layout are in
place. `widget/`, `api/` and `console/` are not yet implemented.
