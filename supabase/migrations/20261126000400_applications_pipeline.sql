-- Applications (collect once, reuse everywhere) and the sales pipeline.

create type public.application_status as enum (
  'draft', 'submitted', 'under_review', 'needs_information', 'accepted', 'declined', 'withdrawn'
);

create type public.pipeline_stage as enum (
  'identified', 'invited', 'application_started', 'application_submitted',
  'research_in_progress', 'assessment_in_progress', 'assessment_reviewed', 'qualified',
  'discovery_scheduled', 'discovery_completed', 'proposal_generated', 'proposal_sent',
  'negotiation', 'closed_won', 'closed_lost', 'nurture', 'active_client'
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  company_id uuid references public.companies (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  status public.application_status not null default 'draft',
  current_stage smallint not null default 1 check (current_stage between 1 and 7),
  completed_stages smallint[] not null default '{}',
  submitted_at timestamptz,
  decision_reason text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  consent_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint applications_submitted_has_time check (status = 'draft' or submitted_at is not null)
);
create index applications_org on public.applications (organization_id);
create index applications_status on public.applications (status, submitted_at desc);
create trigger applications_touch before update on public.applications
  for each row execute function app_private.touch_updated_at();

alter table public.files add constraint files_application_fk
  foreign key (application_id) references public.applications (id) on delete set null;
alter table public.credentials add constraint credentials_application_fk
  foreign key (application_id) references public.applications (id) on delete set null;
alter table public.assessments add constraint assessments_application_fk
  foreign key (application_id) references public.applications (id) on delete set null;

create table public.application_answers (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  question_key text not null check (question_key ~ '^[a-z0-9_]+$'),
  value jsonb not null,
  provenance public.provenance not null default 'submitted',
  -- Extracted/imported values must be confirmed by the applicant before use.
  confirmed boolean not null default true,
  source_file_id uuid references public.files (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (application_id, question_key)
);

-- Client-visible status history (what the applicant sees in the portal).
create table public.application_status_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  from_status public.application_status,
  to_status public.application_status not null,
  note text,
  actor_user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index application_status_history_app on public.application_status_history (application_id, created_at);

-- ---------------------------------------------------------------------------
-- Pipeline
-- ---------------------------------------------------------------------------
create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  application_id uuid references public.applications (id) on delete set null,
  title text not null,
  stage public.pipeline_stage not null default 'identified',
  owner_user_id uuid references public.profiles (id) on delete set null,
  source text not null default 'application' check (source in ('application', 'assessment', 'prospecting', 'referral', 'inbound', 'event', 'other')),
  source_detail text,
  estimated_contract_value_cents integer check (estimated_contract_value_cents >= 0),
  estimated_mrr_cents integer check (estimated_mrr_cents >= 0),
  probability smallint check (probability between 0 and 100),
  next_action text,
  next_action_due date,
  -- Sales qualification is deliberately separate from commercial readiness.
  qualification jsonb not null default '{}'::jsonb,
  qualification_score smallint check (qualification_score between 0 and 100),
  coi_status text not null default 'pending' check (coi_status in ('not_required', 'pending', 'cleared', 'blocked')),
  lost_reason text,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- One open opportunity per company: prevents duplicate pipeline records.
create unique index opportunities_one_open_per_company on public.opportunities (company_id) where closed_at is null;
create index opportunities_stage on public.opportunities (stage);
create trigger opportunities_touch before update on public.opportunities
  for each row execute function app_private.touch_updated_at();

create table public.pipeline_activities (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references public.opportunities (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  kind text not null check (kind in ('note', 'task', 'stage_change', 'email', 'call', 'meeting', 'system')),
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  actor_user_id uuid references public.profiles (id) on delete set null,
  assignee_user_id uuid references public.profiles (id) on delete set null,
  due_on date,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index pipeline_activities_company on public.pipeline_activities (company_id, created_at desc);
create index pipeline_activities_open_tasks on public.pipeline_activities (assignee_user_id, due_on) where kind = 'task' and completed_at is null;

create table public.saved_filters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  scope text not null,
  name text not null,
  filters jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, scope, name)
);

create table public.conflict_of_interest_reviews (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references public.opportunities (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'cleared', 'blocked')),
  checklist jsonb not null default '{}'::jsonb,
  notes text,
  reviewer_user_id uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint coi_decided_has_reviewer check (status = 'pending' or (reviewer_user_id is not null and reviewed_at is not null))
);

-- Outreach controls: suppression, opt-outs, human-approved communications only.
create table public.suppression_list (
  id uuid primary key default gen_random_uuid(),
  email citext,
  domain citext,
  reason text not null check (reason in ('opt_out', 'bounce', 'complaint', 'manual', 'conflict_of_interest')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (email is not null or domain is not null)
);
create unique index suppression_list_email on public.suppression_list (email) where email is not null;
create unique index suppression_list_domain on public.suppression_list (domain) where domain is not null;

create table public.communications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  contact_id uuid references public.company_contacts (id) on delete set null,
  direction text not null check (direction in ('outbound', 'inbound')),
  channel text not null check (channel in ('email', 'linkedin', 'phone', 'meeting', 'other')),
  subject text,
  body text,
  status text not null default 'draft' check (status in ('draft', 'approved', 'sent', 'failed', 'logged')),
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  sent_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint communications_sent_requires_approval check (
    status <> 'sent' or direction = 'inbound' or approved_by is not null
  )
);
