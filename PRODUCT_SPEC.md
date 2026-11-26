# Product specification

Trident is a technology commercialization and creative agency powered by its own acquisition, intelligence and production platform. Target operating model: 10–30 recurring clients at ~$3,500/month average, with administrative and production work minimized by structured data and reviewed automation.

**Pillars:** Position (define the opportunity) · Build (establish the presence) · Activate (generate demand). **Tagline:** Beyond the Award.

## Users

| User | Surface | Goal |
|---|---|---|
| Visitor (founder, BD lead, referrer) | Public site, marketplace, assessment | Understand Trident, find a scope and price, check readiness |
| Applicant / client admin / contributor / viewer | `/apply/[id]`, `/portal` | Share the company profile once, follow status, later: requests, approvals, deliverables |
| Trident staff (owner, admin, BD, strategist, producer, reviewer, finance) | `/command` | Review applications and intelligence, run the pipeline, configure the catalog, monitor automation and finances |

## Modules

| Module | Purpose | Phase | Status |
|---|---|---|---|
| Marketplace | Public acquisition and service discovery | 1 | **Built** |
| Intelligence | Company research, enrichment, extraction, opportunity identification | 2 (initial research in 1) | **Partly built** |
| Index | Readiness assessment and recommendations | 1 (self-assessment) / 2 (reviewed) | **Self-assessment built** |
| Pipeline | Lead management, qualification, CRM | 1 | **Built (basic CRM)** |
| Engagements | Proposals, SOWs, pricing, billing, onboarding | 3 | Schema only |
| Studio | Brand intelligence and creative production | 4 | Schema only |
| Campaigns | Calendars, campaigns, approvals, performance | 5 | Schema only |
| Portal | Client dashboard | 1 (applicant) / 3 (client) | **Applicant portal built** |
| Command | Internal operating system | 1 | **Built for Phase 1 scope** |

## Public sitemap (built)

`/` · `/about` · `/method` · `/services` · `/services/{position,build,activate}` · `/marketplace` · `/marketplace/[service]` · `/assessment` (+ private `/assessment/results/[id]`) · `/apply` · `/pricing` · `/industries` · `/industries/{defense,aerospace,advanced-manufacturing,emerging-technology}` · `/insights` · `/insights/[slug]` (2 articles) · `/contact` · `/login` · `/privacy` · `/terms`. Case-study architecture exists with **no entries** (`/case-studies/[slug]` 404s until a client-approved, sourced study is published).

## Service catalog

19 services seeded from `src/content/catalog.ts` with structured fields: name, slug, summary/description, pillar, category, deliverable types, starting price, price status, billing model, scope, deliverables (name + format), turnaround range and confirmation flag, included revisions, prerequisites, add-ons, exclusions, related services, production workflow key, required profile fields. The catalog drives the marketplace, the assessment's recommendations, the pricing page and (Phase 3) proposals.

| Service | From | Pillar |
|---|---|---|
| Commercial readiness audit | $1,500 | Position |
| Position Sprint | $3,500 | Position |
| Logo and visual identity | $2,000 | Build |
| Complete brand identity | $6,000 | Build |
| Brand guidelines | $4,000 | Build |
| Landing page | $1,500 | Build |
| Startup website | $4,000 | Build |
| Corporate website | $7,500 | Build |
| Capability statement | $750 | Build |
| Product one-pager | $500 | Build |
| Investor pitch deck | $2,500 | Build |
| Marketplace pitch development | $2,500 | Position |
| Social media template system | $1,250 | Activate |
| Email template system | $750 | Activate |
| Conference readiness package | $3,500 | Activate |
| Investor readiness package | $5,000 | Program |
| Build Kit | $10,000 | Build |
| 90-day Activate Program | $7,500 | Activate |
| Beyond the Award | $18,500 | Program |

All prices are **proposed** (brand guide `[CONFIRM: price]`) and editable in `/command/catalog` by finance/admin; turnaround ranges are estimates until confirmed.

### Recurring plans

| Plan | Monthly | Min term | Allowances (per month) |
|---|---|---|---|
| Presence | $1,500 | 3 mo | 8 LinkedIn posts, 2 website hours; calendar, design, report, monthly meeting |
| Momentum | $3,500 | 3 mo | 12 company + 4 executive posts, 2 email campaigns, 2 video edits, 4 collateral assets, 4 website hours; biweekly meetings |
| Accelerate | $6,500 | 6 mo | 16 + 8 posts, 4 emails, 4 videos, 6 enablement assets, 8 website hours; fractional leadership, weekly meetings |
| Enterprise | $10,000+ | 6 mo | Custom SOW with defined allowances and capacity |

