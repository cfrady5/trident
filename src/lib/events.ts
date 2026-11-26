/**
 * Domain events (transactional outbox). Producers call emitEvent() inside the
 * same transaction as the state change; the event row and the jobs it triggers
 * commit atomically. Idempotency keys make re-emission a no-op, so producers
 * can safely retry.
 *
 * EVENT_CATALOG is the single source for AUTOMATION.md and the Command
 * automations page. `jobs` lists what each event triggers today; `planned`
 * names the workflow a later phase attaches.
 */
import type { Tx } from "./db";
import { enqueueJob, type JobKind } from "./jobs/queue";

export interface EventDefinition {
  name: string;
  requiredData: string[];
  producer: string;
  jobs: JobKind[];
  planned?: string;
  databaseChanges: string;
  notification: string;
  approval: string;
  phase: number;
}

export const EVENT_CATALOG = [
  { name: "application.created", requiredData: ["application_id", "organization_id"], producer: "Applicant (startApplication action)", jobs: [], databaseChanges: "applications row (draft); opportunity at application_started when a company exists", notification: "None", approval: "None", phase: 1 },
  { name: "application.submitted", requiredData: ["application_id", "company_id", "opportunity_id"], producer: "Applicant (submitApplication action)", jobs: ["notify.application_submitted", "research.initial"], databaseChanges: "company upserted (dedup by domain), facts recorded as submitted/self-reported, credentials, opportunity at application_submitted", notification: "Applicant confirmation email; staff email + in-app notification", approval: "Staff review before any client-facing output", phase: 1 },
  { name: "document.uploaded", requiredData: ["file_id", "organization_id"], producer: "Upload route", jobs: [], planned: "intelligence.extract_document (Phase 2, AI)", databaseChanges: "files row, quarantined; screening notes", notification: "Staff notified when held for review", approval: "Reviewer must release every file", phase: 1 },
  { name: "intelligence.extracted", requiredData: ["company_id", "record_id"], producer: "Document extraction job", jobs: [], planned: "Applicant confirmation of extracted fields", databaseChanges: "company_facts with provenance=extracted, approval pending", notification: "Applicant asked to confirm", approval: "Applicant confirmation; staff approval", phase: 2 },
  { name: "research.completed", requiredData: ["company_id", "automation_run_id"], producer: "research.initial job", jobs: [], planned: "assessment.generate (Phase 2)", databaseChanges: "company_intelligence_records (needs_review), pipeline activity", notification: "Appears in review queue", approval: "Strategist review of findings", phase: 1 },
  { name: "assessment.generated", requiredData: ["assessment_id"], producer: "Public assessment action / assessment job", jobs: [], databaseChanges: "assessments + assessment_results (preliminary)", notification: "Respondent receives a private results link by email at completion", approval: "Preliminary until a strategist reviews", phase: 1 },
  { name: "assessment.approved", requiredData: ["assessment_id", "reviewer_id"], producer: "Strategist in Command", jobs: [], planned: "Recommendation engine", databaseChanges: "review_state=human_reviewed", notification: "Client notified report is ready", approval: "Strategist", phase: 2 },
  { name: "opportunity.qualified", requiredData: ["opportunity_id"], producer: "Business development in Command", jobs: [], planned: "Proposal drafting", databaseChanges: "opportunity stage=qualified; COI review required", notification: "Owner notified", approval: "COI review must be cleared", phase: 1 },
  { name: "proposal.generated", requiredData: ["proposal_id"], producer: "Proposal workflow", jobs: [], databaseChanges: "proposal draft + line items", notification: "Internal review queue", approval: "Internal review", phase: 3 },
  { name: "proposal.approved", requiredData: ["proposal_id", "approver_id"], producer: "Staff (finance or strategist)", jobs: [], databaseChanges: "proposal approved_by/approved_at", notification: "Owner notified", approval: "Named human approver required by constraint", phase: 3 },
  { name: "proposal.accepted", requiredData: ["proposal_id"], producer: "Client in portal", jobs: [], databaseChanges: "engagement pending; contract from approved template", notification: "Staff + client", approval: "Contract reviewed before signature", phase: 3 },
  { name: "engagement.activated", requiredData: ["engagement_id"], producer: "Finance after payment / signature", jobs: [], databaseChanges: "engagement active; scope period opened", notification: "Client onboarding email", approval: "Finance", phase: 3 },
  { name: "client.onboarded", requiredData: ["organization_id"], producer: "Onboarding checklist", jobs: [], databaseChanges: "organization ready for requests", notification: "Client", approval: "None", phase: 3 },
  { name: "request.submitted", requiredData: ["service_request_id"], producer: "Client in portal", jobs: [], databaseChanges: "service_request; scope check", notification: "Staff", approval: "Overage requires client approval before production", phase: 4 },
  { name: "production.started", requiredData: ["production_job_id"], producer: "Producer", jobs: [], databaseChanges: "production_job status", notification: "Client sees status", approval: "None", phase: 4 },
  { name: "deliverable.rendered", requiredData: ["deliverable_version_id"], producer: "Render step", jobs: [], databaseChanges: "deliverable_version with QA results", notification: "Reviewer", approval: "None", phase: 4 },
  { name: "review.requested", requiredData: ["approval_id"], producer: "Producer", jobs: [], databaseChanges: "approvals row", notification: "Reviewer or client", approval: "The review itself", phase: 4 },
  { name: "deliverable.approved", requiredData: ["deliverable_id", "approver_id"], producer: "Reviewer / client", jobs: [], databaseChanges: "deliverable approved", notification: "Producer", approval: "L2 client review for client-facing work", phase: 4 },
  { name: "deliverable.delivered", requiredData: ["deliverable_id"], producer: "Producer", jobs: [], databaseChanges: "deliverable delivered; allowance usage", notification: "Client with delivery note", approval: "L3 release checks", phase: 4 },
  { name: "report.generated", requiredData: ["report_id"], producer: "Reporting job", jobs: [], databaseChanges: "performance report", notification: "Client", approval: "Strategist review", phase: 5 },
  { name: "subscription.updated", requiredData: ["subscription_id"], producer: "Stripe webhook (verified signature)", jobs: [], databaseChanges: "subscriptions/invoices", notification: "Finance", approval: "None", phase: 3 },
] as const satisfies readonly EventDefinition[];

