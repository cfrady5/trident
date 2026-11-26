"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasStaffRole, requireStaff, type CurrentUser, type StaffRole } from "@/lib/auth";
import { withSystem, withUser, type Tx } from "@/lib/db";
import { audit } from "@/lib/audit";
import { emitEvent } from "@/lib/events";
import { retryJob } from "@/lib/jobs/queue";
import { layout, sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { storage } from "@/lib/storage";
import { PIPELINE_STAGES, APPLICATION_STATUS } from "@/lib/status";
import { AppError, type ActionResult, fail, ok, toActionError } from "@/lib/errors";

const uuid = z.string().uuid();

async function staffAction<T>(roles: StaffRole[], fn: (user: CurrentUser, tx: Tx) => Promise<T>, paths: string[] = []): Promise<ActionResult<T>> {
  try {
    const user = await requireStaff();
    if (roles.length && !hasStaffRole(user, ...roles)) return fail("forbidden", "Your role can't do that.");
    const data = await withUser(user.id, (tx) => fn(user, tx));
    for (const p of paths) revalidatePath(p);
    return ok(data);
  } catch (e) {
    return toActionError(e);
  }
}

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------
const reviewStatuses = ["under_review", "needs_information", "accepted", "declined"] as const;

export async function setApplicationStatusAction(applicationId: string, status: string, note: string): Promise<ActionResult<null>> {
  const parsed = z.object({ id: uuid, status: z.enum(reviewStatuses), note: z.string().trim().max(2000) }).safeParse({ id: applicationId, status, note });
  if (!parsed.success) return fail("invalid", "Invalid status change.");
  if ((status === "needs_information" || status === "declined") && !parsed.data.note) return fail("invalid", "Add a note explaining what's needed or why.");
  const result = await staffAction(["business_development", "strategist", "reviewer"], async (user, tx) => {
    const [app] = await tx<{ status: string; organization_id: string; created_by: string | null; company_id: string | null }[]>`
      select status, organization_id, created_by, company_id from public.applications where id = ${applicationId} for update`;
    if (!app) throw new AppError("not_found", "Application not found.");
    if (app.status === "draft") throw new AppError("conflict", "Draft applications can't be reviewed.");
    await tx`update public.applications set status = ${status}, reviewed_by = ${user.id}, reviewed_at = now(),
               decision_reason = ${status === "accepted" || status === "declined" ? parsed.data.note || null : null} where id = ${applicationId}`;
    await tx`insert into public.application_status_history (application_id, from_status, to_status, note, actor_user_id)
             values (${applicationId}, ${app.status}, ${status}, ${status === "needs_information" ? parsed.data.note : null}, ${user.id})`;
    await audit(tx, { action: "application.status_changed", entityType: "application", entityId: applicationId, organizationId: app.organization_id, actorUserId: user.id, metadata: { from: app.status, to: status } });
    return app;
  }, [`/command/applications/${applicationId}`, "/command/applications"]);
  if (!result.ok) return result;
  const app = result.data;
  const [creator] = await withSystem((tx) => tx<{ email: string }[]>`select email from public.profiles where id = ${app.created_by}`);
  if (creator && status !== "under_review") {
    const s = APPLICATION_STATUS[status]!;
    const msg = layout({
      heading: `Application update: ${s.label}`,
      paragraphs: [s.client, ...(status === "needs_information" ? [`What we need: ${parsed.data.note}`] : [])],
      cta: { label: status === "needs_information" ? "Update your application" : "View in your portal", url: `${env().APP_URL}${status === "needs_information" ? `/apply/${applicationId}` : "/portal"}` },
    });
    await sendEmail({ to: creator.email, subject: `Your Trident application: ${s.label}`, ...msg, tag: "application_status" }).catch(() => undefined);
  }
  return ok(null);
}

export async function reviewFileAction(fileId: string, decision: "release" | "hold" | "delete", note: string): Promise<ActionResult<null>> {
  if (!uuid.safeParse(fileId).success || !["release", "hold", "delete"].includes(decision)) return fail("invalid", "Invalid request.");
  const r = await staffAction(["reviewer", "strategist", "creative_producer"], async (user, tx) => {
    const [f] = await tx<{ storage_path: string; organization_id: string | null; quarantine_status: string; application_id: string | null }[]>`
      select storage_path, organization_id, quarantine_status, application_id from public.files where id = ${fileId} and deleted_at is null for update`;
    if (!f) throw new AppError("not_found", "File not found.");
    const q = decision === "release" ? "released" : decision === "hold" ? "held_for_review" : "deleted";
    await tx`update public.files set quarantine_status = ${q}, reviewed_by = ${user.id}, reviewed_at = now(),
               deleted_at = ${decision === "delete" ? new Date() : null},
               screening_notes = screening_notes || ${tx.json([{ check: "human_review", result: decision === "release" ? "pass" : "flag", detail: note || `Reviewer decision: ${decision}` }] as never)}
             where id = ${fileId}`;
    await audit(tx, { action: `file.${decision === "release" ? "released" : decision === "hold" ? "held" : "deleted"}`, entityType: "file", entityId: fileId, organizationId: f.organization_id, actorUserId: user.id, metadata: { note } });
    return f;
  }, ["/command/applications"]);
  if (!r.ok) return r;
  if (decision === "delete") await storage().remove(r.data.storage_path).catch(() => undefined);
  return ok(null);
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------
const POST_QUALIFICATION = PIPELINE_STAGES.slice(PIPELINE_STAGES.indexOf("qualified")).filter((s) => !["closed_lost", "nurture"].includes(s));

const oppSchema = z.object({
  stage: z.enum(PIPELINE_STAGES as [string, ...string[]]).optional(),
  owner_user_id: z.string().uuid().nullable().optional(),
  estimated_contract_value_cents: z.number().int().min(0).max(1e10).nullable().optional(),
  estimated_mrr_cents: z.number().int().min(0).max(1e9).nullable().optional(),
  probability: z.number().int().min(0).max(100).nullable().optional(),
  next_action: z.string().trim().max(500).nullable().optional(),
  next_action_due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  lost_reason: z.string().trim().max(1000).nullable().optional(),
  qualification: z.object({ budget: z.number().min(0).max(25), urgency: z.number().min(0).max(25), fit: z.number().min(0).max(25), authority: z.number().min(0).max(25) }).optional(),
});

/**
 * Deterministic rules: qualification score = sum of four 0-25 criteria;
 * a company cannot be qualified (or progress further) until its
 * conflict-of-interest review is cleared; closing requires a reason when lost.
 */
export async function updateOpportunityAction(opportunityId: string, patch: z.infer<typeof oppSchema>): Promise<ActionResult<null>> {
  const parsed = oppSchema.safeParse(patch);
  if (!uuid.safeParse(opportunityId).success || !parsed.success) return fail("invalid", "Invalid update.");
  const p = parsed.data;
  let qualifiedNow = false;
  const r = await staffAction(["business_development", "strategist"], async (user, tx) => {
    const [opp] = await tx<{ stage: string; coi_status: string; company_id: string }[]>`select stage, coi_status, company_id from public.opportunities where id = ${opportunityId} for update`;
    if (!opp) throw new AppError("not_found", "Opportunity not found.");
    if (p.stage && POST_QUALIFICATION.includes(p.stage) && opp.coi_status !== "cleared" && opp.coi_status !== "not_required") {
      throw new AppError("conflict", "Complete the conflict-of-interest review before qualifying this opportunity.");
    }
    if (p.stage === "closed_lost" && !p.lost_reason) throw new AppError("invalid", "Record why the opportunity was lost.");
    const fields: Record<string, unknown> = {};
    for (const k of ["owner_user_id", "estimated_contract_value_cents", "estimated_mrr_cents", "probability", "next_action", "next_action_due", "lost_reason"] as const) if (p[k] !== undefined) fields[k] = p[k];
    if (p.qualification) {
      fields.qualification = tx.json(p.qualification);
      fields.qualification_score = Math.round(p.qualification.budget + p.qualification.urgency + p.qualification.fit + p.qualification.authority);
    }
    if (p.stage && p.stage !== opp.stage) {
      fields.stage = p.stage;
      fields.closed_at = ["closed_won", "closed_lost"].includes(p.stage) ? new Date() : null;
      qualifiedNow = p.stage === "qualified";
      await tx`insert into public.pipeline_activities (opportunity_id, company_id, kind, body, metadata, actor_user_id)
               values (${opportunityId}, ${opp.company_id}, 'stage_change', ${`Stage: ${opp.stage.replace(/_/g, " ")} → ${p.stage.replace(/_/g, " ")}`}, ${tx.json({ from: opp.stage, to: p.stage })}, ${user.id})`;
    }
    if (Object.keys(fields).length) await tx`update public.opportunities set ${tx(fields)} where id = ${opportunityId}`;
    await audit(tx, { action: "opportunity.updated", entityType: "opportunity", entityId: opportunityId, actorUserId: user.id, metadata: { fields: Object.keys(fields) } });
    return opp.company_id;
  }, ["/command/opportunities", "/command"]);
  if (!r.ok) return r;
  revalidatePath(`/command/companies/${r.data}`);
  if (qualifiedNow) {
    await withSystem((tx) => emitEvent(tx, { name: "opportunity.qualified", idempotencyKey: `opportunity.qualified:${opportunityId}:${Date.now()}`, producer: "command", payload: { opportunity_id: opportunityId }, subjectType: "opportunity", subjectId: opportunityId }));
  }
  return ok(null);
}

export async function addActivityAction(_: unknown, form: FormData): Promise<ActionResult<null>> {
  const parsed = z.object({
    companyId: uuid, opportunityId: uuid.optional().or(z.literal("")), kind: z.enum(["note", "task", "call", "meeting", "email"]),
    body: z.string().trim().min(1, "Write something.").max(5000), dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  }).safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success) return fail("invalid", parsed.error.issues[0]?.message ?? "Invalid entry.");
  const d = parsed.data;
  return staffAction(["business_development", "strategist"], async (user, tx) => {
    await tx`insert into public.pipeline_activities (opportunity_id, company_id, kind, body, actor_user_id, assignee_user_id, due_on)
             values (${d.opportunityId || null}, ${d.companyId}, ${d.kind}, ${d.body}, ${user.id}, ${d.kind === "task" ? user.id : null}, ${d.dueOn || null})`;
    return null;
  }, [`/command/companies/${d.companyId}`, "/command"]);
}

export async function completeTaskAction(activityId: string): Promise<ActionResult<null>> {
  if (!uuid.safeParse(activityId).success) return fail("invalid", "Invalid task.");
  return staffAction(["business_development", "strategist"], async (user, tx) => {
    await tx`update public.pipeline_activities set completed_at = now() where id = ${activityId} and kind = 'task'`;
    await audit(tx, { action: "task.completed", entityType: "pipeline_activity", entityId: activityId, actorUserId: user.id });
    return null;
  }, ["/command"]);
}

const COI_CHECKS = ["no_employer_program_relationship", "no_confidential_information_used", "no_employer_resources_used", "not_a_current_employer_counterparty"] as const;

export async function coiReviewAction(opportunityId: string, decision: "cleared" | "blocked", checks: Record<string, boolean>, notes: string): Promise<ActionResult<null>> {
  if (!uuid.safeParse(opportunityId).success || !["cleared", "blocked"].includes(decision)) return fail("invalid", "Invalid review.");
  if (decision === "cleared" && COI_CHECKS.some((c) => !checks[c])) return fail("invalid", "Every checklist item must be confirmed to clear the review.");
  if (decision === "blocked" && !notes.trim()) return fail("invalid", "Record why the opportunity is blocked.");
  return staffAction(["business_development", "strategist"], async (user, tx) => {
    const [opp] = await tx<{ company_id: string }[]>`select company_id from public.opportunities where id = ${opportunityId}`;
    if (!opp) throw new AppError("not_found", "Opportunity not found.");
    await tx`insert into public.conflict_of_interest_reviews (opportunity_id, company_id, status, checklist, notes, reviewer_user_id, reviewed_at)
             values (${opportunityId}, ${opp.company_id}, ${decision}, ${tx.json(checks)}, ${notes.trim() || null}, ${user.id}, now())`;
    await tx`update public.opportunities set coi_status = ${decision} where id = ${opportunityId}`;
    await tx`insert into public.pipeline_activities (opportunity_id, company_id, kind, body, actor_user_id)
             values (${opportunityId}, ${opp.company_id}, 'system', ${`Conflict-of-interest review: ${decision}`}, ${user.id})`;
    await audit(tx, { action: `coi.${decision}`, entityType: "opportunity", entityId: opportunityId, actorUserId: user.id });
    return null;
  }, ["/command/opportunities", "/command"]);
}

// ---------------------------------------------------------------------------
// Intelligence review
// ---------------------------------------------------------------------------
export async function verifyCredentialAction(credentialId: string, status: "verified" | "disputed" | "rejected", note: string): Promise<ActionResult<null>> {
  if (!uuid.safeParse(credentialId).success || !["verified", "disputed", "rejected"].includes(status)) return fail("invalid", "Invalid request.");
  return staffAction(["reviewer", "strategist"], async (user, tx) => {
    const [c] = await tx<{ source_url: string | null; company_id: string }[]>`select source_url, company_id from public.credentials where id = ${credentialId}`;
    if (!c) throw new AppError("not_found", "Credential not found.");
    if (status === "verified" && !c.source_url) throw new AppError("invalid", "A credential needs a source before it can be verified.");
    await tx`update public.credentials set verification_status = ${status}, verified_by = ${status === "verified" ? user.id : null},
               verified_at = ${status === "verified" ? new Date() : null}, notes = coalesce(notes || E'\n', '') || ${note || `Marked ${status}`} where id = ${credentialId}`;
    await audit(tx, { action: `credential.${status}`, entityType: "credential", entityId: credentialId, actorUserId: user.id, metadata: { note } });
    return null;
  }, ["/command/companies"]);
}

export async function reviewFactAction(factId: string, decision: "approved" | "rejected"): Promise<ActionResult<null>> {
  if (!uuid.safeParse(factId).success || !["approved", "rejected"].includes(decision)) return fail("invalid", "Invalid request.");
  return staffAction(["reviewer", "strategist"], async (user, tx) => {
    await tx`update public.company_facts set approval_status = ${decision}, approved_by = ${decision === "approved" ? user.id : null}, approved_at = ${decision === "approved" ? new Date() : null} where id = ${factId}`;
    await audit(tx, { action: `fact.${decision}`, entityType: "company_fact", entityId: factId, actorUserId: user.id });
    return null;
  }, ["/command/companies"]);
}

export async function reviewRunAction(runId: string, decision: "approved" | "rejected"): Promise<ActionResult<null>> {
  if (!uuid.safeParse(runId).success || !["approved", "rejected"].includes(decision)) return fail("invalid", "Invalid request.");
  const r = await staffAction(["strategist", "reviewer"], async (user, tx) => {
    // automation_runs is not writable by end-user roles; verify visibility under RLS, then write as system below.
    const [run] = await tx<{ id: string }[]>`select id from public.automation_runs where id = ${runId} and status = 'needs_review'`;
    if (!run) throw new AppError("not_found", "Nothing to review.");
    await audit(tx, { action: `automation_run.${decision}`, entityType: "automation_run", entityId: runId, actorUserId: user.id });
    return user.id;
  });
  if (!r.ok) return r;
  await withSystem(async (tx) => {
    await tx`update public.automation_runs set status = ${decision}, approved_by = ${r.data}, approved_at = now() where id = ${runId}`;
    await tx`update public.company_intelligence_records set status = 'reviewed', reviewed_by = ${r.data}, reviewed_at = now() where automation_run_id = ${runId}`;
  });
  revalidatePath("/command/intelligence");
  return ok(null);
}

// ---------------------------------------------------------------------------
// Catalog (pricing is configurable here; seed never overwrites)
// ---------------------------------------------------------------------------
const serviceUpdate = z.object({
  starting_price_cents: z.number().int().min(0).max(1e9),
  price_status: z.enum(["proposed", "approved"]),
  turnaround_weeks_min: z.number().int().min(1).max(104).nullable(),
  turnaround_weeks_max: z.number().int().min(1).max(104).nullable(),
  turnaround_confirmed: z.boolean(),
  included_revisions: z.number().int().min(0).max(10),
  is_published: z.boolean(),
  is_featured: z.boolean(),
}).refine((v) => v.turnaround_weeks_min === null || v.turnaround_weeks_max === null || v.turnaround_weeks_max >= v.turnaround_weeks_min, "Maximum weeks must be at least the minimum.");

export async function updateServiceAction(serviceId: string, patch: z.infer<typeof serviceUpdate>): Promise<ActionResult<null>> {
  const parsed = serviceUpdate.safeParse(patch);
  if (!uuid.safeParse(serviceId).success || !parsed.success) return fail("invalid", parsed.success ? "Invalid service." : parsed.error.issues[0]!.message);
  return staffAction(["finance"], async (user, tx) => {
    const [before] = await tx<{ starting_price_cents: number }[]>`select starting_price_cents from public.services where id = ${serviceId}`;
    if (!before) throw new AppError("not_found", "Service not found.");
    await tx`update public.services set ${tx({ ...parsed.data, updated_by: user.id })} where id = ${serviceId}`;
    await audit(tx, { action: "service.updated", entityType: "service", entityId: serviceId, actorUserId: user.id, metadata: { price_before: before.starting_price_cents, ...parsed.data } });
    return null;
  }, ["/command/catalog", "/marketplace", "/"]);
}

const packageUpdate = z.object({
  monthly_price_cents: z.number().int().min(1).max(1e9),
  price_status: z.enum(["proposed", "approved"]),
  min_term_months: z.number().int().min(1).max(36),
  revision_limit: z.number().int().min(0).max(10),
  production_hours_capacity: z.number().min(0).max(1000).nullable(),
  is_published: z.boolean(),
});

export async function updatePackageAction(packageId: string, patch: z.infer<typeof packageUpdate>): Promise<ActionResult<null>> {
  const parsed = packageUpdate.safeParse(patch);
  if (!uuid.safeParse(packageId).success || !parsed.success) return fail("invalid", "Invalid plan.");
  return staffAction(["finance"], async (user, tx) => {
    await tx`update public.service_packages set ${tx({ ...parsed.data, updated_by: user.id })} where id = ${packageId}`;
    await audit(tx, { action: "service_package.updated", entityType: "service_package", entityId: packageId, actorUserId: user.id, metadata: parsed.data });
    return null;
  }, ["/command/catalog", "/pricing"]);
}

// ---------------------------------------------------------------------------
// Inquiries, automations, team, saved filters, data requests
// ---------------------------------------------------------------------------
export async function updateInquiryAction(id: string, status: "new" | "in_progress" | "converted" | "closed" | "spam"): Promise<ActionResult<null>> {
  if (!uuid.safeParse(id).success || !["new", "in_progress", "converted", "closed", "spam"].includes(status)) return fail("invalid", "Invalid request.");
  return staffAction(["business_development", "strategist"], async (user, tx) => {
    await tx`update public.inquiries set status = ${status}, handled_by = ${user.id} where id = ${id}`;
    await audit(tx, { action: "inquiry.updated", entityType: "inquiry", entityId: id, actorUserId: user.id, metadata: { status } });
    return null;
  }, ["/command/inquiries"]);
}

export async function retryJobAction(jobId: string): Promise<ActionResult<null>> {
  if (!uuid.safeParse(jobId).success) return fail("invalid", "Invalid job.");
  const r = await staffAction(["administrator"], async (user, tx) => {
    await audit(tx, { action: "job.retried", entityType: "job", entityId: jobId, actorUserId: user.id });
    return null;
  });
  if (!r.ok) return r;
  await withSystem((tx) => retryJob(tx, jobId));
  revalidatePath("/command/automations");
  return ok(null);
}

const STAFF_ROLES = ["administrator", "business_development", "strategist", "creative_producer", "reviewer", "finance"] as const;

export async function grantRoleAction(_: unknown, form: FormData): Promise<ActionResult<null>> {
  const parsed = z.object({ email: z.string().trim().toLowerCase().email(), role: z.enum(STAFF_ROLES) }).safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success) return fail("invalid", "Enter an email and choose a role.");
  return staffAction(["administrator"], async (user, tx) => {
    const [p] = await tx<{ id: string }[]>`select id from public.profiles where email = ${parsed.data.email}`;
    if (!p) throw new AppError("not_found", "No account with that email. Ask them to sign in once first.");
    const member = await tx`select 1 from public.organization_memberships m join public.organizations o on o.id = m.organization_id where m.user_id = ${p.id} and o.kind = 'client'`;
    if (member.length) throw new AppError("conflict", "That account belongs to a client organization. Use a separate staff account.");
    await tx`insert into public.organization_memberships (organization_id, user_id, role, invited_by)
             select id, ${p.id}, ${parsed.data.role}, ${user.id} from public.organizations where kind = 'internal'
             on conflict (organization_id, user_id) do update set role = excluded.role`;
    await audit(tx, { action: "membership.granted", entityType: "profile", entityId: p.id, actorUserId: user.id, metadata: { role: parsed.data.role } });
    return null;
  }, ["/command/team"]);
}

