# Architecture

One application, one company intelligence profile, one data model. Nine product modules share the same Postgres schema and the same server-side authorization.

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16.4 App Router, React 19.2, TypeScript strict (`noUncheckedIndexedAccess`) | Server Components by default; Server Actions for mutations; `proxy.ts` (formerly middleware) only refreshes Supabase sessions |
| Styling | Tailwind CSS 4 (`@theme` tokens) | Fonts self-hosted via `@fontsource` |
| Database | PostgreSQL (Supabase in production, local Postgres 16 in development/tests) | Accessed with `postgres` (porsager) over a direct/pooled connection; **RLS enforced per transaction** |
| Auth | Supabase Auth magic links (`@supabase/ssr`) · local dev provider | Both resolve to an `auth.users` id |
| Storage | Supabase Storage (private bucket) · local filesystem driver | Signed URLs only after an RLS check |
| Email | Resend (HTTP API) · dev outbox | |
| Jobs | Postgres queue (`public.jobs`) | Vercel Cron → `/api/jobs/run`, `npm run worker`, and `after()` kick on submission |
| AI | `@anthropic-ai/sdk` behind a provider interface | Structured output (`messages.parse` + Zod), no tools, cost tracked |
| Validation | Zod 4 | Env, actions, AI output, application answers |
| Tests | Vitest (unit + DB/RLS), Playwright (e2e) | |
| Hosting | Vercel | `vercel.json` cron |

Package versions were checked against the npm registry on 2026-11-26 (Next 16.4.6, React 19.3, Tailwind 4.3, @supabase/supabase-js 2.119, @supabase/ssr 0.12, Zod 4.6, @anthropic-ai/sdk 1.14, Playwright 1.63 to match the preinstalled browser).

## Modules → code

| Module | Where |
|---|---|
| **Marketplace** (public acquisition) | `src/app/(site)/**`, `src/components/marketplace`, `src/lib/catalog.ts` |
| **Intelligence** | `src/lib/intelligence/*` (normalization, SSRF-safe fetch, source adapters), `research.initial` job, `/command/intelligence` |
| **Index** (readiness) | `src/content/readiness-framework.ts` (seed), `src/lib/index/scoring.ts` (pure), `src/lib/index/service.ts`, `/assessment` |
| **Pipeline** (CRM) | `opportunities`, `pipeline_activities`, `/command/opportunities`, `/command/companies/[id]` |
| **Engagements** | Schema only (Phase 3): `proposals`, `engagements`, `subscriptions`, `invoices` |
| **Studio** | Schema only (Phase 4): `production_workflows`, `production_jobs`, `deliverables` |
| **Campaigns** | Schema only (Phase 5): `campaigns`, `content_items`, `performance_metrics` |
| **Portal** | `src/app/(app)/portal/**`, `src/app/(app)/apply/[id]` |
| **Command** | `src/app/command/**`, `src/app/actions/command.ts`, `src/lib/command/metrics.ts` |

## Directory map

```
src/
  app/
    (site)/          public pages (Header/Footer layout)
    (app)/           authenticated client surfaces: /apply/[id], /portal
    command/         Trident Command (staff only, requireStaff in layout + each action)
    actions/         Server Actions: public, application, account, command
    api/             uploads, files (signed download), assessments JSON, jobs/run
    auth/            callback (magic link), signout
    dev/outbox       dev-only email viewer (404 in production)
  components/        ui/, brand/, site/, forms/, apply/, marketplace/, command/, app/
  content/           catalog.ts, readiness-framework.ts, site.ts, case-studies.ts (seed + copy)
  lib/
    env.ts           Zod-validated environment; refuses dev providers in production
    db.ts            withUser / withAnon / withSystem
    auth/            providers, currentUser, requireUser, requireStaff
    application/     questions (single definition) + service (lifecycle)
    index/           scoring + assessment service
    intelligence/    normalize, safe-fetch, public source adapters
    jobs/            queue, handlers, runner
    ai/              provider abstraction, Anthropic adapter
    storage/         drivers + upload screening
    events.ts        event catalog + transactional emit
    audit.ts, email.ts, rate-limit.ts, crypto.ts, errors.ts, status.ts
supabase/
  migrations/        Supabase-compatible SQL (source of truth for schema + RLS)
  local/bootstrap.sql  local-only shim for Supabase roles and auth schema
scripts/             migrate, seed, worker, grant-owner, local-db.sh
tests/               unit/, db/, e2e/
```