Every plan stores allowances, production-hours capacity, revision limits, exclusions, overage terms and minimum term. **No plan offers unlimited production.**

## Company application (the core)

Seven stages; one definition (`src/lib/application/questions.ts`) drives UI, validation, review and the intelligence mapping.

1. Company identification · 2. Technology profile · 3. Validation and traction (claims with source, date, verification status) · 4. Commercial objectives · 5. Brand and marketing (+ file uploads) · 6. Engagement preferences · 7. Review and submit (consents and restricted-information attestation).

Capabilities: passwordless account, autosave (debounced + on tab close), resume, progress per stage, conditional questions, accessible validation, website URL import (proposed values must be confirmed), file uploads with screening and quarantine, status tracking with history, request-for-information loop, read-only after submission. **AI document extraction** is a Phase 2 item (the boundary exists; nothing is simulated).

## Commercial Readiness Index

Categories and weights (configurable, versioned): Market positioning 20% · Brand identity 15% · Digital presence 20% · Sales enablement 15% · Marketing and demand generation 20% · Commercial infrastructure 10%. 16 criteria with option scores; "Not sure" is missing information, never zero. Deterministic, reproducible scoring (`src/lib/index/scoring.ts`). Each criterion result stores score, evidence (the answer), explanation, confidence, missing information, recommendation and services. Recommendations come only from the top gaps (max 4 services), never padded.

Report: executive summary, overall and band, category breakdown, strengths, prioritized gaps with evidence, recommended services with prices, 90-day focus, estimated investment, assumptions and limitations. Formats: interactive web page, structured JSON, print-to-PDF (server-rendered PDF is Phase 2), stored record. Labeled *preliminary* until a strategist reviews it.

## Sales pipeline

17 stages (identified → active client). Table and kanban views, filters (stage, source, owner, search), saved views, owner assignment, notes, tasks with due dates, activity history, estimated contract value and MRR, probability, next action, lead source, **sales qualification score (budget, urgency, fit, authority; separate from readiness)**, COI review gate, duplicate detection (domain + name similarity).

## Trident Command (Phase 1 scope)

Overview (real metrics: MRR, active clients, open/qualified opportunities, pipeline and weighted value, ACV, conversion rates shown only with ≥ 5 data points, AI cost, approvals, attention queue, tasks, activity) · Opportunities · Applications · Inquiries · Companies · Intelligence (review queue) · Assessments · Catalog & pricing · Finance (actuals + capacity/profitability scenario model with the stated planning assumptions) · Automations · Team · Settings (integration status, data requests). Proposals, Engagements, Clients, Production, Campaigns and Assets appear as disabled items labeled with their phase.

## Financial planning assumptions (adjustable; not measured)

10 recurring clients · $3,500 average retainer · 20 conventional production hours per client per month · 85% aspirational labor reduction · $100 loaded hourly cost · $50 variable software per client per month → $35,000 MRR, 30 production hours, ~90% gross margin **on paper**. Real margins will come from time entries, AI costs and revision counts.

## Acceptance criteria — Phase 1 (definition of done)

| # | Criterion | Evidence |
|---|---|---|
| 1 | Visitor understands services | Home, method, services, pillar pages; e2e |
| 2 | Visitor browses marketplace | Filters, compare, shortlist, detail pages; e2e |
| 3 | Company can start an application | e2e |
| 4 | Application saves and resumes | Autosave + reload test; e2e + DB test |
| 5 | Company can upload permitted documents | Upload + screening + quarantine; e2e + unit |
| 6 | Submission creates a persistent company profile | Facts, credentials, brand profile; DB test |
| 7 | Administrator can review the application | Command application review; e2e |
| 8 | Status is accurately tracked | Status history, portal, request-for-information loop; e2e |
| 9 | Opportunity created without duplicates | Unique index, domain dedupe, cross-tenant flag; DB test |
| 10 | Next workflow visible and actionable | Research run → review queue; next action, tasks, COI gate; e2e |
| 11 | Tenant isolation and permissions tested | RLS tests + e2e URL tests |
| 12 | Works across screen sizes | No overflow at 390/834/1440; screenshots reviewed |
| 13 | Critical buttons and forms function | e2e |
| 14 | Empty and error states handled | Empty states, `error.tsx`, `not-found.tsx`, field errors |
| 15 | Conforms to the brand guidelines | BRAND.md / DESIGN_SYSTEM.md; supplied logo only |
| 16 | Deployment and configuration documented | README.md, ARCHITECTURE.md, `.env.example` |

Acceptance criteria for Phases 2–6 are in ROADMAP.md.
