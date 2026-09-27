-- feedback-loop core schema (Supabase / Postgres)
-- Multi-project admin console + effort-tiered, gateway-routed cost control.

create extension if not exists "pgcrypto";

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  repo_owner text,           -- GitHub owner for the fix-agent target repo (nullable: not every project auto-fixes)
  repo_name text,
  widget_origin text,        -- allowed CORS origin for this project's widget
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
  triage jsonb,                   -- classification, proposed_fix, response_draft from the triage model call
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists feedback_items_project_status_idx on feedback_items(project_id, status);

-- Which model + effort + gateway handles a category of work. A project can
-- have several rules (e.g. "critical bug" -> high effort, "feature request"
-- -> low effort) and the console picks the matching rule at routing time.
create table if not exists routing_rules (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  match_type text not null check (match_type in ('bug', 'feature', 'any')),
  match_severity text check (match_severity in ('critical', 'high', 'medium', 'low')),
  gateway text not null check (gateway in ('openrouter', 'vercel-ai-gateway')),
  model text not null,             -- gateway-qualified model id, e.g. "anthropic/claude-sonnet-4-6"
  effort text not null default 'medium' check (effort in ('low', 'medium', 'high', 'xhigh', 'max')),
  priority int not null default 0, -- higher priority rule wins on overlap
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists routing_rules_project_idx on routing_rules(project_id, enabled, priority desc);

-- One row per model call (triage, apply-fix iteration, etc.) so spend is
-- attributable to a project, an item, a gateway and a model, not just a
-- lump sum. This is what the console's budget/cost UI reads from.
create table if not exists cost_ledger (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  feedback_item_id uuid references feedback_items(id) on delete set null,
  gateway text not null check (gateway in ('openrouter', 'vercel-ai-gateway')),
  model text not null,
  effort text,
  stage text not null check (stage in ('triage', 'apply_fix')),
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cost_usd numeric(10, 6) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists cost_ledger_project_idx on cost_ledger(project_id, created_at);

-- Per-project widget submission credentials / rate-limit bucket key.
create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  key_hash text not null unique,  -- store a hash, never the raw key
  label text,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
