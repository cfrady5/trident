/**
 * Application lifecycle. Reads and applicant writes run under RLS (withUser).
 * Submission validates under RLS first, then runs one system transaction that
 * creates or links the company profile (deduplicated by domain), records every
 * answer as a source-backed, self-reported fact, creates or advances a single
 * opportunity, stores consents and emits `application.submitted`.
 */
import type { CurrentUser } from "../auth";
import { withSystem, withUser, type Tx } from "../db";
import { audit } from "../audit";
import { emitEvent } from "../events";
import { AppError } from "../errors";
import { domainFromUrl, normalizeCompanyName, normalizeWebsite, slugify } from "../intelligence/normalize";
import { randomToken } from "../crypto";
import {
  CONSENTS, QUESTIONS, STAGES, allErrors, isVisible, normalizeAnswer, questionByKey, stageErrors, validateAnswer,
  type Answers, type ConsentKey, type CredentialEntry,
} from "./questions";

export interface ApplicationRecord {
  id: string;
  organization_id: string;
  company_id: string | null;
  status: "draft" | "submitted" | "under_review" | "needs_information" | "accepted" | "declined" | "withdrawn";
  current_stage: number;
  completed_stages: number[];
  submitted_at: Date | null;
  decision_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface FileRecord {
  id: string;
  original_name: string;
  category: string;
  size_bytes: string;
  content_type: string;
  scan_status: string;
  quarantine_status: string;
  screening_notes: { check: string; result: string; detail: string }[];
  created_at: Date;
}

export const EDITABLE_STATUSES = ["draft", "needs_information"] as const;

export async function publishedServiceSlugs(tx: Tx): Promise<{ slug: string; name: string }[]> {
  return tx<{ slug: string; name: string }[]>`select slug, name from public.services where is_published order by sort`;
}

/** Starts (or resumes) the applicant's application. Creates their client organization. */
export async function startApplication(user: CurrentUser, input: { companyName: string; contactName?: string }): Promise<string> {
  const companyName = input.companyName.trim();
  if (companyName.length < 2 || companyName.length > 200) throw new AppError("invalid", "Enter your company name.");

  const existing = await withUser(user.id, (tx) => tx<{ id: string }[]>`
    select a.id from public.applications a
    where a.created_by = ${user.id} and a.status in ('draft', 'needs_information')
    order by a.updated_at desc limit 1`);
  if (existing[0]) return existing[0].id;

  return withSystem(async (tx) => {
    const [org] = await tx<{ id: string }[]>`
      insert into public.organizations (kind, name, slug)
      values ('client', ${companyName}, ${`${slugify(companyName, 50)}-${randomToken(4).toLowerCase().replace(/[^a-z0-9]/g, "x").slice(0, 6)}`})
      returning id`;
    await tx`insert into public.organization_memberships (organization_id, user_id, role) values (${org!.id}, ${user.id}, 'client_admin')`;
    const [app] = await tx<{ id: string }[]>`
      insert into public.applications (organization_id, created_by) values (${org!.id}, ${user.id}) returning id`;
    const seed: Answers = { company_name: companyName, contact_name: input.contactName?.trim() || user.fullName || "" };
    for (const [key, value] of Object.entries(seed)) {
      if (!value) continue;
      await tx`insert into public.application_answers (application_id, question_key, value, updated_by)
               values (${app!.id}, ${key}, ${tx.json(value as never)}, ${user.id})`;
    }
    await tx`insert into public.application_status_history (application_id, to_status, actor_user_id, note)
             values (${app!.id}, 'draft', ${user.id}, 'Application started')`;
    await audit(tx, { action: "application.created", entityType: "application", entityId: app!.id, organizationId: org!.id, actorUserId: user.id, actorType: "user" });
    await emitEvent(tx, {
      name: "application.created", idempotencyKey: `application.created:${app!.id}`, producer: "applicant",
      payload: { application_id: app!.id, organization_id: org!.id }, actorUserId: user.id, organizationId: org!.id,
      subjectType: "application", subjectId: app!.id,
    });
    return app!.id;
  });
}

export async function loadApplication(userId: string, applicationId: string) {
  return withUser(userId, async (tx) => {
    const [app] = await tx<ApplicationRecord[]>`select * from public.applications where id = ${applicationId}`;
    if (!app) return null;
    const rows = await tx<{ question_key: string; value: unknown; provenance: string; confirmed: boolean }[]>`
      select question_key, value, provenance, confirmed from public.application_answers where application_id = ${applicationId}`;
    const answers: Answers = Object.fromEntries(rows.map((r) => [r.question_key, r.value]));
    const unconfirmed = rows.filter((r) => !r.confirmed).map((r) => r.question_key);
    const files = await tx<FileRecord[]>`
      select id, original_name, category, size_bytes, content_type, scan_status, quarantine_status, screening_notes, created_at
      from public.files where application_id = ${applicationId} and deleted_at is null order by created_at`;
    const history = await tx<{ to_status: string; note: string | null; created_at: Date }[]>`
      select to_status, note, created_at from public.application_status_history where application_id = ${applicationId} order by created_at`;
    const services = await publishedServiceSlugs(tx);
    return { app, answers, unconfirmed, files, history, services };
  });
}

/**
 * Autosave. Saves every valid field and returns errors for invalid ones.
 * RLS rejects writes when the application is not editable by this user.
 */
export async function saveAnswers(userId: string, applicationId: string, patch: Answers, currentStage?: number): Promise<{ saved: string[]; errors: Record<string, string> }> {
  const errors: Record<string, string> = {};
  const valid: [string, unknown][] = [];
  return withUser(userId, async (tx) => {
    const services = (await publishedServiceSlugs(tx)).map((s) => s.slug);
    for (const [key, raw] of Object.entries(patch)) {
      const q = questionByKey(key);
      if (!q) continue; // unknown keys are ignored, never stored
      const value = normalizeAnswer(q, raw);
      const empty = value === "" || (Array.isArray(value) && value.length === 0);
      const err = empty ? null : validateAnswer({ ...q, required: false }, value, services);
      if (err) errors[key] = err;
      else valid.push([key, value]);
    }
    const [app] = await tx<{ status: string }[]>`select status from public.applications where id = ${applicationId}`;
    if (!app) throw new AppError("not_found", "Application not found.");
    if (!EDITABLE_STATUSES.includes(app.status as never)) throw new AppError("forbidden", "This application can no longer be edited.");
    for (const [key, value] of valid) {
      await tx`
        insert into public.application_answers (application_id, question_key, value, provenance, confirmed, updated_by, updated_at)
        values (${applicationId}, ${key}, ${tx.json(value as never)}, 'submitted', true, ${userId}, now())
        on conflict (application_id, question_key) do update
          set value = excluded.value, provenance = 'submitted', confirmed = true, updated_by = excluded.updated_by, updated_at = now()`;
    }
    if (currentStage && currentStage >= 1 && currentStage <= 7) {
      await tx`update public.applications set current_stage = ${currentStage}, updated_at = now() where id = ${applicationId}`;
    } else if (valid.length) {
      await tx`update public.applications set updated_at = now() where id = ${applicationId}`;
    }
    return { saved: valid.map(([k]) => k), errors };
  });
}

/** Validates a stage's required fields and records it complete. */
export async function completeStage(userId: string, applicationId: string, stage: number): Promise<Record<string, string>> {
  if (stage < 1 || stage > 6) throw new AppError("invalid", "Unknown stage.");
  const loaded = await loadApplication(userId, applicationId);
  if (!loaded) throw new AppError("not_found", "Application not found.");
  const errors = stageErrors(stage, loaded.answers, loaded.services.map((s) => s.slug));
  if (Object.keys(errors).length) return errors;
  const completed = Array.from(new Set([...loaded.app.completed_stages, stage])).sort();
  await withUser(userId, (tx) => tx`
    update public.applications set completed_stages = ${completed}, current_stage = ${Math.min(7, stage + 1)} where id = ${applicationId}`);
  return {};
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export async function submitApplication(user: CurrentUser, applicationId: string, consents: Record<ConsentKey, boolean>): Promise<{ companyId: string; opportunityId: string; duplicateOf: string | null }> {
  const loaded = await loadApplication(user.id, applicationId);
  if (!loaded) throw new AppError("not_found", "Application not found.");
  const { app, answers } = loaded;
  if (!EDITABLE_STATUSES.includes(app.status as never)) throw new AppError("conflict", "This application has already been submitted.");
  const errors = allErrors(answers, loaded.services.map((s) => s.slug));
  if (Object.keys(errors).length) throw new AppError("invalid", `Some required answers are missing or invalid (${Object.keys(errors).length}). Review each stage before submitting.`, { errors });
  if (loaded.unconfirmed.length) throw new AppError("invalid", "Confirm the imported answers before submitting.");
  for (const c of CONSENTS) if (!consents[c.key]) throw new AppError("invalid", "All three confirmations are required to submit.");

  return withSystem(async (tx) => {
    const [locked] = await tx<{ status: string; submitted_at: Date | null }[]>`
      select status, submitted_at from public.applications where id = ${applicationId} for update`;
    if (!locked || !EDITABLE_STATUSES.includes(locked.status as never)) throw new AppError("conflict", "This application has already been submitted.");
    const isResubmission = locked.status === "needs_information";

    const name = str(answers.company_name)!;
    const website = normalizeWebsite(str(answers.website));
    const domain = domainFromUrl(website);
    const companyFields = {
      name, normalized_name: normalizeCompanyName(name), website, linkedin_url: normalizeWebsite(str(answers.linkedin_url)),
      industry: str(answers.industry), headquarters: str(answers.headquarters), employee_range: str(answers.employee_range),
      maturity: str(answers.company_maturity), description: str(answers.technology_description),
    };

    // ---- Company: link by domain, never duplicate ---------------------------
    let companyId = app.company_id;
    let duplicateOf: string | null = null;
    if (!companyId && domain) {
      const [match] = await tx<{ id: string; organization_id: string | null }[]>`
        select id, organization_id from public.companies where domain = ${domain} and merged_into_id is null for update`;
      if (match && (match.organization_id === null || match.organization_id === app.organization_id)) {
        companyId = match.id;
        await tx`update public.companies set organization_id = ${app.organization_id} where id = ${match.id}`;
      } else if (match) {
        duplicateOf = match.id; // owned by another client: never merge automatically
      }
    }
    if (companyId) {
      await tx`update public.companies set ${tx(companyFields)} where id = ${companyId}`;
    } else {
      const [created] = await tx<{ id: string }[]>`
        insert into public.companies ${tx({ ...companyFields, organization_id: app.organization_id, domain: duplicateOf ? null : domain, created_by: user.id, slug: `${slugify(name, 50)}-${applicationId.slice(0, 6)}` })}
        returning id`;
      companyId = created!.id;
    }

    // ---- Contact, consents --------------------------------------------------
    await tx`
      insert into public.company_contacts (company_id, user_id, full_name, role_title, email, is_primary, contact_permission)
      values (${companyId}, ${user.id}, ${str(answers.contact_name) ?? user.email}, ${str(answers.contact_role)}, ${user.email}, true, 'transactional_only')
      on conflict (company_id, email) do update set full_name = excluded.full_name, role_title = excluded.role_title, user_id = excluded.user_id`;
    for (const c of CONSENTS) {
      await tx`insert into public.consent_records (user_id, email, organization_id, subject_type, subject_id, consent_key, consent_version, granted, statement)
               values (${user.id}, ${user.email}, ${app.organization_id}, 'application', ${applicationId}, ${c.key}, ${c.version}, true, ${c.statement})`;
    }

    // ---- Facts: every answer becomes a sourced, self-reported fact ----------
    const [source] = await tx<{ id: string }[]>`
      insert into public.intelligence_sources (company_id, source_type, title, notes, created_by)
      values (${companyId}, 'application', ${`Company application ${applicationId.slice(0, 8)}`}, ${`Submitted by ${user.email}`}, ${user.id})
      returning id`;
    for (const q of QUESTIONS) {
      if (!q.factSection || q.type === "credentials" || !isVisible(q, answers)) continue;
      const value = answers[q.key];
      if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) continue;
      const [prev] = await tx<{ id: string; version: number }[]>`
        update public.company_facts set is_current = false
        where company_id = ${companyId} and section = ${q.factSection} and fact_key = ${q.key} and provenance = 'submitted' and is_current
        returning id, version`;
      await tx`
        insert into public.company_facts (company_id, section, fact_key, value, provenance, source_id, verification_status, approval_status, visibility, version, supersedes_id, created_by)
        values (${companyId}, ${q.factSection}, ${q.key}, ${tx.json(value as never)}, 'submitted', ${source!.id}, 'self_reported', 'pending', 'client',
                ${(prev?.version ?? 0) + 1}, ${prev?.id ?? null}, ${user.id})`;
    }

    // ---- Credentials: each claim keeps its own source and status -----------
    await tx`delete from public.credentials where application_id = ${applicationId} and verification_status in ('self_reported', 'source_linked')`;
    const creds = (Array.isArray(answers.credentials) ? answers.credentials : []) as CredentialEntry[];
    if (str(answers.sbir_status) === "awarded" && str(answers.sbir_agency)) {
      creds.unshift({ type: "sbir_award", title: `SBIR/STTR ${String(answers.sbir_phase ?? "").replace(/_/g, " ")}`.trim(), agency: str(answers.sbir_agency)! });
    }
    for (const c of creds) {
      const date = c.date ? (c.date.length === 7 ? `${c.date}-01` : c.date) : null;
      await tx`
        insert into public.credentials (company_id, credential_type, title, agency, identifier, awarded_on, source_url, provenance, verification_status, publicly_shareable, application_id)
        values (${companyId}, ${c.type}, ${c.title}, ${c.agency ?? null}, ${c.identifier ?? null}, ${date}, ${c.sourceUrl ?? null},
                'submitted', ${c.sourceUrl ? "source_linked" : "self_reported"}, ${c.publiclyShareable ?? false}, ${applicationId})`;
    }

    // ---- Brand profile ------------------------------------------------------
    const split = (v: unknown) => (str(v) ?? "").split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    await tx`
      insert into public.brand_profiles (company_id, colors, fonts, has_guidelines, preferences)
      values (${companyId}, ${tx.json(split(answers.brand_colors))}, ${tx.json(split(answers.brand_fonts))},
              ${str(answers.has_brand_guidelines) === "yes"}, ${str(answers.brand_preferences)})
      on conflict (company_id) do update set colors = excluded.colors, fonts = excluded.fonts,
        has_guidelines = excluded.has_guidelines, preferences = excluded.preferences, version = public.brand_profiles.version + 1`;
    await tx`update public.files set company_id = ${companyId} where application_id = ${applicationId}`;

    // ---- Opportunity: exactly one open per company --------------------------
    const [open] = await tx<{ id: string; stage: string }[]>`
      select id, stage from public.opportunities where company_id = ${companyId} and closed_at is null for update`;
    let opportunityId: string;
    if (open) {
      opportunityId = open.id;
      if (["identified", "invited", "application_started"].includes(open.stage)) {
        await tx`update public.opportunities set stage = 'application_submitted', application_id = ${applicationId} where id = ${open.id}`;
      }
    } else {
      const [opp] = await tx<{ id: string }[]>`
        insert into public.opportunities (company_id, application_id, title, stage, source, coi_status, next_action, next_action_due)
        values (${companyId}, ${applicationId}, ${`${name} — application`}, 'application_submitted', 'application', 'pending',
                'Review application and complete conflict-of-interest screening', current_date + 2)
        returning id`;
      opportunityId = opp!.id;
    }
    await tx`
      insert into public.pipeline_activities (opportunity_id, company_id, kind, body, metadata, actor_user_id)
      values (${opportunityId}, ${companyId}, 'system', ${isResubmission ? "Application resubmitted with requested information" : "Application submitted"},
              ${tx.json({ application_id: applicationId, duplicate_of: duplicateOf })}, ${user.id})`;
    if (duplicateOf) {
      await tx`
        insert into public.pipeline_activities (opportunity_id, company_id, kind, body, metadata)
        values (${opportunityId}, ${companyId}, 'system', 'Possible duplicate: another client organization already holds a company with this domain. Review before merging.',
                ${tx.json({ duplicate_of: duplicateOf, domain })})`;
    }

    // ---- Application status -------------------------------------------------
    await tx`update public.applications set status = 'submitted', submitted_at = now(), company_id = ${companyId},
               consent_version = ${CONSENTS[0].version}, completed_stages = ${STAGES.slice(0, 6).map((s) => s.number)}, current_stage = 7
             where id = ${applicationId}`;
    await tx`insert into public.application_status_history (application_id, from_status, to_status, actor_user_id, note)
             values (${applicationId}, ${locked.status}, 'submitted', ${user.id}, ${isResubmission ? "Resubmitted" : "Submitted for review"})`;
    const [countRow] = await tx<{ n: number }[]>`select count(*)::int as n from public.application_status_history where application_id = ${applicationId} and to_status = 'submitted'`;
    const n = countRow?.n ?? 1;
    await audit(tx, { action: "application.submitted", entityType: "application", entityId: applicationId, organizationId: app.organization_id, actorUserId: user.id, actorType: "user", metadata: { company_id: companyId, opportunity_id: opportunityId, duplicate_of: duplicateOf } });
    await emitEvent(tx, {
      name: "application.submitted", idempotencyKey: `application.submitted:${applicationId}:${n}`, producer: "applicant",
      payload: { application_id: applicationId, company_id: companyId, opportunity_id: opportunityId, resubmission: isResubmission },
      actorUserId: user.id, organizationId: app.organization_id, subjectType: "application", subjectId: applicationId,
    });
    return { companyId, opportunityId, duplicateOf };
  });
}
