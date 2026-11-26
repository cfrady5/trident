-- Trident foundation: tenancy, roles, profiles, audit, consent, notifications.
-- Compatible with Supabase (auth.users, auth.uid(), anon/authenticated/service_role).

create extension if not exists citext;
create extension if not exists pgcrypto;

create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.org_kind as enum ('internal', 'client', 'partner');

create type public.member_role as enum (
  'platform_owner', 'administrator', 'business_development', 'strategist',
  'creative_producer', 'reviewer', 'finance',
  'client_admin', 'client_contributor', 'client_viewer'
);

-- ---------------------------------------------------------------------------
-- Shared trigger: updated_at
-- ---------------------------------------------------------------------------
create or replace function app_private.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email citext not null unique,
  full_name text,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deletion_requested_at timestamptz
);
create trigger profiles_touch before update on public.profiles
  for each row execute function app_private.touch_updated_at();

create or replace function app_private.handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, lower(new.email), nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function app_private.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- Organizations and memberships (tenancy boundary)
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  kind public.org_kind not null,
  name text not null check (length(name) between 1 and 200),
  slug citext not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,80}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create trigger organizations_touch before update on public.organizations
  for each row execute function app_private.touch_updated_at();

-- Exactly one internal (Trident) organization.
create unique index organizations_single_internal on public.organizations ((kind)) where kind = 'internal';

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.member_role not null,
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index organization_memberships_user on public.organization_memberships (user_id);

-- Internal roles may only exist in the internal org; client roles only in client/partner orgs.
create or replace function app_private.check_membership_role() returns trigger
language plpgsql security definer set search_path = '' as $$
declare k public.org_kind;
begin
  select kind into k from public.organizations where id = new.organization_id;
  if k = 'internal' and new.role::text like 'client_%' then
    raise exception 'client roles are not valid in the internal organization';
  end if;
  if k <> 'internal' and new.role::text not like 'client_%' then
    raise exception 'internal roles are only valid in the internal organization';
  end if;
  return new;
end $$;
create trigger organization_memberships_role_check before insert or update on public.organization_memberships
  for each row execute function app_private.check_membership_role();

-- ---------------------------------------------------------------------------
-- Authorization helpers used by RLS policies. SECURITY DEFINER so they can read
-- memberships without recursive RLS evaluation. search_path pinned to ''.
-- ---------------------------------------------------------------------------
create or replace function app_private.staff_roles() returns public.member_role[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(m.role), '{}')
  from public.organization_memberships m
  join public.organizations o on o.id = m.organization_id
  where m.user_id = auth.uid() and o.kind = 'internal' and o.archived_at is null
$$;

create or replace function app_private.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select cardinality(app_private.staff_roles()) > 0
$$;

-- platform_owner and administrator satisfy every staff-role check.
create or replace function app_private.has_staff_role(variadic roles public.member_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select app_private.staff_roles() && (roles || array['platform_owner', 'administrator']::public.member_role[])
$$;

create or replace function app_private.is_org_member(org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_memberships m
    where m.organization_id = org and m.user_id = auth.uid()
  )
$$;

create or replace function app_private.has_org_role(org uuid, variadic roles public.member_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_memberships m
    where m.organization_id = org and m.user_id = auth.uid() and m.role = any (roles)
  )
$$;

grant execute on all functions in schema app_private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Audit trail (append-only)
-- ---------------------------------------------------------------------------
create table public.audit_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_user_id uuid references public.profiles (id) on delete set null,
  actor_type text not null check (actor_type in ('user', 'system', 'job')),
  action text not null check (action ~ '^[a-z_]+\.[a-z_.]+$'),
  entity_type text not null,
  entity_id uuid,
  organization_id uuid references public.organizations (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  request_id text
);
create index audit_events_entity on public.audit_events (entity_type, entity_id, occurred_at desc);
create index audit_events_org on public.audit_events (organization_id, occurred_at desc);

create or replace function app_private.prevent_mutation() returns trigger
language plpgsql as $$
begin
  raise exception '% is append-only', tg_table_name;
end $$;
create trigger audit_events_append_only before update or delete on public.audit_events
  for each row execute function app_private.prevent_mutation();

-- ---------------------------------------------------------------------------
-- Consent records (versioned, append-only)
-- ---------------------------------------------------------------------------
create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  email citext,
  organization_id uuid references public.organizations (id) on delete cascade,
  subject_type text not null,
  subject_id uuid,
  consent_key text not null,
  consent_version text not null,
  granted boolean not null,
  statement text not null,
  created_at timestamptz not null default now()
);
create index consent_records_subject on public.consent_records (subject_type, subject_id);
create trigger consent_records_append_only before update or delete on public.consent_records
  for each row execute function app_private.prevent_mutation();

-- ---------------------------------------------------------------------------
-- In-app notifications
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user on public.notifications (user_id, created_at desc) where read_at is null;