export type EventName = (typeof EVENT_CATALOG)[number]["name"];

export interface EmitInput {
  name: EventName;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  producer: string;
  actorUserId?: string | null;
  organizationId?: string | null;
  subjectType?: string;
  subjectId?: string;
}

/** Must run in a system transaction (events and jobs are not writable by end users). */
export async function emitEvent(tx: Tx, e: EmitInput): Promise<{ eventId: string; created: boolean }> {
  const def = EVENT_CATALOG.find((d) => d.name === e.name);
  if (!def) throw new Error(`unknown event ${e.name}`);
  const missing = def.requiredData.filter((k) => e.payload[k] === undefined || e.payload[k] === null);
  if (missing.length) throw new Error(`event ${e.name} missing required data: ${missing.join(", ")}`);

  const inserted = await tx<{ id: string }[]>`
    insert into public.domain_events (name, idempotency_key, payload, producer, actor_user_id, organization_id, subject_type, subject_id)
    values (${e.name}, ${e.idempotencyKey}, ${tx.json(e.payload as never)}, ${e.producer}, ${e.actorUserId ?? null},
            ${e.organizationId ?? null}, ${e.subjectType ?? null}, ${e.subjectId ?? null})
    on conflict (idempotency_key) do nothing
    returning id`;
  if (!inserted[0]) {
    const [existing] = await tx<{ id: string }[]>`select id from public.domain_events where idempotency_key = ${e.idempotencyKey}`;
    return { eventId: existing!.id, created: false };
  }
  const eventId = inserted[0].id;
  for (const kind of def.jobs as readonly JobKind[]) {
    await enqueueJob(tx, { kind, payload: { ...e.payload, event_id: eventId }, idempotencyKey: `${eventId}:${kind}`, eventId });
  }
  await tx`update public.domain_events set dispatched_at = now() where id = ${eventId}`;
  return { eventId, created: true };
}
