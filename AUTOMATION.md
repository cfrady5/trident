# Automation

Event-driven, durable, idempotent. Deterministic code owns business rules; AI is used only where interpretation or synthesis adds value, and its output is always reviewed by a person before it reaches a client.

## Building blocks

| Piece | Where | Guarantees |
|---|---|---|
| Domain events | `public.domain_events`, `src/lib/events.ts` | Emitted **inside the same transaction** as the state change (outbox). Unique `idempotency_key` → re-emitting is a no-op. Required payload keys validated per event |
| Jobs | `public.jobs`, `src/lib/jobs/queue.ts` | Claimed with `FOR UPDATE SKIP LOCKED`; unique idempotency key (`<event_id>:<job_kind>`); retries with backoff 30s → 1h; `dead` after `max_attempts`; stale `running` jobs reclaimed after `timeout + 60s` |
| Runner | `src/lib/jobs/runner.ts` | Per-job timeout; time budget per invocation. Triggered by `after()` on submission, Vercel Cron (`/api/jobs/run`, bearer `CRON_SECRET`, every 5 min) and `npm run worker` |
| Workflow runs | `public.automation_runs` | One row per workflow execution: inputs, step-by-step outputs/status, `needs_review` / `approved` / `rejected`, approver |
| AI executions | `public.ai_executions` | Provider, model, prompt version, tokens, estimated cost, latency, status |
| Inspection | `/command/automations`, `/command/intelligence` | Jobs (retry dead ones), event counts, AI usage/cost, review queue |

## Event catalog

Source: `EVENT_CATALOG` in `src/lib/events.ts` (rendered live in `/command/automations`).

| Event | Required data | Producer | Triggers now | Planned | Approval |
|---|---|---|---|---|---|
| application.created | application_id, organization_id | applicant | — | — | — |
| application.submitted | application_id, company_id, opportunity_id | applicant | `notify.application_submitted`, `research.initial` | — | staff review before any client-facing output |
| document.uploaded | file_id, organization_id | upload route | — | document extraction (AI, P2) | reviewer releases every file |
| intelligence.extracted | company_id, record_id | extraction job | — | applicant confirmation | applicant + staff |
| research.completed | company_id, automation_run_id | research job | — | assessment generation (P2) | strategist review |
| assessment.generated | assessment_id | assessment action | — (email sent inline) | — | preliminary until reviewed |
| assessment.approved | assessment_id, reviewer_id | strategist | — | recommendation engine | strategist |
| opportunity.qualified | opportunity_id | Command | — | proposal drafting (P3) | COI review must be cleared (enforced in code) |
| proposal.generated / approved / accepted | proposal_id (+ approver_id) | proposal workflow / staff / client | — | P3 | named human approver (DB constraint) |
| engagement.activated, client.onboarded | engagement_id / organization_id | finance / onboarding | — | P3 | finance |
| request.submitted, production.started, deliverable.rendered, review.requested, deliverable.approved, deliverable.delivered | ids | client / producer | — | P4 | overage approval before production; L2 client review; L3 release checks |
| report.generated | report_id | reporting job | — | P5 | strategist |
| subscription.updated | subscription_id | Stripe webhook (signature verified) | — | P3 | — |

For every event the catalog also records database changes and notification behaviour (see the code). Failure handling is uniform: the emitting transaction rolls back on error (so no event without its state change), and triggered jobs retry independently.

## Workflows implemented

### `notify.application_submitted`
Applicant confirmation email, staff email (`STAFF_NOTIFICATION_EMAILS`), in-app notifications for BD/strategist/admin/owner.

### `research.initial` (workflow v1, prompt `messaging-analysis@1`)

| # | Step | Kind | Output |
|---|---|---|---|
| 1 | Normalize company information | deterministic | normalized name/domain |
| 2 | Check for existing company records | deterministic | similar names (Dice ≥ 0.85) or same domain → flagged |
| 3 | Identify conflicting or unsupported claims | deterministic | email/website domain mismatch, personal email, credentials without source |
| 4 | Identify incomplete fields | deterministic | optional fields left blank |
| 5 | Analyze public website | deterministic, SSRF-safe, robots.txt honoured | title, description, headings, HTTPS, viewport, contact path, LinkedIn link |
| 6 | Messaging, products, competitors, buyer segments | **AI** (when configured) | hypotheses + `injection_attempts_observed` flag; otherwise `blocked_unconfigured` |
| 7 | Verify public credentials | adapters | `skipped` until source adapters exist (listed explicitly) |
| → | Report | | `company_intelligence_records` (`needs_review`), pipeline activity, `research.completed` |

The opportunity moves to `research_in_progress`; a strategist marks the run reviewed or rejects it in `/command/intelligence`. Nothing from this workflow becomes an approved fact automatically.

## AI rules

1. **Permission-scoped:** models receive no tools; they cannot send email, write records or call URLs.
2. **Structured:** Zod schema per step (`messages.parse`); invalid output is recorded as `invalid_output` and the step fails.
3. **Untrusted data:** website/document content is wrapped as data; instructions in it are ignored and flagged.
4. **Human approval:** any client-facing use of AI output requires review. Facts from AI are `ai_generated` + `pending`; DB constraint blocks approval without an approver.
5. **Cost:** every call is metered; monthly budget guard; usage visible in Command.
6. **No simulation:** with `AI_PROVIDER=none` the step says so. Nothing is faked.

## Planned workflow components (later phases)

Intelligence: document extraction, competitor and market research, credential verification assistance via public data adapters. Strategy: reviewed readiness scoring from evidence, positioning, personas, service matching, proposal drafting, content strategy. Production: brand intelligence, document/presentation/website/graphic production, copywriting. QA: brand consistency, factual claim checking, accessibility, rendering, scope validation, sensitive-data checks. Each follows the same contract: structured inputs/outputs, schema validation, source references, status, retry and timeout policy, cost, model config, prompt version, approval requirement, audit history.

## Outreach

No automated high-volume sending exists or is planned. `communications.status = 'sent'` requires `approved_by` (DB constraint); `suppression_list` and `company_contacts.contact_permission` gate any outreach drafts (Phase 6).
