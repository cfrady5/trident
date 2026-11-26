import { afterAll, describe, expect, it } from "vitest";
import { db, withSystem } from "@/lib/db";
import { saveAnswers, startApplication, submitApplication, completeStage, loadApplication } from "@/lib/application/service";
import { emitEvent } from "@/lib/events";
import { claimJobs, completeJob, enqueueJob, failJob, reclaimStale } from "@/lib/jobs/queue";
import { runJobs } from "@/lib/jobs/runner";
import { submitSelfAssessment } from "@/lib/index/service";
import { frameworkCriteria } from "@/content/readiness-framework";
import { allConsents, completeAnswers, createUser } from "../support/fixtures";

afterAll(async () => {
  await db().end();
});

describe("application submission pipeline", () => {
  it("saves, resumes and validates stages", async () => {
    const u = await createUser();
    const id = await startApplication(u, { companyName: "Resume Co" });
    expect(await startApplication(u, { companyName: "Another" })).toBe(id); // resumes the open draft
    const r = await saveAnswers(u.id, id, { website: "resume.example", industry: "bogus", unknown_key: "x" }, 2);
    expect(r.saved).toEqual(["website"]);
    expect(r.errors.industry).toBeDefined();
    const loaded = await loadApplication(u.id, id);
    expect(loaded!.answers.website).toBe("https://resume.example");
    expect(loaded!.answers.unknown_key).toBeUndefined();
    expect(loaded!.app.current_stage).toBe(2);
    expect(Object.keys(await completeStage(u.id, id, 1))).toEqual(expect.arrayContaining(["industry", "headquarters"]));
  });

  it("refuses incomplete submissions and missing consent", async () => {
    const u = await createUser();
    const id = await startApplication(u, { companyName: "Incomplete" });
    await expect(submitApplication(u, id, allConsents)).rejects.toThrow(/required answers/);
    await saveAnswers(u.id, id, completeAnswers({ website: "https://incomplete.example" }));
    await expect(submitApplication(u, id, { ...allConsents, no_restricted_information: false })).rejects.toThrow(/confirmations/);
  });

  it("creates one company, one opportunity, sourced facts, consents and an event", async () => {
    const u = await createUser("founder@lumalink.example");
    const id = await startApplication(u, { companyName: "LumaLink" });
    await saveAnswers(u.id, id, completeAnswers({ company_name: "LumaLink Inc.", website: "https://www.lumalink.example" }));
    const r = await submitApplication(u, id, allConsents);
    const check = await withSystem(async (tx) => ({
      company: (await tx`select domain, normalized_name, organization_id from public.companies where id = ${r.companyId}`)[0],
      opps: await tx`select stage, coi_status from public.opportunities where company_id = ${r.companyId}`,
      facts: await tx<{ provenance: string; verification_status: string; source_id: string | null }[]>`select provenance, verification_status, source_id from public.company_facts where company_id = ${r.companyId}`,
      creds: await tx<{ verification_status: string }[]>`select verification_status from public.credentials where company_id = ${r.companyId}`,
      consents: await tx`select 1 from public.consent_records where subject_id = ${id}`,
      events: await tx`select 1 from public.domain_events where name = 'application.submitted' and subject_id = ${id}`,
      jobs: await tx<{ kind: string }[]>`select kind from public.jobs where payload->>'application_id' = ${id}`,
      status: (await tx`select status from public.applications where id = ${id}`)[0],
    }));
    expect(check.company).toMatchObject({ domain: "lumalink.example", normalized_name: "lumalink" });
    expect(check.opps).toEqual([{ stage: "application_submitted", coi_status: "pending" }]);
    expect(check.facts.length).toBeGreaterThan(15);
    expect(check.facts.every((f) => f.provenance === "submitted" && f.verification_status === "self_reported" && f.source_id)).toBe(true);
    expect(check.creds.map((c) => c.verification_status).sort()).toEqual(["self_reported", "source_linked"]);
    expect(check.consents).toHaveLength(3);
    expect(check.events).toHaveLength(1);
    expect(check.jobs.map((j) => j.kind).sort()).toEqual(["notify.application_submitted", "research.initial"]);
    expect(check.status).toEqual({ status: "submitted" });
    await expect(submitApplication(u, id, allConsents)).rejects.toThrow(/already been submitted/);
  });

  it("never merges a domain owned by another client, and flags the duplicate", async () => {
    const a = await createUser();
    const aId = await startApplication(a, { companyName: "Dup One" });
    await saveAnswers(a.id, aId, completeAnswers({ website: "https://dup.example" }));
    const first = await submitApplication(a, aId, allConsents);
    const b = await createUser();
    const bId = await startApplication(b, { companyName: "Dup Two" });
    await saveAnswers(b.id, bId, completeAnswers({ website: "https://www.dup.example/about" }));
    const second = await submitApplication(b, bId, allConsents);
    expect(second.companyId).not.toBe(first.companyId);
    expect(second.duplicateOf).toBe(first.companyId);
    const notes = await withSystem((tx) => tx`select 1 from public.pipeline_activities where company_id = ${second.companyId} and body like 'Possible duplicate%'`);
    expect(notes).toHaveLength(1);
  });

  it("resubmission after a request for information reuses the opportunity and versions facts", async () => {
    const u = await createUser();
    const id = await startApplication(u, { companyName: "Resub" });
    await saveAnswers(u.id, id, completeAnswers({ website: "https://resub.example" }));
    const { companyId } = await submitApplication(u, id, allConsents);
    await withSystem((tx) => tx`update public.applications set status = 'needs_information' where id = ${id}`);
    await saveAnswers(u.id, id, { headquarters: "Austin, TX" });
    await submitApplication(u, id, allConsents);
    const r = await withSystem(async (tx) => ({
      opps: await tx`select 1 from public.opportunities where company_id = ${companyId}`,
      hq: await tx<{ version: number; is_current: boolean }[]>`select version, is_current from public.company_facts where company_id = ${companyId} and fact_key = 'headquarters' order by version`,
      events: await tx`select 1 from public.domain_events where name = 'application.submitted' and subject_id = ${id}`,
    }));
    expect(r.opps).toHaveLength(1);
    expect(r.hq).toEqual([{ version: 1, is_current: false }, { version: 2, is_current: true }]);
    expect(r.events).toHaveLength(2);
  });
});

