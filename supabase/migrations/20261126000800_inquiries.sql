-- Public contact inquiries and service shortlists submitted from the marketplace.

create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('contact', 'proposal_request')),
  full_name text not null check (length(full_name) between 1 and 120),
  email citext not null,
  company_name text,
  website text,
  message text check (length(message) <= 5000),
  service_slugs text[] not null default '{}',
  status text not null default 'new' check (status in ('new', 'in_progress', 'converted', 'closed', 'spam')),
  company_id uuid references public.companies (id) on delete set null,
  handled_by uuid references public.profiles (id) on delete set null,
  consent_contact boolean not null,
  created_at timestamptz not null default now()
);
create index inquiries_status on public.inquiries (status, created_at desc);
alter table public.inquiries enable row level security;

create policy inquiries_staff_select on public.inquiries for select to authenticated using (app_private.is_staff());
create policy inquiries_staff_update on public.inquiries for update to authenticated
  using (app_private.has_staff_role('business_development', 'strategist'))
  with check (app_private.has_staff_role('business_development', 'strategist'));
-- Staff read/update under RLS; inserts happen only through the rate-limited server action (system role).
grant select, update on public.inquiries to authenticated;
revoke insert, delete on public.inquiries from authenticated;
grant all on public.inquiries to service_role;
