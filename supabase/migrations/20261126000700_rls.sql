-- Row Level Security. Deny by default: RLS is enabled on every public table and
-- access is granted only by the policies below. A test (tests/db) asserts that
-- no public table is left without RLS.

do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
-- Supabase grants these by default; declare them so local and hosted match and
-- tables added by later migrations are covered. RLS remains the gate.
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to authenticated, service_role;
revoke all on all tables in schema app_private from anon, authenticated;
grant all on all tables in schema app_private to service_role;
-- Append-only tables: no updates/deletes for client roles at the privilege layer too.
revoke update, delete on public.audit_events, public.consent_records from authenticated;

-- ---------------------------------------------------------------------------
-- Helper predicates over companies
-- ---------------------------------------------------------------------------
create or replace function app_private.company_org(cid uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select organization_id from public.companies where id = cid
$$;

create or replace function app_private.is_company_member(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(app_private.is_org_member(app_private.company_org(cid)), false)
$$;

create or replace function app_private.application_org(aid uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select organization_id from public.applications where id = aid
$$;

create or replace function app_private.application_editable(aid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.applications a
    where a.id = aid
      and a.status in ('draft', 'needs_information')
      and app_private.has_org_role(a.organization_id, 'client_admin', 'client_contributor')
  )
$$;
grant execute on all functions in schema app_private to authenticated, service_role;

-- True when the current statement runs as an end user (not system/service code).
create or replace function app_private.is_end_user() returns boolean
language sql stable as $$
  select current_user in ('authenticated', 'anon')
$$;

-- ---------------------------------------------------------------------------
-- Profiles, organizations, memberships
-- ---------------------------------------------------------------------------
create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid()
  or app_private.is_staff()
  or exists (
    select 1 from public.organization_memberships mine
    join public.organization_memberships theirs on theirs.organization_id = mine.organization_id
    where mine.user_id = auth.uid() and theirs.user_id = profiles.id
  )
);
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy organizations_select on public.organizations for select to authenticated
  using (app_private.is_org_member(id) or app_private.is_staff());
create policy organizations_write on public.organizations for all to authenticated
  using (app_private.has_staff_role('administrator')) with check (app_private.has_staff_role('administrator'));

create policy memberships_select on public.organization_memberships for select to authenticated using (
  user_id = auth.uid()
  or app_private.is_staff()
  or app_private.has_org_role(organization_id, 'client_admin')
);
create policy memberships_write on public.organization_memberships for all to authenticated
  using (app_private.has_staff_role('administrator')) with check (app_private.has_staff_role('administrator'));

-- ---------------------------------------------------------------------------
-- Audit, consent, notifications, data requests
-- ---------------------------------------------------------------------------
create policy audit_select on public.audit_events for select to authenticated
  using (app_private.has_staff_role('administrator', 'finance', 'reviewer', 'business_development', 'strategist'));
create policy audit_insert on public.audit_events for insert to authenticated
  with check (actor_user_id = auth.uid() and actor_type = 'user');

create policy consent_select on public.consent_records for select to authenticated
  using (user_id = auth.uid() or app_private.is_staff());
create policy consent_insert on public.consent_records for insert to authenticated
  with check (user_id = auth.uid());

create policy notifications_own on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_mark_read on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy data_requests_own on public.data_requests for select to authenticated
  using (user_id = auth.uid() or app_private.has_staff_role('administrator'));
create policy data_requests_insert on public.data_requests for insert to authenticated
  with check (user_id = auth.uid() and status = 'requested');
create policy data_requests_staff on public.data_requests for update to authenticated
  using (app_private.has_staff_role('administrator')) with check (true);

-- ---------------------------------------------------------------------------
-- Companies and intelligence
-- ---------------------------------------------------------------------------
create policy companies_select on public.companies for select to authenticated
  using (app_private.is_staff() or app_private.is_org_member(organization_id));
create policy companies_staff_write on public.companies for all to authenticated
  using (app_private.has_staff_role('business_development', 'strategist'))
  with check (app_private.has_staff_role('business_development', 'strategist'));

create policy company_contacts_select on public.company_contacts for select to authenticated
  using (app_private.is_staff() or app_private.is_company_member(company_id));
create policy company_contacts_staff on public.company_contacts for all to authenticated
  using (app_private.has_staff_role('business_development', 'strategist'))
  with check (app_private.has_staff_role('business_development', 'strategist'));

-- Client members see only non-internal facts about their own company.
create policy company_facts_select on public.company_facts for select to authenticated using (
  app_private.is_staff()
  or (app_private.is_company_member(company_id) and visibility <> 'internal')
);
create policy company_facts_staff on public.company_facts for all to authenticated
  using (app_private.has_staff_role('strategist', 'business_development', 'reviewer'))
  with check (app_private.has_staff_role('strategist', 'business_development', 'reviewer'));

do $$
declare t text;
begin
  foreach t in array array['intelligence_sources', 'company_intelligence_records'] loop
    execute format($f$create policy %1$s_staff_select on public.%1$I for select to authenticated using (app_private.is_staff())$f$, t);
    execute format($f$create policy %1$s_staff_write on public.%1$I for all to authenticated
      using (app_private.has_staff_role('strategist', 'business_development', 'reviewer'))
      with check (app_private.has_staff_role('strategist', 'business_development', 'reviewer'))$f$, t);
  end loop;
  foreach t in array array['credentials', 'products', 'markets', 'competitors', 'buyer_personas', 'brand_profiles', 'brand_assets'] loop
    execute format($f$create policy %1$s_select on public.%1$I for select to authenticated
      using (app_private.is_staff() or app_private.is_company_member(company_id))$f$, t);
    execute format($f$create policy %1$s_staff_write on public.%1$I for all to authenticated
      using (app_private.has_staff_role('strategist', 'business_development', 'reviewer', 'creative_producer'))
      with check (app_private.has_staff_role('strategist', 'business_development', 'reviewer', 'creative_producer'))$f$, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Files: clients can upload into their own organization, only as quarantined.
-- Release/review is staff-only. Client deletion goes through request_file_deletion().
-- ---------------------------------------------------------------------------
create policy files_select on public.files for select to authenticated using (
  app_private.is_staff()
  or (deleted_at is null and app_private.is_org_member(organization_id))
);
create policy files_client_insert on public.files for insert to authenticated with check (
  uploaded_by = auth.uid()
  and app_private.has_org_role(organization_id, 'client_admin', 'client_contributor')
  and quarantine_status = 'quarantined'
  and scan_status = 'pending'
  and reviewed_by is null
  and (application_id is null or app_private.application_org(application_id) = organization_id)
);
create policy files_staff_write on public.files for update to authenticated
  using (app_private.has_staff_role('reviewer', 'strategist', 'creative_producer'))
  with check (app_private.has_staff_role('reviewer', 'strategist', 'creative_producer'));

create or replace function app_private.request_file_deletion(fid uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare f public.files;
begin
  select * into f from public.files where id = fid and deleted_at is null;
  if not found then return false; end if;
  if not (app_private.is_staff()
          or app_private.has_org_role(f.organization_id, 'client_admin')
          or (f.uploaded_by = auth.uid() and app_private.has_org_role(f.organization_id, 'client_contributor'))) then
    raise exception 'not authorized to delete this file' using errcode = '42501';
  end if;
  update public.files set deleted_at = now(), quarantine_status = 'deleted' where id = fid;
  return true;
end $$;
grant execute on function app_private.request_file_deletion(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Catalog (public read) and assessment framework (public read)
-- ---------------------------------------------------------------------------
grant select on public.services, public.service_categories, public.service_packages,
  public.service_dependencies, public.assessment_frameworks, public.assessment_criteria to anon;

create policy service_categories_read on public.service_categories for select to anon, authenticated using (true);
create policy services_read on public.services for select to anon, authenticated
  using (is_published or app_private.is_staff());
create policy service_packages_read on public.service_packages for select to anon, authenticated
  using (is_published or app_private.is_staff());
create policy service_dependencies_read on public.service_dependencies for select to anon, authenticated using (true);

do $$
declare t text;
begin
  foreach t in array array['services', 'service_categories', 'service_packages', 'service_dependencies'] loop
    execute format($f$create policy %1$s_pricing_admin on public.%1$I for all to authenticated
      using (app_private.has_staff_role('finance')) with check (app_private.has_staff_role('finance'))$f$, t);
  end loop;
end $$;

create policy assessment_frameworks_read on public.assessment_frameworks for select to anon, authenticated
  using (status = 'active' or app_private.is_staff());
create policy assessment_criteria_read on public.assessment_criteria for select to anon, authenticated
  using (exists (select 1 from public.assessment_frameworks f where f.id = framework_id and (f.status = 'active' or app_private.is_staff())));
create policy assessment_frameworks_admin on public.assessment_frameworks for all to authenticated
  using (app_private.has_staff_role('strategist')) with check (app_private.has_staff_role('strategist'));
create policy assessment_criteria_admin on public.assessment_criteria for all to authenticated
  using (app_private.has_staff_role('strategist')) with check (app_private.has_staff_role('strategist'));

create policy assessments_select on public.assessments for select to authenticated using (
  app_private.is_staff() or user_id = auth.uid() or app_private.is_org_member(organization_id)
);
create policy assessments_staff on public.assessments for update to authenticated
  using (app_private.has_staff_role('strategist', 'reviewer')) with check (app_private.has_staff_role('strategist', 'reviewer'));
create policy assessment_results_select on public.assessment_results for select to authenticated using (
  exists (select 1 from public.assessments a where a.id = assessment_id
          and (app_private.is_staff() or a.user_id = auth.uid() or app_private.is_org_member(a.organization_id)))
);
create policy assessment_results_staff on public.assessment_results for all to authenticated
  using (app_private.has_staff_role('strategist', 'reviewer')) with check (app_private.has_staff_role('strategist', 'reviewer'));

-- ---------------------------------------------------------------------------
-- Applications
-- ---------------------------------------------------------------------------
create policy applications_select on public.applications for select to authenticated
  using (app_private.is_staff() or app_private.is_org_member(organization_id));
create policy applications_client_insert on public.applications for insert to authenticated with check (
  created_by = auth.uid()
  and status = 'draft'
  and company_id is null
  and app_private.has_org_role(organization_id, 'client_admin', 'client_contributor')
);
create policy applications_client_update on public.applications for update to authenticated
  using (app_private.application_editable(id))
  with check (app_private.has_org_role(organization_id, 'client_admin', 'client_contributor'));
create policy applications_staff_update on public.applications for update to authenticated
  using (app_private.has_staff_role('business_development', 'strategist', 'reviewer'))
  with check (app_private.has_staff_role('business_development', 'strategist', 'reviewer'));

-- Clients may only advance stages and submit; review fields are staff-only.
-- SECURITY INVOKER on purpose: it must see the caller's role (current_user) to
-- tell end users from system code. A SECURITY DEFINER guard would always see
-- the owner and silently allow everything (covered by tests/db/rls.test.ts).
create or replace function app_private.guard_application_update() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if not app_private.is_end_user() or app_private.is_staff() then
    return new;
  end if;
  if new.organization_id is distinct from old.organization_id
     or new.company_id is distinct from old.company_id
     or new.created_by is distinct from old.created_by
     or new.reviewed_by is distinct from old.reviewed_by
     or new.reviewed_at is distinct from old.reviewed_at
     or new.decision_reason is distinct from old.decision_reason then
    raise exception 'field not editable by applicant' using errcode = '42501';
  end if;
  if new.status is distinct from old.status
     and not (old.status in ('draft', 'needs_information') and new.status = 'submitted') then
    raise exception 'invalid status transition for applicant' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger applications_guard before update on public.applications
  for each row execute function app_private.guard_application_update();

create policy application_answers_select on public.application_answers for select to authenticated using (
  app_private.is_staff() or app_private.is_org_member(app_private.application_org(application_id))
);
create policy application_answers_client_write on public.application_answers for all to authenticated
  using (app_private.application_editable(application_id))
  with check (app_private.application_editable(application_id) and updated_by = auth.uid());
create policy application_answers_staff on public.application_answers for all to authenticated
  using (app_private.has_staff_role('business_development', 'strategist', 'reviewer'))
  with check (app_private.has_staff_role('business_development', 'strategist', 'reviewer'));

create policy application_history_select on public.application_status_history for select to authenticated using (
  app_private.is_staff() or app_private.is_org_member(app_private.application_org(application_id))
);
create policy application_history_insert on public.application_status_history for insert to authenticated with check (
  actor_user_id = auth.uid()
  and (app_private.has_staff_role('business_development', 'strategist', 'reviewer')
       or (to_status = 'submitted' and app_private.is_org_member(app_private.application_org(application_id))))
);

-- ---------------------------------------------------------------------------
-- Pipeline: internal only
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['opportunities', 'pipeline_activities', 'conflict_of_interest_reviews', 'suppression_list', 'communications'] loop
    execute format($f$create policy %1$s_staff_select on public.%1$I for select to authenticated using (app_private.is_staff())$f$, t);
    execute format($f$create policy %1$s_staff_write on public.%1$I for all to authenticated
      using (app_private.has_staff_role('business_development', 'strategist'))
      with check (app_private.has_staff_role('business_development', 'strategist'))$f$, t);
  end loop;
end $$;

create policy saved_filters_own on public.saved_filters for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and app_private.is_staff());

-- ---------------------------------------------------------------------------
-- Engagements, billing, production, campaigns (Phase 3-5)
-- Client members read their organization's records; staff write.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['engagements', 'projects', 'service_requests', 'production_jobs', 'deliverables',
                           'campaigns', 'content_items', 'performance_metrics', 'approvals'] loop
    execute format($f$create policy %1$s_select on public.%1$I for select to authenticated
      using (app_private.is_staff() or app_private.is_org_member(organization_id))$f$, t);
    execute format($f$create policy %1$s_staff_write on public.%1$I for all to authenticated
      using (app_private.has_staff_role('strategist', 'creative_producer', 'reviewer', 'business_development'))
      with check (app_private.has_staff_role('strategist', 'creative_producer', 'reviewer', 'business_development'))$f$, t);
  end loop;
  foreach t in array array['subscriptions', 'invoices'] loop
    execute format($f$create policy %1$s_select on public.%1$I for select to authenticated
      using (app_private.has_staff_role('finance') or app_private.has_org_role(organization_id, 'client_admin'))$f$, t);
    execute format($f$create policy %1$s_finance on public.%1$I for all to authenticated
      using (app_private.has_staff_role('finance')) with check (app_private.has_staff_role('finance'))$f$, t);
  end loop;
end $$;

create policy proposals_select on public.proposals for select to authenticated using (
  app_private.is_staff()
  or (app_private.is_org_member(organization_id) and status in ('sent', 'accepted', 'declined', 'expired'))
);
create policy proposals_staff on public.proposals for all to authenticated
  using (app_private.has_staff_role('business_development', 'strategist', 'finance'))
  with check (app_private.has_staff_role('business_development', 'strategist', 'finance'));
create policy proposal_line_items_select on public.proposal_line_items for select to authenticated using (
  exists (select 1 from public.proposals p where p.id = proposal_id)
);
create policy proposal_line_items_staff on public.proposal_line_items for all to authenticated
  using (app_private.has_staff_role('business_development', 'strategist', 'finance'))
  with check (app_private.has_staff_role('business_development', 'strategist', 'finance'));

create policy engagement_scopes_select on public.engagement_scopes for select to authenticated using (
  exists (select 1 from public.engagements e where e.id = engagement_id)
);
create policy engagement_scopes_staff on public.engagement_scopes for all to authenticated
  using (app_private.has_staff_role('strategist', 'finance')) with check (app_private.has_staff_role('strategist', 'finance'));

create policy deliverable_versions_select on public.deliverable_versions for select to authenticated using (
  exists (select 1 from public.deliverables d where d.id = deliverable_id)
);
create policy deliverable_versions_staff on public.deliverable_versions for all to authenticated
  using (app_private.has_staff_role('creative_producer', 'reviewer')) with check (app_private.has_staff_role('creative_producer', 'reviewer'));

create policy production_workflows_staff on public.production_workflows for select to authenticated using (app_private.is_staff());
create policy production_workflows_admin on public.production_workflows for all to authenticated
  using (app_private.has_staff_role('creative_producer')) with check (app_private.has_staff_role('creative_producer'));

create policy comments_select on public.comments for select to authenticated using (
  app_private.is_staff() or (visibility <> 'internal' and app_private.is_org_member(organization_id))
);
create policy comments_insert on public.comments for insert to authenticated with check (
  author_user_id = auth.uid()
  and (app_private.is_staff() or (visibility = 'client' and app_private.is_org_member(organization_id)))
);

create policy time_entries_select on public.time_entries for select to authenticated
  using (user_id = auth.uid() or app_private.has_staff_role('finance'));
create policy time_entries_own on public.time_entries for insert to authenticated
  with check (user_id = auth.uid() and app_private.is_staff());

-- ---------------------------------------------------------------------------
-- Automation: read-only for staff; written only by system code.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['domain_events', 'jobs', 'automation_runs', 'ai_executions'] loop
    execute format($f$create policy %1$s_staff_select on public.%1$I for select to authenticated using (app_private.is_staff())$f$, t);
    execute format('revoke insert, update, delete on public.%I from authenticated', t);
  end loop;
end $$;
