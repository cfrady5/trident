-- Company intelligence: the single authoritative profile every module reads from.

create type public.provenance as enum ('submitted', 'extracted', 'imported', 'researched', 'ai_generated', 'staff_entered');
create type public.verification_status as enum ('unverified', 'self_reported', 'source_linked', 'verified', 'disputed', 'rejected');
create type public.approval_status as enum ('pending', 'approved', 'rejected', 'superseded');
create type public.visibility as enum ('internal', 'client', 'public');
create type public.source_type as enum ('application', 'document', 'website', 'public_record', 'staff', 'ai', 'import', 'client');
create type public.confidence_level as enum ('low', 'medium', 'high');
create type public.contact_permission as enum ('unknown', 'transactional_only', 'opted_in', 'opted_out');
create type public.credential_type as enum (
  'sbir_award', 'sttr_award', 'marketplace_selection', 'contract', 'funding_round',
  'patent', 'certification', 'milestone', 'other'
);
create type public.scan_status as enum ('pending', 'clean', 'flagged', 'infected', 'error');
create type public.quarantine_status as enum ('quarantined', 'released', 'held_for_review', 'deleted');

-- ---------------------------------------------------------------------------
-- Companies
-- ---------------------------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete set null,
  name text not null check (length(name) between 1 and 200),
  normalized_name text not null,
  slug citext not null unique,
  website text,
  domain citext,
  linkedin_url text,
  industry text,
  headquarters text,
  employee_range text,
  maturity text,
  description text,
  merged_into_id uuid references public.companies (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Duplicate prevention: one live company per domain.
create unique index companies_domain_unique on public.companies (domain) where domain is not null and merged_into_id is null;
create index companies_normalized_name on public.companies (normalized_name);
create index companies_org on public.companies (organization_id);
create trigger companies_touch before update on public.companies
  for each row execute function app_private.touch_updated_at();

create table public.company_contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  full_name text not null,
  role_title text,
  email citext,
  phone text,
  is_primary boolean not null default false,
  contact_permission public.contact_permission not null default 'unknown',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, email)
);
create trigger company_contacts_touch before update on public.company_contacts
  for each row execute function app_private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Files (metadata; bytes live in Supabase Storage or the local dev driver)
-- ---------------------------------------------------------------------------
create table public.files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  company_id uuid references public.companies (id) on delete set null,
  application_id uuid,
  uploaded_by uuid references public.profiles (id) on delete set null,
  bucket text not null,
  storage_path text not null unique,
  original_name text not null,
  content_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  sha256 text not null,
  category text not null default 'other',
  scan_status public.scan_status not null default 'pending',
  quarantine_status public.quarantine_status not null default 'quarantined',
  screening_notes jsonb not null default '[]'::jsonb,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index files_org on public.files (organization_id);
create index files_application on public.files (application_id);

-- ---------------------------------------------------------------------------
-- Intelligence
-- ---------------------------------------------------------------------------
create table public.intelligence_sources (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  source_type public.source_type not null,
  title text not null,
  url text,
  file_id uuid references public.files (id) on delete set null,
  publisher text,
  published_on date,
  retrieved_at timestamptz not null default now(),
  notes text,
  created_by uuid references public.profiles (id) on delete set null
);
create index intelligence_sources_company on public.intelligence_sources (company_id);

-- Every significant fact: source, provenance, confidence, verification, approval,
-- visibility and version history (supersedes_id chain).
create table public.company_facts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  section text not null check (section in (
    'corporate_identity', 'technology', 'product', 'market', 'competitor', 'buyer_persona',
    'credential', 'objectives', 'brand', 'messaging', 'digital_assets', 'content_history',
    'engagement_history', 'preferences', 'performance'
  )),
  fact_key text not null,
  value jsonb not null,
  provenance public.provenance not null,
  source_id uuid references public.intelligence_sources (id) on delete set null,
  source_note text,
  collected_at timestamptz not null default now(),
  last_verified_at timestamptz,
  confidence public.confidence_level,
  verification_status public.verification_status not null default 'unverified',
  approval_status public.approval_status not null default 'pending',
  visibility public.visibility not null default 'internal',
  version integer not null default 1 check (version > 0),
  supersedes_id uuid references public.company_facts (id) on delete set null,
  is_current boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  -- AI output can never be stored as approved without a human approver.
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  constraint company_facts_ai_needs_human check (
    provenance <> 'ai_generated' or approval_status <> 'approved' or approved_by is not null
  )
);
create unique index company_facts_current on public.company_facts (company_id, section, fact_key, provenance) where is_current;
create index company_facts_company on public.company_facts (company_id, section);

-- Snapshots and reports produced by research/intelligence workflows.
create table public.company_intelligence_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  kind text not null check (kind in ('research_report', 'profile_snapshot', 'website_analysis', 'document_extraction')),
  status text not null default 'draft' check (status in ('draft', 'needs_review', 'reviewed', 'archived')),
  content jsonb not null default '{}'::jsonb,
  automation_run_id uuid,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index company_intelligence_records_company on public.company_intelligence_records (company_id, created_at desc);

create table public.credentials (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  credential_type public.credential_type not null,
  title text not null,
  agency text,
  program text,
  phase text,
  identifier text,
  awarded_on date,
  amount_usd numeric(14, 2),
  source_url text,
  source_id uuid references public.intelligence_sources (id) on delete set null,
  provenance public.provenance not null default 'submitted',
  verification_status public.verification_status not null default 'self_reported',
  verified_at timestamptz,
  verified_by uuid references public.profiles (id) on delete set null,
  publicly_shareable boolean not null default false,
  notes text,
  application_id uuid,
  created_at timestamptz not null default now(),
  constraint credentials_verified_has_verifier check (
    verification_status <> 'verified' or (verified_by is not null and verified_at is not null)
  )
);
create index credentials_company on public.credentials (company_id);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  description text,
  maturity text,
  commercial_availability text,
  provenance public.provenance not null default 'submitted',
  approval_status public.approval_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table public.markets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  segment text,
  priority smallint,
  notes text,
  provenance public.provenance not null default 'submitted',
  approval_status public.approval_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table public.competitors (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  website text,
  notes text,
  provenance public.provenance not null default 'submitted',
  approval_status public.approval_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table public.buyer_personas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  role_title text,
  needs text,
  objections text,
  provenance public.provenance not null default 'ai_generated',
  approval_status public.approval_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table public.brand_profiles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies (id) on delete cascade,
  colors jsonb not null default '[]'::jsonb,
  fonts jsonb not null default '[]'::jsonb,
  voice_notes text,
  preferences text,
  has_guidelines boolean,
  guidelines_file_id uuid references public.files (id) on delete set null,
  approval_status public.approval_status not null default 'pending',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger brand_profiles_touch before update on public.brand_profiles
  for each row execute function app_private.touch_updated_at();

create table public.brand_assets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete cascade,
  file_id uuid not null references public.files (id) on delete cascade,
  asset_type text not null,
  title text not null,
  version integer not null default 1,
  tags text[] not null default '{}',
  approval_status public.approval_status not null default 'pending',
  created_at timestamptz not null default now()
);
create index brand_assets_company on public.brand_assets (company_id);
