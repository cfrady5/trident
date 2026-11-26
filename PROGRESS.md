# Progress

_Last updated: 2026-11-26 · Branch `claude/trident-commercialization-platform-p0ow8n`_

## Current status

**Phase 0 complete. Phase 1 functionally complete and tested locally.** Not deployed (blocked by the brand guide's conflict-of-interest gate and by live-service verification). External services (Supabase Auth/Storage, Resend, Anthropic, Stripe, PostHog) have integration boundaries but **none has been connected or tested against a live account**.

## Completed features

**Foundation**
- Brand extraction into BRAND / DESIGN_SYSTEM / VOICE; supplied logo artwork extracted unaltered from the guide PDF (raster); favicons from the mark.
- Next.js 16 + TS strict + Tailwind 4 tokens; self-hosted fonts; Zod-validated environment that refuses dev providers in production; visible dev-mode banner.
- 8 Supabase-compatible migrations: ~60 tables across tenancy, intelligence, catalog, index, applications, pipeline, engagements, production, campaigns, automation; RLS on every table; local Supabase shim; idempotent seed (no demo data).
- `withUser` / `withAnon` / `withSystem` data contexts so RLS applies identically in all environments.
- Passwordless auth (Supabase + local dev provider), roles (7 internal, 3 client), `requireUser` / `requireStaff`, owner bootstrap.
- Private storage (Supabase + local drivers), upload screening, quarantine, human release, signed downloads, audited.
- Durable Postgres job queue (claim/retry/backoff/dead-letter/reclaim), transactional idempotent domain events (all 21 cataloged), automation runs, AI execution cost tracking, provider-agnostic AI with Anthropic adapter.
- Audit trail (append-only), consents (versioned, append-only), rate limiting, notifications, data export/deletion requests.

**Public website and marketplace**
- Homepage (hero, problem, method, marketplace preview, readiness index, audiences, engagement models, quality standard, closing CTA), about, method, services + 3 pillar pages, pricing (4 plans with allowances/limits + packages + FAQ), 4 industry pages, insights (2 sourced articles), contact/proposal request, login, privacy and terms (drafts flagged for counsel), branded 404 and error pages, case-study architecture with zero entries.
- Marketplace: 19 DB-driven services; filter by stage, category, deliverable type, budget; side-by-side comparison (up to 3); browser-local shortlist; request a proposal; assessment-driven "recommended" highlighting; service detail pages with scope, deliverables, prerequisites, add-ons, exclusions, related services.

**Commercial Readiness Index**
- Versioned framework v1 (6 weighted categories, 16 criteria), deterministic scoring with missing-information handling, results page (summary, breakdown, strengths, prioritized gaps with evidence, recommended services capped at 4, 90-day focus, investment estimate, limitations), JSON export, print-to-PDF, private hashed-token access, results email.

**Application and portal**
- 7-stage application with autosave, resume, progress, conditional questions, credential claims with source/date, website import with mandatory confirmation, uploads, review + three consents, submission pipeline (company dedupe, sourced versioned facts, credentials, brand profile, single opportunity, events, jobs), request-for-information loop with reviewer note, read-only after submission.
- Portal: overview (applications with status language, assessments, updates), application detail with status history and submitted answers, settings with data requests.

**Trident Command**
- Overview with real calculated metrics and "No data yet" handling, attention queue, tasks, activity; applications (filters, review decisions, file release/hold/delete, research results, history); opportunities (table + kanban, filters, saved views, inline stage changes); company profile (facts with provenance/verification/approval, credential verification, opportunity editor with sales qualification, COI review gate, notes/tasks); inquiries; intelligence review queue; assessments; catalog & pricing editor (finance/admin, audited); finance actuals + scenario model; automations (jobs with retry, AI usage, event catalog); team (grant/revoke roles); settings (integration status, data requests).

**Hero update (Nov 26):** full-bleed animated canvas hero (`HeroTrident`) and header restyled to the owner's reference: classic-trident illustration (owner decision; not the logo) in glowing binary code, rolling dot landscape, code streams; header with mark + wordmark, Log In / Apply Now, gold line rising from award to market. Binary texture is an owner-approved exception to the guide, website hero only (BRAND.md). Position/Build/Activate row under the CTAs; header shows the tagline.

**Hero refinement (Nov 26):** `BinaryTridentHero` replaces `HeroTrident`. The official mark silhouette is now made entirely of binary characters (invisible mask from the supplied artwork; palette colors only), with staged formation, ambient behaviours, restrained cursor interaction, a binary landscape, four presets and a dev tuning panel. Dev-only comparison route `/hero-lab` (404 in production). Header: larger official mark + wordmark, single solid Gold Apply Now, nav collapses below 1024 px. QA captures at 1920×1080, 1440×900, 834×1112 and 390×844 plus a recording per preset; unit tests (determinism, palette, presets) and e2e tests (decorative canvas, clickable copy, reduced motion). Open: owner to choose a preset (default 04 Living Intelligence); supply SVG master to replace the raster mask.

## Architectural decisions

| Decision | Why |
|---|---|
| Direct Postgres with per-transaction role lowering instead of PostgREST/supabase-js for data | One data-access path, typed SQL, transactions across many tables, identical RLS behaviour locally and on Supabase |
| Postgres job queue instead of a hosted workflow service | Durable, transactional with the outbox, no extra vendor; Vercel Cron + `after()` + worker |
| Local dev providers (auth, storage, email) with hard refusal in production | Fully testable without credentials, never mistaken for real integrations |
| Catalog and framework as seeds, DB as source of truth | Pricing configurable in Command; seeds never overwrite edits |
| Facts as versioned rows with provenance/verification/approval | Distinguishes submitted, extracted, researched, AI-generated and approved intelligence |
| No AI in Phase 1 user flows; AI only behind review | Business rules stay deterministic; nothing simulated |
| Logo extracted from the guide PDF, not redrawn | Guide forbids redrawing; vector masters pending |
| Only AI adapter: Anthropic (`claude-opus-5-5`) | OpenAI option removed until an adapter is implemented and tested |

## Integration status

| Integration | Status |
|---|---|
| PostgreSQL | Local Postgres 16: migrations, seed, RLS **tested**. Supabase: not provisioned |
| Supabase Auth | Implemented (`@supabase/ssr`, PKCE callback, proxy refresh) — **untested live** |
| Supabase Storage | Implemented — **untested live** |
| Resend | Implemented — **untested live** |
| Anthropic | Implemented (`messages.parse` + Zod) — **untested live**; `AI_PROVIDER=none` path tested |
| Malware scanner | Interface only (`MALWARE_SCAN_URL`) |
| Stripe | Not implemented (Phase 3) |
| PostHog | Not implemented |
| Vercel Cron | Configured in `vercel.json`; endpoint tested for auth refusal only |

## Test results (2026-11-26, local)

- `tsc --noEmit`: pass · `eslint .`: pass (0 problems) · `next build`: pass
- Vitest: **69/69** — scoring (10), application definition (6), intelligence/SSRF/robots/prompt wrapping (9), screening/jobs/events/scenario/auth helpers (10), RLS & permissions (22), submission pipeline, jobs and assessments (12)
- Playwright: **8/8** — homepage, all 22 public pages, marketplace filter/compare/shortlist/proposal, assessment to results + JSON + token privacy, full application lifecycle with upload, cross-tenant 404s and API 401s, staff review with COI gate and kanban, request-for-information and resubmission
- Responsive check: no horizontal overflow at 390 / 834 / 1440 px on home, marketplace, pricing, assessment, apply, service detail, about; screenshots reviewed

Defects found and fixed by tests: applicant could self-approve (SECURITY DEFINER guard trigger), missing grants on `inquiries`, missing `auth.users` grant in the local shim, post-submit confirmation replaced by a re-render, request-for-information note not shown to the applicant, `loading.tsx` turning 404s into 200s.

## Known limitations

- Not deployed; live services unverified (above).
- No AI document extraction, server-rendered PDF, reviewed assessments or recommendation engine yet (Phase 2).
- Public data adapters (SBIR, USAspending, SAM.gov, SEC) not implemented; research step records them as skipped.
- Website import and research depend on outbound network; the test environment cannot reach arbitrary sites, so the website step was verified only for failure handling (`.invalid` domain) and with HTML fixtures.
- Catalog editor covers price, status, turnaround, revisions, visibility; allowances/scope text are seed-only.
- No nonce CSP, staff MFA, retention jobs or automated data-request fulfilment yet.
- Phase 3–5 modules exist as schema and disabled nav items only.
- Content flagged `[CONFIRM]`: prices, turnaround, contact email, location, legal entity, proof points, retention periods; independence claims provisional.

## Outstanding tasks

See ROADMAP.md → Gate 0 and Prioritized backlog.

## Next implementation priority

1. Provision a **staging** Supabase project + Vercel preview (needs spend approval) and verify auth, storage, email and cron end to end.
2. Connect a malware scanner; add nonce CSP and staff MFA.
3. Start Phase 2 with document extraction (reusing the imported/confirmed answer flow) and strategist-reviewed assessments.
