# Roadmap

Each phase must be independently launchable and pass its acceptance criteria end to end (tests from the user's perspective) before the next starts.

## Gate 0 — before any public launch (not engineering)

- [ ] Employer conflict-of-interest / outside-activity review cleared (brand guide p.2, p.32)
- [ ] PROPOSAL items approved; prices and turnaround confirmed; contact email, location, legal entity confirmed
- [ ] Vector logo masters supplied
- [ ] Privacy policy and terms reviewed by counsel
- [ ] Supabase, Resend, Vercel projects provisioned (spend approval)

## Phase 0 — Foundation ✅

Brand extraction and design system; documentation; repository structure; schema, migrations, RLS; auth and roles; UI components; test infrastructure (Vitest, Playwright); environment validation; deployment config.

## Phase 1 — Public website and acquisition ✅ (pending live-service verification)

Website, method, services, pricing, marketplace, readiness self-assessment, company application with persistence and uploads, company intelligence records, application review, basic CRM. See PRODUCT_SPEC.md for the 16 acceptance criteria and their evidence.

Remaining before launch: verify Supabase Auth/Storage, Resend and Cron against real projects; connect a malware scanner; nonce CSP; staff MFA.

## Phase 2 — Intelligence and assessment

Scope: AI document extraction (with applicant confirmation), public company research, website analysis with AI synthesis, source-backed intelligence profiles, public data adapters (SBIR.gov, USAspending, SAM.gov, SEC EDGAR), reviewed readiness scoring from evidence, server-rendered PDF report, service recommendation engine, internal review workflows, retention jobs.

Acceptance:
1. Uploading a capability statement produces extracted fields marked `extracted`/`pending` that the applicant confirms or edits; nothing becomes approved without a person.
2. A submitted application yields a research report with every finding linked to a source, and AI cost recorded per run.
3. A strategist can adjust any criterion score with evidence; the overall score recomputes deterministically and the report flips to "reviewed".
4. The client downloads the reviewed report as PDF and JSON; the PDF passes a render check.
5. Recommendations list why, deliverables, price, prerequisites, timeline, evidence and alternatives; changing the budget never adds services.
6. Prompt-injection fixtures in websites/documents are flagged and have no effect on outputs.

## Phase 3 — Sales and onboarding

Scope: qualification workflow, proposal generator (web + PDF) from approved intelligence, pricing configuration (discounts, optional items, recurring), engagement scopes, contract/SOW templates with review, Stripe subscriptions and invoices (webhooks verified), onboarding, client dashboard (roadmap, projects, billing).

Acceptance:
1. A qualified opportunity produces a draft proposal whose every claim maps to an approved fact; staff edit and approve it; it cannot be sent without an approver (constraint).
2. Client accepts in the portal; an engagement and SOW draft are created; no invoice exists until finance confirms.
3. Stripe test-mode subscription lifecycle (create, pay, fail, cancel) updates `subscriptions`/`invoices` idempotently from webhooks.
4. The client dashboard shows what Trident is doing, what's done, what awaits approval and what's next.

## Phase 4 — Creative production (Trident Studio)

Scope: client brand systems and asset libraries (versioned, searchable, signed downloads), production requests with scope checks and overage approval, production workflows per deliverable type, document/presentation/website/graphic generation, automated QA (brand, claims, accessibility, render), client approvals, delivery notes, portable brand package export (`clients/[slug]/…`).

Acceptance:
1. A client request auto-fills from approved intelligence and asks only deliverable-specific questions.
2. Out-of-scope requests generate an overage approval before production starts (constraint).
3. A one-pager goes Make → Render → Review → Fix → Ship with L1/L2/L3 recorded and cannot reach the client unreviewed.
4. Exported brand package matches the database snapshot and is versioned.

## Phase 5 — Recurring marketing operations

Scope: content calendars, campaigns, approvals, publishing via official APIs where authorized (manual export otherwise), performance analytics, monthly reporting, allowance tracking, client profitability from time entries and AI costs.

Acceptance:
1. A Momentum client's month shows allowance usage per category, and the 13th company post is blocked pending overage approval.
2. Monthly report is generated from recorded metrics only; empty metrics show "no data".
3. Client-level gross margin is calculated from actual time entries and costs.

## Phase 6 — Advanced acquisition and expansion

Opportunity intelligence from permitted public data (Phase II awards, contract announcements, raises, launches, spinouts), evidence-backed opportunity profiles, human-reviewed outreach drafts with suppression and permissions, partner onboarding, third-party catalog, referral/commission tracking, accelerator cohorts, licensing. **Third-party marketplace features stay off until the core agency model is validated.**

## Prioritized backlog (next)

1. Live verification of Supabase Auth/Storage + Resend + Vercel Cron in a staging project (Phase 1 close-out).
2. Malware scanner integration (e.g. ClamAV service) behind `MALWARE_SCAN_URL`.
3. Nonce-based CSP; staff MFA; retention jobs.
4. Document extraction workflow (Phase 2 start) with applicant confirmation UI (reuses the `imported/confirmed` mechanism).
5. Strategist review of assessments with per-criterion evidence and server PDF.
6. Editable allowances/scope/deliverables in Command catalog.
7. Analytics (PostHog, consent banner).