describe("events and durable jobs", () => {
  it("emits events idempotently", async () => {
    const make = () => withSystem((tx) => emitEvent(tx, { name: "assessment.generated", idempotencyKey: "test:idem:1", producer: "test", payload: { assessment_id: "00000000-0000-0000-0000-000000000000" } }));
    const a = await make();
    const b = await make();
    expect(a.created).toBe(true);
    expect(b.created).toBe(false);
    expect(b.eventId).toBe(a.eventId);
  });

  it("validates required event data", async () => {
    await expect(withSystem((tx) => emitEvent(tx, { name: "application.submitted", idempotencyKey: "bad", producer: "test", payload: {} }))).rejects.toThrow(/missing required data/);
  });

  it("retries with backoff, then dead-letters", async () => {
    await withSystem((tx) => tx`update public.jobs set status = 'cancelled' where status = 'queued'`);
    await withSystem((tx) => enqueueJob(tx, { kind: "research.initial", payload: {}, idempotencyKey: "retry-test", maxAttempts: 2 }));
    expect(await withSystem((tx) => enqueueJob(tx, { kind: "research.initial", payload: {}, idempotencyKey: "retry-test" }))).toBeNull();
    let [job] = await withSystem((tx) => claimJobs(tx, "w1", 1));
    expect(job!.attempts).toBe(1);
    expect(await withSystem((tx) => claimJobs(tx, "w2", 1))).toHaveLength(0); // locked
    expect(await withSystem((tx) => failJob(tx, job!, "boom"))).toBe("queued");
    await withSystem((tx) => tx`update public.jobs set run_at = now() where id = ${job!.id}`);
    [job] = await withSystem((tx) => claimJobs(tx, "w1", 1));
    expect(job!.attempts).toBe(2);
    expect(await withSystem((tx) => failJob(tx, job!, "boom again"))).toBe("dead");
  });

  it("reclaims jobs whose worker died", async () => {
    await withSystem((tx) => enqueueJob(tx, { kind: "research.initial", payload: {}, idempotencyKey: "stale-test", timeoutSeconds: 1 }));
    const [job] = await withSystem((tx) => claimJobs(tx, "crashed", 1));
    await withSystem((tx) => tx`update public.jobs set locked_at = now() - interval '5 minutes' where id = ${job!.id}`);
    expect(await withSystem((tx) => reclaimStale(tx))).toBeGreaterThanOrEqual(1);
    const [row] = await withSystem((tx) => tx<{ status: string }[]>`select status from public.jobs where id = ${job!.id}`);
    expect(row!.status).toBe("queued");
    await withSystem((tx) => completeJob(tx, job!.id, {}));
  });

  it("runs the submission jobs end to end without simulating AI", async () => {
    await withSystem((tx) => tx`update public.jobs set status = 'cancelled' where status = 'queued'`);
    const u = await createUser("ceo@runner.example");
    const id = await startApplication(u, { companyName: "Runner Co" });
    await saveAnswers(u.id, id, completeAnswers({ website: "https://runner.invalid" }));
    const { companyId } = await submitApplication(u, id, allConsents);
    const summary = await runJobs({ workerId: "test", limit: 10, budgetMs: 30_000 });
    expect(summary.succeeded).toBe(2);
    const r = await withSystem(async (tx) => ({
      run: (await tx<{ status: string; steps: { key: string; status: string }[] }[]>`select status, steps from public.automation_runs where company_id = ${companyId}`)[0],
      mail: await tx<{ to_email: string }[]>`select to_email from app_private.dev_outbox where to_email = ${u.email}`,
      opp: (await tx<{ stage: string }[]>`select stage from public.opportunities where company_id = ${companyId}`)[0],
      report: await tx`select 1 from public.company_intelligence_records where company_id = ${companyId} and status = 'needs_review'`,
    }));
    expect(r.run!.status).toBe("needs_review");
    expect(r.run!.steps.find((s) => s.key === "ai_messaging")!.status).toBe("blocked_unconfigured");
    expect(r.run!.steps.find((s) => s.key === "website")!.status).toBe("failed"); // .invalid never resolves
    expect(r.mail).toHaveLength(1);
    expect(r.opp!.stage).toBe("research_in_progress");
    expect(r.report).toHaveLength(1);
  });
});

describe("readiness self-assessment", () => {
  it("scores, stores results and gives the respondent a private token", async () => {
    const answers = Object.fromEntries(frameworkCriteria.map((c) => [c.key, c.options[1]!.value]));
    const r = await submitSelfAssessment({ respondentName: "R", respondentEmail: "r@x.example", companyName: "X", answers, consent: true }, null);
    expect(r.token.length).toBeGreaterThan(20);
    const rows = await withSystem((tx) => tx<{ access_token_hash: string; overall_score: string }[]>`select access_token_hash, overall_score from public.assessments where id = ${r.id}`);
    expect(rows[0]!.access_token_hash).not.toBe(r.token); // only the hash is stored
    expect(Number(rows[0]!.overall_score)).toBe(r.result.overall);
    expect(await withSystem((tx) => tx`select 1 from public.assessment_results where assessment_id = ${r.id}`)).toHaveLength(frameworkCriteria.length);
  });
  it("rejects invalid answers", async () => {
    await expect(submitSelfAssessment({ respondentName: "R", respondentEmail: "r@x.example", companyName: "X", answers: { crm: "hacked" }, consent: true }, null)).rejects.toThrow(/invalid/);
  });
});