## Data access contexts (the core security decision)

The app connects with a privileged connection but **every transaction lowers its role**:

```ts
withUser(userId, tx => …)   // SET LOCAL ROLE authenticated; request.jwt.claims.sub = userId → RLS applies
withAnon(tx => …)           // SET LOCAL ROLE anon → RLS applies (catalog reads)
withSystem(tx => …)         // SET LOCAL ROLE service_role → bypasses RLS; trusted workflows only
```

This is the same mechanism PostgREST uses, so the policies in `supabase/migrations` protect data identically in production, local development and tests. Business authorization (e.g. "only finance edits prices") is checked in code **and** enforced again by RLS.

`withSystem` is used only for: auth bootstrap, application submission (after an RLS-scoped validation), job handlers, rate limiting, public form intake, and writes to tables end users can never write (events, jobs, automation runs).

## Request flows

**Application submission** (`submitApplication`)
1. Load application + answers under RLS (proves membership), validate all stages and consents in code.
2. One system transaction: lock application → link/create company (dedupe by domain; never merge across tenants) → contact + 3 consent records → intelligence source + one fact per answer (`submitted`, `self_reported`, versioned) → credentials (`self_reported` / `source_linked`) → brand profile → attach files → one open opportunity (unique index) → status history → audit → `application.submitted` event → jobs enqueued.
3. `after()` starts the job runner; Cron/worker is the durable fallback.

**Readiness self-assessment**: Zod validation → deterministic scoring against the active, versioned framework → stored with results and a hashed access token → `assessment.generated` → private results URL emailed.

## Integration boundaries and modes

| Integration | Production | Development / test | Status |
|---|---|---|---|
| Auth | `AUTH_PROVIDER=supabase` | `local` (tokens in `app_private.local_auth_tokens`, HMAC session cookie) | Local tested e2e. Supabase path implemented, **untested against a live project** |
| Storage | `supabase` (service role, server only) | `local` (`.data/storage`, signed blob route) | Local tested. Supabase path untested live |
| Email | `resend` | `dev_outbox` | Outbox tested. Resend untested live |
| AI | `anthropic` | `none` → steps recorded as `blocked_unconfigured` | Boundary tested with `none`. Anthropic adapter untested live |
| Malware scan | `MALWARE_SCAN_URL` (POST bytes → `{clean, signature}`) | built-in checks only | External scanner not connected |
| Payments | Stripe (Phase 3) | — | Env keys reserved only |
| Analytics | PostHog (consent-gated) | — | Not implemented; env reserved |

`env.ts` refuses `local`/`dev_outbox` providers when `APP_ENV=production`. A visible banner shows the active dev modes on every non-production page, so a dev mode is never mistaken for a live integration.

## AI architecture

Not one autonomous agent. Specialized, permission-scoped workflow steps:
- Each step: workflow key, prompt version, Zod schema, `automation_runs` record (inputs, step outputs, status), `ai_executions` record (model, tokens, estimated cost, latency, status).
- Models get **no tools**; their output is data validated by Zod and routed to human review. Deterministic code owns scoring, pricing, permissions, transitions and contract terms.
- Untrusted content is wrapped in `<untrusted_data>` with a policy that it cannot change instructions; closing tags inside content are neutralized.
- Monthly budget guard (`AI_MONTHLY_BUDGET_USD`). Refusals (`stop_reason: refusal`) are recorded as failed steps for a human.
- Default model `claude-opus-5-5`; pricing table in `src/lib/ai/index.ts` is an estimate for internal cost tracking.

## Deployment (when the gate clears)

See README.md → Deploy. Summary: Supabase project (run migrations, create private bucket `trident-private`, configure Auth redirect URL `${APP_URL}/auth/callback` and email template), Vercel project with env vars from `.env.example`, `CRON_SECRET`, Vercel Cron (Pro plan for 5-minute schedules), Resend domain verification.
