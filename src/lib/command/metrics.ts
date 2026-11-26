import type { Tx } from "../db";

/**
 * Executive metrics, all calculated from real records. A metric whose inputs
 * don't exist yet returns null and renders as "No data yet" rather than zero
 * pretending to be a measurement.
 */
export interface ExecutiveMetrics {
  mrrCents: number | null;
  activeClients: number;
  openOpportunities: number;
  qualifiedOpportunities: number;
  pipelineValueCents: number | null;
  weightedPipelineCents: number | null;
  avgContractValueCents: number | null;
  submittedToQualified: number | null;
  qualifiedToWon: number | null;
  applicationsAwaitingReview: number;
  filesAwaitingReview: number;
  reviewQueue: number;
  pendingApprovals: number;
  openDeliverables: number;
  aiCostMonthUsd: number;
  aiExecutionsMonth: number;
  newInquiries: number;
  failedJobs: number;
}

export async function executiveMetrics(tx: Tx): Promise<ExecutiveMetrics> {
  const [m] = await tx<Record<string, string | null>[]>`
    with opp as (select * from public.opportunities)
    select
      (select sum(monthly_fee_cents) from public.engagements where status = 'active')::text as mrr,
      (select count(distinct organization_id) from public.engagements where status = 'active')::text as active_clients,
      (select count(*) from opp where closed_at is null)::text as open_opps,
      (select count(*) from opp where closed_at is null and stage in ('qualified','discovery_scheduled','discovery_completed','proposal_generated','proposal_sent','negotiation'))::text as qualified,
      (select sum(estimated_contract_value_cents) from opp where closed_at is null)::text as pipeline,
      (select sum(estimated_contract_value_cents * probability / 100.0) from opp where closed_at is null and probability is not null)::text as weighted,
      (select avg(estimated_contract_value_cents) from opp where stage = 'closed_won')::text as acv,
      (select count(*) from opp where application_id is not null)::text as from_apps,
      (select count(*) from opp where application_id is not null and stage not in ('identified','invited','application_started','application_submitted','research_in_progress','assessment_in_progress','assessment_reviewed','nurture','closed_lost'))::text as apps_qualified,
      (select count(*) from opp where stage in ('closed_won','active_client'))::text as won,
      (select count(*) from opp where stage in ('closed_won','closed_lost','active_client'))::text as closed_after_qual,
      (select count(*) from public.applications where status in ('submitted','under_review'))::text as apps_review,
      (select count(*) from public.files where deleted_at is null and quarantine_status in ('quarantined','held_for_review') and application_id is not null)::text as files_review,
      (select count(*) from public.automation_runs where status = 'needs_review')::text as review_queue,
      (select count(*) from public.approvals where status = 'pending')::text as approvals,
      (select count(*) from public.deliverables where status <> 'delivered')::text as deliverables,
      (select coalesce(sum(estimated_cost_usd),0) from public.ai_executions where created_at >= date_trunc('month', now()))::text as ai_cost,
      (select count(*) from public.ai_executions where created_at >= date_trunc('month', now()))::text as ai_count,
      (select count(*) from public.inquiries where status = 'new')::text as inquiries,
      (select count(*) from public.jobs where status in ('dead','failed'))::text as failed_jobs`;
  const n = (k: string) => Number(m?.[k] ?? 0);
  const nn = (k: string) => (m?.[k] == null ? null : Number(m[k]));
  return {
    mrrCents: nn("mrr"),
    activeClients: n("active_clients"),
    openOpportunities: n("open_opps"),
    qualifiedOpportunities: n("qualified"),
    pipelineValueCents: nn("pipeline"),
    weightedPipelineCents: nn("weighted") === null ? null : Math.round(n("weighted")),
    avgContractValueCents: nn("acv") === null ? null : Math.round(n("acv")),
    submittedToQualified: n("from_apps") >= 5 ? n("apps_qualified") / n("from_apps") : null,
    qualifiedToWon: n("closed_after_qual") >= 5 ? n("won") / n("closed_after_qual") : null,
    applicationsAwaitingReview: n("apps_review"),
    filesAwaitingReview: n("files_review"),
    reviewQueue: n("review_queue"),
    pendingApprovals: n("approvals"),
    openDeliverables: n("deliverables"),
    aiCostMonthUsd: n("ai_cost"),
    aiExecutionsMonth: n("ai_count"),
    newInquiries: n("inquiries"),
    failedJobs: n("failed_jobs"),
  };
}

/** Planning model (not measured performance). See PRODUCT_SPEC.md -> Financial operations. */
export interface ScenarioInputs {
  clients: number;
  avgRetainer: number;
  conventionalHours: number;
  laborReduction: number; // 0..1, aspirational
  hourlyCost: number;
  softwarePerClient: number;
}

export const DEFAULT_SCENARIO: ScenarioInputs = { clients: 10, avgRetainer: 3500, conventionalHours: 20, laborReduction: 0.85, hourlyCost: 100, softwarePerClient: 50 };

export function scenario(i: ScenarioInputs) {
  const revenue = i.clients * i.avgRetainer;
  const hoursPerClient = i.conventionalHours * (1 - i.laborReduction);
  const labor = i.clients * hoursPerClient * i.hourlyCost;
  const software = i.clients * i.softwarePerClient;
  const gross = revenue - labor - software;
  return {
    revenue,
    annualRevenue: revenue * 12,
    hoursPerClient,
    totalHours: i.clients * hoursPerClient,
    labor,
    software,
    gross,
    margin: revenue > 0 ? gross / revenue : 0,
    conventionalLabor: i.clients * i.conventionalHours * i.hourlyCost,
  };
}
