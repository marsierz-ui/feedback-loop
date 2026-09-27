# Architecture

## Why not just fork BugPilot

[BugPilot](https://github.com/rodlunt/bugpilot) already covers widget capture,
GitHub issue creation and an agentic apply-fix loop for a single repo. What it
has none of: a persistent datastore (GitHub Issues *is* its database), an
admin console (GitHub's own Issues UI is its UI), multi-project support (one
Worker per repo, no shared view), and any model/gateway choice (a hardcoded
Anthropic model string, no effort parameter, no cost tracking). Those four
gaps are the point of this project, so it's a fresh build rather than a fork —
though the apply-fix agent loop's tool design, path-traversal guard, and
scoped/expiring approval tokens are worth reusing patterns from it.

## Components

- **`widget/`** — embeddable capture widget (script tag, screenshot +
  annotation + description), POSTs to the API.
- **`api/`** — backend: ingests widget submissions, runs triage through the
  gateway router, applies routing rules, writes the cost ledger, dispatches
  the fix-agent workflow on approval.
- **`console/`** — admin web app (Next.js): cross-project feedback queue,
  triage/routing management, per-project model+effort rules, spend dashboard.
- **`packages/ai-gateway/`** — provider-agnostic adapter over OpenRouter and
  Vercel AI Gateway. Routing rules name a `(gateway, model, effort)` triple;
  the router dispatches to whichever adapter that names. A third gateway is
  one more adapter, not a rewrite.
- **`db/schema.sql`** — Postgres schema (Supabase): `projects`,
  `feedback_items`, `routing_rules`, `cost_ledger`, `api_keys`.

## Data flow

```
widget --submit--> api /feedback --> feedback_items row (status: new)
                                   --> triage call via gateway router
                                        (routing_rules picks gateway+model+effort)
                                   --> cost_ledger row written
                                   --> status: triaged, severity/classification set
console --route/approve--> status: routed / in_progress
                         --> api dispatches the fix-agent workflow against
                             the project's repo (GitHub Actions, BugPilot-style
                             agent loop) or another configured executor
                         --> PR opened --> status: fixed
```

## Why a real database instead of GitHub Issues as the store

A DB is what makes "multi-project admin console" and "cost controls" possible
at all: cross-project queries, per-project budgets, and a cost ledger keyed by
model/gateway/effort don't exist if the datastore is GitHub's issue tracker.
Projects can still optionally mirror a `feedback_items` row into a GitHub
issue for teams that want their existing dev workflow, but the console's own
state doesn't depend on that mirror.

## Stack

Supabase (Postgres + auth, free tier) for the database and console auth;
Vercel (free Hobby tier) for the console and API; OpenRouter and Vercel AI
Gateway both wired in as gateway adapters so routing rules can pick either
per project/category rather than being locked to one.
