-- Event-driven automation: domain events (outbox), durable job queue,
-- workflow runs and AI cost accounting.

create table public.domain_events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (name ~ '^[a-z_]+\.[a-z_]+$'),
  -- Producers pass a deterministic key; re-emitting the same event is a no-op.
  idempotency_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  producer text not null,
  actor_user_id uuid references public.profiles (id) on delete set null,
  organization_id uuid references public.organizations (id) on delete set null,
  subject_type text,
  subject_id uuid,
  occurred_at timestamptz not null default now(),
  dispatched_at timestamptz
);
create index domain_events_subject on public.domain_events (subject_type, subject_id, occurred_at desc);
create index domain_events_undispatched on public.domain_events (occurred_at) where dispatched_at is null;

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed', 'dead', 'cancelled')),
  priority smallint not null default 100,
  attempts smallint not null default 0,
  max_attempts smallint not null default 5 check (max_attempts > 0),
  timeout_seconds integer not null default 300 check (timeout_seconds > 0),
  run_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  result jsonb,
  idempotency_key text not null unique,
  event_id uuid references public.domain_events (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);
create index jobs_ready on public.jobs (priority, run_at) where status = 'queued';
create index jobs_running on public.jobs (locked_at) where status = 'running';
create trigger jobs_touch before update on public.jobs
  for each row execute function app_private.touch_updated_at();

create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_key text not null,
  workflow_version integer not null default 1,
  prompt_version text,
  status text not null default 'queued' check (status in (
    'queued', 'running', 'succeeded', 'failed', 'needs_review', 'blocked_unconfigured', 'skipped', 'approved', 'rejected')),
  subject_type text,
  subject_id uuid,
  company_id uuid references public.companies (id) on delete set null,
  job_id uuid references public.jobs (id) on delete set null,
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  steps jsonb not null default '[]'::jsonb,
  error text,
  requires_approval boolean not null default false,
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
create index automation_runs_subject on public.automation_runs (subject_type, subject_id);
create index automation_runs_review on public.automation_runs (status) where status = 'needs_review';

alter table public.company_intelligence_records add constraint company_intelligence_records_run_fk
  foreign key (automation_run_id) references public.automation_runs (id) on delete set null;

create table public.ai_executions (
  id uuid primary key default gen_random_uuid(),
  automation_run_id uuid references public.automation_runs (id) on delete cascade,
  provider text not null,
  model text not null,
  prompt_version text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_cost_usd numeric(12, 6) not null default 0,
  latency_ms integer,
  status text not null check (status in ('succeeded', 'failed', 'invalid_output')),
  error text,
  created_at timestamptz not null default now()
);
create index ai_executions_created on public.ai_executions (created_at desc);

-- ---------------------------------------------------------------------------
-- Private operational tables (never exposed to client roles)
-- ---------------------------------------------------------------------------
create table app_private.rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket, window_start)
);

-- Used only by the local development auth provider (AUTH_PROVIDER=local).
create table app_private.local_auth_tokens (
  token_hash text primary key,
  email citext not null,
  full_name text,
  redirect_to text not null default '/portal',
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- Used only when EMAIL_PROVIDER=dev_outbox: emails are captured, never sent.
create table app_private.dev_outbox (
  id uuid primary key default gen_random_uuid(),
  to_email citext not null,
  subject text not null,
  html text not null,
  text_body text not null,
  tag text,
  created_at timestamptz not null default now()
);

-- Account data export/deletion requests (processed by staff + jobs).
create table public.data_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('export', 'deletion')),
  status text not null default 'requested' check (status in ('requested', 'in_progress', 'completed', 'rejected')),
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
