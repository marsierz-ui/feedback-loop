-- feedback-loop core schema (Supabase / Postgres)
-- Multi-project admin console + effort-tiered, gateway-routed cost control,
-- with an option to bypass the gateway and call a closed-model provider
-- directly using a project's own API key (BYOK).

create extension if not exists "pgcrypto";

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  repo_owner text,           -- GitHub owner for the fix-agent target repo (nullable: not every project auto-fixes)
  repo_name text,
  widget_origin text,        -- informational CORS allowlist; /feedback auth is the API key, not origin (see api/README.md)
  monthly_budget_usd numeric(10, 2),
  created_at timestamptz not null default now()
);

create table if not exists feedback_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  type text not null check (type in ('bug', 'feature')),
  status text not null default 'new'
    check (status in ('new', 'triaged', 'routed', 'in_progress', 'fixed', 'wont_fix', 'spam')),
  severity text check (severity in ('critical', 'high', 'medium', 'low')),
  description text not null,
  context jsonb not null,        -- url, viewport, browser, os, timestamp, etc. (widget-captured)
  screenshot_url text,
  reporter jsonb,                 -- { name, login } or null
  triage jsonb,                   -- classification, severity, summary from the triage model call
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists feedback_items_project_status_idx on feedback_items(project_id, status);

-- BYOK credentials for direct provider calls (bypassing a gateway). The
-- application layer encrypts the key (AES-256-GCM, see api/src/lib/crypto.ts)
-- before this column is written; the DB never sees a plaintext key, and no
-- route ever reads one back out — the console can only show configured vs.
-- not configured per provider.
create table if not exists provider_credentials (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  provider text not null check (provider in ('anthropic', 'openai')),
  encrypted_key text not null,
  created_at timestamptz not null default now(),
  unique (project_id, provider)
);

-- Which model + effort + gateway handles a category of work. A project can
-- have several rules (e.g. "critical bug" -> high effort, "feature request"
-- -> low effort) and the router picks the best-matching enabled rule at
-- triage time (see api/src/lib/routing.ts). gateway = 'direct' routes
-- straight to the provider's own API using the matching provider_credentials
-- row instead of going through OpenRouter/Vercel AI Gateway.
create table if not exists routing_rules (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  match_type text not null check (match_type in ('bug', 'feature', 'any')),
  match_severity text check (match_severity in ('critical', 'high', 'medium', 'low')),
  gateway text not null check (gateway in ('openrouter', 'vercel-ai-gateway', 'direct')),
  provider text check (provider in ('anthropic', 'openai')),  -- required iff gateway = 'direct'
  model text not null,             -- gateway-qualified for openrouter/vercel-ai-gateway (e.g. "anthropic/claude-sonnet-5"), bare for direct (e.g. "claude-sonnet-5")
  effort text not null default 'medium' check (effort in ('low', 'medium', 'high', 'xhigh', 'max')),
  priority int not null default 0, -- higher priority rule wins on overlap
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  constraint routing_rules_direct_provider check (
    (gateway = 'direct' and provider is not null) or (gateway <> 'direct' and provider is null)
  )
);

create index if not exists routing_rules_project_idx on routing_rules(project_id, enabled, priority desc);

-- One row per model call (triage, apply-fix iteration, etc.) so spend is
-- attributable to a project, an item, a gateway/provider and a model, not
-- just a lump sum. This is what the console's budget/cost UI reads from.
create table if not exists cost_ledger (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  feedback_item_id uuid references feedback_items(id) on delete set null,
  gateway text not null check (gateway in ('openrouter', 'vercel-ai-gateway', 'direct')),
  provider text check (provider in ('anthropic', 'openai')),
  model text not null,
  effort text,
  stage text not null check (stage in ('triage', 'apply_fix')),
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cost_usd numeric(10, 6) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists cost_ledger_project_idx on cost_ledger(project_id, created_at);

-- Per-project widget submission credential: a publishable identifier
-- embedded in the widget bundle on the host page (like a Sentry DSN), not a
-- secret — hashing it before storage is hygiene, not confidentiality. It
-- identifies which project a submission belongs to; it does not by itself
-- prove the request came from the host app (see api/README.md, accepted risk).
create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  key_hash text not null unique,  -- sha256 hex digest, never the raw key
  label text,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
