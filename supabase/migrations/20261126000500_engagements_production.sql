-- Phase 3-5 schema: proposals, engagements, billing, production, campaigns.
-- Defined now so every module shares one data model; application code for most
-- of these tables arrives in later phases (see ROADMAP.md).

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references public.opportunities (id) on delete set null,
  company_id uuid not null references public.companies (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'internal_review', 'approved', 'sent', 'accepted', 'declined', 'expired', 'withdrawn')),
  version integer not null default 1,
  title text not null,
  content jsonb not null default '{}'::jsonb,
  subtotal_cents integer not null default 0,
  discount_cents integer not null default 0 check (discount_cents >= 0),
  total_cents integer not null default 0,
  recurring_monthly_cents integer not null default 0,
  valid_until date,
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  sent_at timestamptz,
  accepted_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- No proposal leaves the building without a named human approver.
  constraint proposals_sent_requires_approval check (status not in ('sent', 'accepted') or approved_by is not null)
);
create trigger proposals_touch before update on public.proposals
  for each row execute function app_private.touch_updated_at();

create table public.proposal_line_items (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals (id) on delete cascade,
  service_id uuid references public.services (id) on delete set null,
  package_id uuid references public.service_packages (id) on delete set null,
  description text not null,
  quantity numeric(8, 2) not null default 1 check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  billing_model public.billing_model not null default 'fixed',
  is_optional boolean not null default false,
  sort integer not null default 0
);

