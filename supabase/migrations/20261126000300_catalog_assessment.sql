-- Service catalog, recurring plans and the Commercial Readiness Index.

create type public.pillar as enum ('position', 'build', 'activate', 'program');
create type public.billing_model as enum ('fixed', 'monthly', 'milestone', 'custom');
-- Prices in the brand guide are [CONFIRM: price]. Track approval explicitly.
create type public.price_status as enum ('proposed', 'approved');

create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  slug citext not null unique,
  name text not null,
  description text,
  sort integer not null default 0
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  slug citext not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  summary text not null,
  description text not null,
  pillar public.pillar not null,
  category_id uuid not null references public.service_categories (id),
  deliverable_types text[] not null default '{}',
  starting_price_cents integer not null check (starting_price_cents >= 0),
  price_status public.price_status not null default 'proposed',
  billing_model public.billing_model not null default 'fixed',
  scope text[] not null default '{}',
  deliverables jsonb not null default '[]'::jsonb,
  turnaround_weeks_min smallint check (turnaround_weeks_min > 0),
  turnaround_weeks_max smallint check (turnaround_weeks_max >= turnaround_weeks_min),
  turnaround_confirmed boolean not null default false,
  included_revisions smallint not null default 1 check (included_revisions >= 0),
  prerequisites text[] not null default '{}',
  add_ons jsonb not null default '[]'::jsonb,
  exclusions text[] not null default '{}',
  production_workflow text,
  required_profile_fields text[] not null default '{}',
  is_published boolean not null default true,
  is_featured boolean not null default false,
  sort integer not null default 0,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index services_pillar on public.services (pillar) where is_published;
create trigger services_touch before update on public.services
  for each row execute function app_private.touch_updated_at();

create table public.service_dependencies (
  service_id uuid not null references public.services (id) on delete cascade,
  depends_on_service_id uuid not null references public.services (id) on delete cascade,
  kind text not null check (kind in ('requires', 'recommended_before', 'related', 'included_in')),
  primary key (service_id, depends_on_service_id, kind),
  check (service_id <> depends_on_service_id)
);

-- Recurring engagement plans. Allowances are bounded by design: no unlimited production.
create table public.service_packages (
  id uuid primary key default gen_random_uuid(),
  slug citext not null unique,
  name text not null,
  summary text not null,
  monthly_price_cents integer not null check (monthly_price_cents > 0),
  price_is_minimum boolean not null default false,
  price_status public.price_status not null default 'proposed',
  min_term_months smallint not null default 3 check (min_term_months > 0),
  allowances jsonb not null default '[]'::jsonb,
  inclusions text[] not null default '{}',
  exclusions text[] not null default '{}',
  overage_terms text,
  meeting_cadence text,
  revision_limit smallint not null default 2,
  production_hours_capacity numeric(6, 1),
  is_published boolean not null default true,
  sort integer not null default 0,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger service_packages_touch before update on public.service_packages
  for each row execute function app_private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Commercial Readiness Index (versioned, configurable, deterministic)
-- ---------------------------------------------------------------------------
create table public.assessment_frameworks (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  version integer not null check (version > 0),
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'retired')),
  categories jsonb not null,
  methodology_note text not null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (key, version)
);
create unique index assessment_frameworks_one_active on public.assessment_frameworks (key) where status = 'active';

create table public.assessment_criteria (
  id uuid primary key default gen_random_uuid(),
  framework_id uuid not null references public.assessment_frameworks (id) on delete cascade,
  category_key text not null,
  key text not null,
  prompt text not null,
  help text,
  weight numeric(6, 3) not null check (weight > 0),
  options jsonb not null,
  improvement text not null,
  service_slugs text[] not null default '{}',
  sort integer not null default 0,
  unique (framework_id, key)
);

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  framework_id uuid not null references public.assessment_frameworks (id),
  user_id uuid references public.profiles (id) on delete set null,
  organization_id uuid references public.organizations (id) on delete cascade,
  company_id uuid references public.companies (id) on delete set null,
  application_id uuid,
  respondent_name text,
  respondent_email citext,
  company_name text,
  company_website text,
  mode text not null default 'self_assessment' check (mode in ('self_assessment', 'automated', 'staff')),
  status text not null default 'completed' check (status in ('in_progress', 'completed', 'under_review', 'reviewed')),
  review_state text not null default 'preliminary' check (review_state in ('preliminary', 'human_reviewed')),
  overall_score numeric(5, 2),
  completeness numeric(5, 4),
  computed jsonb not null default '{}'::jsonb,
  -- Opaque token for the respondent to revisit results without an account (stored hashed).
  access_token_hash text unique,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index assessments_org on public.assessments (organization_id);
create index assessments_company on public.assessments (company_id);

create table public.assessment_results (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  criterion_id uuid not null references public.assessment_criteria (id),
  answer text,
  score numeric(5, 2),
  evidence text,
  explanation text,
  confidence public.confidence_level,
  missing_information text,
  recommendation text,
  service_slugs text[] not null default '{}',
  source text not null default 'respondent' check (source in ('respondent', 'ai_proposed', 'staff')),
  created_at timestamptz not null default now(),
  unique (assessment_id, criterion_id, source)
);