export async function revokeRoleAction(membershipId: string): Promise<ActionResult<null>> {
  if (!uuid.safeParse(membershipId).success) return fail("invalid", "Invalid membership.");
  return staffAction(["administrator"], async (user, tx) => {
    const [m] = await tx<{ user_id: string; role: string }[]>`select user_id, role from public.organization_memberships where id = ${membershipId}`;
    if (!m) throw new AppError("not_found", "Membership not found.");
    if (m.user_id === user.id) throw new AppError("conflict", "You can't remove your own access.");
    if (m.role === "platform_owner") throw new AppError("forbidden", "Platform owners are managed from the command line.");
    await tx`delete from public.organization_memberships where id = ${membershipId}`;
    await audit(tx, { action: "membership.revoked", entityType: "profile", entityId: m.user_id, actorUserId: user.id, metadata: { role: m.role } });
    return null;
  }, ["/command/team"]);
}

export async function saveFilterAction(scope: string, name: string, filters: Record<string, string>): Promise<ActionResult<null>> {
  const parsed = z.object({ scope: z.enum(["opportunities", "applications"]), name: z.string().trim().min(1).max(60), filters: z.record(z.string(), z.string().max(100)) }).safeParse({ scope, name, filters });
  if (!parsed.success) return fail("invalid", "Name the view.");
  return staffAction([], async (user, tx) => {
    await tx`insert into public.saved_filters (user_id, scope, name, filters) values (${user.id}, ${scope}, ${parsed.data.name}, ${tx.json(filters)})
             on conflict (user_id, scope, name) do update set filters = excluded.filters`;
    return null;
  }, [`/command/${scope}`]);
}

export async function deleteFilterAction(id: string): Promise<ActionResult<null>> {
  if (!uuid.safeParse(id).success) return fail("invalid", "Invalid view.");
  return staffAction([], async (user, tx) => {
    await tx`delete from public.saved_filters where id = ${id} and user_id = ${user.id}`;
    return null;
  }, ["/command/opportunities", "/command/applications"]);
}

export async function updateDataRequestAction(id: string, status: "in_progress" | "completed" | "rejected"): Promise<ActionResult<null>> {
  if (!uuid.safeParse(id).success) return fail("invalid", "Invalid request.");
  return staffAction(["administrator"], async (user, tx) => {
    await tx`update public.data_requests set status = ${status}, completed_at = ${status === "completed" ? new Date() : null} where id = ${id}`;
    await audit(tx, { action: "data_request.updated", entityType: "data_request", entityId: id, actorUserId: user.id, metadata: { status } });
    return null;
  }, ["/command/settings"]);
}