create table public.engagements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  proposal_id uuid references public.proposals (id) on delete set null,
  package_id uuid references public.service_packages (id) on delete set null,
  kind text not null check (kind in ('project', 'retainer', 'program')),
  status text not null default 'pending' check (status in ('pending', 'active', 'paused', 'completed', 'cancelled')),
  starts_on date,
  ends_on date,
  min_term_months smallint,
  monthly_fee_cents integer check (monthly_fee_cents >= 0),
  one_time_fee_cents integer check (one_time_fee_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger engagements_touch before update on public.engagements
  for each row execute function app_private.touch_updated_at();

create table public.engagement_scopes (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements (id) on delete cascade,
  period_start date not null,
  period_end date not null check (period_end > period_start),
  allowances jsonb not null default '[]'::jsonb,
  usage jsonb not null default '{}'::jsonb,
  unique (engagement_id, period_start)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  engagement_id uuid references public.engagements (id) on delete set null,
  provider text not null check (provider in ('stripe', 'manual')),
  provider_subscription_id text unique,
  status text not null,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  engagement_id uuid references public.engagements (id) on delete set null,
  provider text not null check (provider in ('stripe', 'manual')),
  provider_invoice_id text unique,
  kind text not null check (kind in ('one_time', 'recurring')),
  status text not null check (status in ('draft', 'open', 'paid', 'void', 'uncollectible')),
  amount_due_cents integer not null check (amount_due_cents >= 0),
  amount_paid_cents integer not null default 0 check (amount_paid_cents >= 0),
  currency char(3) not null default 'usd',
  due_on date,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  engagement_id uuid references public.engagements (id) on delete set null,
  name text not null,
  status text not null default 'planned' check (status in ('planned', 'active', 'on_hold', 'completed', 'cancelled')),
  due_on date,
  created_at timestamptz not null default now()
);

create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  engagement_id uuid references public.engagements (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  requested_by uuid references public.profiles (id) on delete set null,
  deliverable_type text not null,
  title text not null,
  brief jsonb not null default '{}'::jsonb,
  status text not null default 'submitted' check (status in (
    'submitted', 'scoping', 'awaiting_client_approval', 'in_production', 'internal_review',
    'client_review', 'revisions', 'approved', 'delivered', 'cancelled')),
  in_scope boolean,
  overage_cents integer,
  overage_approved_at timestamptz,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  due_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_requests_overage_approved check (
    coalesce(overage_cents, 0) = 0 or status in ('submitted', 'scoping', 'awaiting_client_approval', 'cancelled') or overage_approved_at is not null
  )
);

create table public.production_workflows (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  version integer not null default 1,
  name text not null,
  deliverable_type text not null,
  steps jsonb not null,
  created_at timestamptz not null default now(),
  unique (key, version)
);

create table public.production_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  service_request_id uuid references public.service_requests (id) on delete set null,
  workflow_id uuid references public.production_workflows (id) on delete set null,
  status text not null default 'queued' check (status in ('queued', 'briefing', 'making', 'rendering', 'reviewing', 'fixing', 'shipped', 'blocked', 'cancelled')),
  brief jsonb not null default '{}'::jsonb,
  assigned_to uuid references public.profiles (id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.deliverables (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  production_job_id uuid references public.production_jobs (id) on delete set null,
  service_request_id uuid references public.service_requests (id) on delete set null,
  title text not null,
  deliverable_type text not null,
  status text not null default 'draft' check (status in ('draft', 'internal_review', 'client_review', 'approved', 'delivered')),
  -- Ship levels from the brand guide: L1 internal draft, L2 client review, L3 release.
  ship_level text not null default 'L1' check (ship_level in ('L1', 'L2', 'L3')),
  created_at timestamptz not null default now()
);

create table public.deliverable_versions (
  id uuid primary key default gen_random_uuid(),
  deliverable_id uuid not null references public.deliverables (id) on delete cascade,
  version integer not null check (version > 0),
  file_id uuid references public.files (id) on delete set null,
  notes text,
  qa_results jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (deliverable_id, version)
);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  subject_type text not null,
  subject_id uuid not null,
  approval_kind text not null check (approval_kind in ('internal_review', 'client_approval', 'overage', 'fact_change', 'proposal', 'outreach')),
  requested_from_user_id uuid references public.profiles (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'changes_requested', 'rejected')),
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  constraint approvals_decided check (status = 'pending' or (decided_by is not null and decided_at is not null))
);
create index approvals_pending on public.approvals (organization_id, status) where status = 'pending';

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  subject_type text not null,
  subject_id uuid not null,
  author_user_id uuid references public.profiles (id) on delete set null,
  body text not null check (length(body) between 1 and 10000),
  visibility public.visibility not null default 'internal',
  created_at timestamptz not null default now()
);
create index comments_subject on public.comments (subject_type, subject_id, created_at);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  company_id uuid references public.companies (id) on delete set null,
  name text not null,
  kind text not null check (kind in ('thought_leadership', 'product_launch', 'event', 'email', 'announcement', 'other')),
  status text not null default 'planning' check (status in ('planning', 'active', 'completed', 'cancelled')),
  objectives text,
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now()
);

create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  campaign_id uuid references public.campaigns (id) on delete set null,
  channel text not null check (channel in ('linkedin_company', 'linkedin_executive', 'email', 'blog', 'event', 'video', 'other')),
  content_pillar text,
  title text not null,
  body text,
  scheduled_for timestamptz,
  status text not null default 'idea' check (status in ('idea', 'drafting', 'internal_review', 'client_review', 'approved', 'scheduled', 'published', 'exported')),
  approval_id uuid references public.approvals (id) on delete set null,
  published_at timestamptz,
  external_url text,
  created_at timestamptz not null default now()
);

create table public.performance_metrics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  subject_type text not null,
  subject_id uuid,
  metric text not null,
  value numeric not null,
  period_start date not null,
  period_end date not null,
  source text not null,
  recorded_at timestamptz not null default now()
);

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete set null,
  engagement_id uuid references public.engagements (id) on delete set null,
  service_request_id uuid references public.service_requests (id) on delete set null,
  kind text not null check (kind in ('production', 'review', 'revision', 'strategy', 'admin', 'sales')),
  minutes integer not null check (minutes > 0 and minutes <= 1440),
  worked_on date not null,
  notes text,
  created_at timestamptz not null default now()
);
