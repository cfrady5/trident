# Database

PostgreSQL schema in `supabase/migrations/*.sql` (Supabase-compatible). Apply with `npm run db:migrate` (tracks `trident_meta.migrations`) or `supabase db push`.

## Migrations

| File | Contents |
|---|---|
| `…0100_foundation` | extensions, `app_private` schema, role enums, `profiles` (1:1 `auth.users`, created by trigger), `organizations` (exactly one `internal`), `organization_memberships` (role/kind check trigger), authorization helpers, append-only `audit_events` and `consent_records`, `notifications` |
| `…0200_companies_intelligence` | provenance / verification / approval / visibility enums, `companies` (unique live domain), `company_contacts`, `files`, `intelligence_sources`, `company_facts`, `company_intelligence_records`, `credentials`, `products`, `markets`, `competitors`, `buyer_personas`, `brand_profiles`, `brand_assets` |
| `…0300_catalog_assessment` | `service_categories`, `services`, `service_dependencies`, `service_packages`, `assessment_frameworks` (versioned, one active), `assessment_criteria`, `assessments`, `assessment_results` |
| `…0400_applications_pipeline` | `applications`, `application_answers`, `application_status_history`, `opportunities` (one open per company), `pipeline_activities` (notes, tasks, stage changes), `saved_filters`, `conflict_of_interest_reviews`, `suppression_list`, `communications` |
| `…0500_engagements_production` | `proposals`, `proposal_line_items`, `engagements`, `engagement_scopes`, `subscriptions`, `invoices`, `projects`, `service_requests`, `production_workflows`, `production_jobs`, `deliverables`, `deliverable_versions`, `approvals`, `comments`, `campaigns`, `content_items`, `performance_metrics`, `time_entries` |
| `…0600_automation` | `domain_events` (unique idempotency key), `jobs`, `automation_runs`, `ai_executions`, private `rate_limits`, `local_auth_tokens`, `dev_outbox`, `data_requests` |
| `…0700_rls` | RLS on **every** public table, grants, default privileges, all policies, guard trigger, `request_file_deletion()` |
| `…0800_inquiries` | `inquiries` (contact + proposal requests) |

`supabase/local/bootstrap.sql` is applied **only to local databases**: it creates the `anon`, `authenticated`, `service_role` roles, a minimal `auth.users` and `auth.uid()/role()/jwt()` matching Supabase.

## Fact model (company intelligence)

`company_facts` stores one row per (company, section, key, provenance) **current** version, with history via `supersedes_id` / `version` / `is_current`.

| Field | Values |
|---|---|
| `provenance` | `submitted` · `extracted` · `imported` · `researched` · `ai_generated` · `staff_entered` |
| `verification_status` | `unverified` · `self_reported` · `source_linked` · `verified` · `disputed` · `rejected` |
| `approval_status` | `pending` · `approved` · `rejected` · `superseded` |
| `visibility` | `internal` · `client` · `public` |
| also | `source_id` → `intelligence_sources`, `collected_at`, `last_verified_at`, `confidence`, `approved_by/at` |

Constraint `company_facts_ai_needs_human`: an `ai_generated` fact can only be `approved` with an `approved_by`. Raw submitted, extracted, researched, AI-generated and client-approved intelligence therefore stay distinguishable.

`credentials` carry their own source, date, provenance and verification; `verified` requires `verified_by` + `verified_at` (constraint).

## Roles and tenancy

- Internal roles (only in the internal org): `platform_owner`, `administrator`, `business_development`, `strategist`, `creative_producer`, `reviewer`, `finance`.
- Client roles (only in client orgs): `client_admin`, `client_contributor`, `client_viewer`.
- Helpers (SECURITY DEFINER, `search_path=''`): `app_private.staff_roles()`, `is_staff()`, `has_staff_role(…)` (owner/admin always pass), `is_org_member(org)`, `has_org_role(org, …)`, `is_company_member(company)`, `application_editable(app)`.

## RLS summary

| Area | Client members | Staff | Anon |
|---|---|---|---|
| Catalog, active framework | read published | read all; **finance/admin** write | read published |
| Organizations, memberships | own org(s) | read; admin writes | — |
| Applications | read own org; insert draft; update only while draft/needs_information; guard trigger blocks status/review fields | read; BD/strategist/reviewer update | — |
| Answers | read; write while editable (`updated_by = auth.uid()`) | read/write | — |
| Files | read own org (not deleted); insert **only** quarantined/pending; delete via `request_file_deletion()` | read; reviewers release/hold/delete | — |
| Companies, facts, credentials… | read own company; facts only if `visibility <> internal` | read; role-scoped writes | — |
| Opportunities, activities, COI, suppression, communications, inquiries | **none** | read; BD/strategist write | — |
| Events, jobs, automation runs, AI executions | **none** | read only (system writes) | — |
| Audit events | none | read (most roles); insert own | — |
| Proposals | read only once `sent`+ | write | — |
| Invoices, subscriptions | `client_admin` read | finance | — |

The guard trigger `guard_application_update` is **SECURITY INVOKER** on purpose — a SECURITY DEFINER version would see the owner role and allow escalation (caught by `tests/db/rls.test.ts`).

## Key constraints and lifecycle rules

- `companies_domain_unique` (live, non-null domain) — duplicate prevention; cross-tenant domain collisions are never merged, they're flagged as a pipeline activity.
- `opportunities_one_open_per_company` (where `closed_at is null`).
- `applications_submitted_has_time`, `coi_decided_has_reviewer`, `approvals_decided`, `communications_sent_requires_approval`, `proposals_sent_requires_approval`, `service_requests_overage_approved`.
- `audit_events` and `consent_records` are append-only (trigger + revoked privileges).
- `assessment_frameworks_one_active` per key; criteria are attached to a framework version, so results stay reproducible.

## Seed

`npm run db:seed` (idempotent, insert-only): internal Trident org, 10 categories, 19 services (`price_status = proposed`), related-service links, 4 plans, readiness framework v1 (6 categories, 16 criteria). **No demo companies, metrics or testimonials are seeded.** Edit prices afterwards in `/command/catalog`.

## Retention (planned defaults, `[CONFIRM]`)

Draft applications inactive 24 months → delete; `rate_limits` pruned after a day; `local_auth_tokens` expire in 15 minutes; dev outbox is dev-only. Automated retention jobs are a Phase 2 item (see ROADMAP.md).
