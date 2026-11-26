"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { runJobs } from "@/lib/jobs/runner";
import { log } from "@/lib/errors";
import { requireUser } from "@/lib/auth";
import { completeStage, saveAnswers, startApplication, submitApplication } from "@/lib/application/service";
import { CONSENTS, type Answers, type ConsentKey } from "@/lib/application/questions";
import { type ActionResult, fail, ok, toActionError, AppError } from "@/lib/errors";
import { withUser, isPermissionError } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

const UUID = /^[0-9a-f-]{36}$/i;

export async function startApplicationAction(_: unknown, form: FormData): Promise<ActionResult<never>> {
  let id = "";
  try {
    const user = await requireUser("/apply");
    id = await startApplication(user, { companyName: String(form.get("companyName") ?? ""), contactName: String(form.get("contactName") ?? "") });
  } catch (e) {
    return toActionError(e);
  }
  redirect(`/apply/${id}`);
}

export async function autosaveAction(applicationId: string, patch: Answers, stage?: number): Promise<ActionResult<{ saved: string[]; errors: Record<string, string>; at: string }>> {
  try {
    if (!UUID.test(applicationId)) return fail("invalid", "Unknown application.");
    const user = await requireUser();
    if (!(await rateLimit(`autosave:${user.id}`, 240, 60))) return fail("rate_limited", "Saving too quickly. Your changes will save in a moment.");
    const r = await saveAnswers(user.id, applicationId, patch, stage);
    return ok({ ...r, at: new Date().toISOString() });
  } catch (e) {
    if (isPermissionError(e)) return fail("forbidden", "This application can no longer be edited.");
    return toActionError(e);
  }
}

export async function completeStageAction(applicationId: string, stage: number): Promise<ActionResult<{ errors: Record<string, string> }>> {
  try {
    const user = await requireUser();
    const errors = await completeStage(user.id, applicationId, stage);
    revalidatePath(`/apply/${applicationId}`);
    return ok({ errors });
  } catch (e) {
    return toActionError(e);
  }
}

export async function submitApplicationAction(applicationId: string, consents: Record<string, boolean>): Promise<ActionResult<{ companyId: string }>> {
  try {
    const user = await requireUser();
    const c = Object.fromEntries(CONSENTS.map((x) => [x.key, consents[x.key] === true])) as Record<ConsentKey, boolean>;
    const r = await submitApplication(user, applicationId, c);
    revalidatePath("/portal");
    // Start the triggered jobs now; Vercel Cron / the worker remains the durable fallback.
    after(() => runJobs({ workerId: "after-submit", limit: 5, budgetMs: 45_000 }).catch((e) => log("warn", "jobs.after_submit_failed", { error: (e as Error).message })));
    return ok({ companyId: r.companyId });
  } catch (e) {
    if (e instanceof AppError && e.details?.errors) return fail("invalid", e.message, e.details.errors as Record<string, string>);
    return toActionError(e);
  }
}

export async function deleteFileAction(fileId: string): Promise<ActionResult<null>> {
  try {
    const user = await requireUser();
    if (!UUID.test(fileId)) return fail("invalid", "Unknown file.");
    const [row] = await withUser(user.id, (tx) => tx<{ deleted: boolean }[]>`select app_private.request_file_deletion(${fileId}) as deleted`);
    if (!row?.deleted) return fail("not_found", "File not found.");
    return ok(null);
  } catch (e) {
    return toActionError(e);
  }
}

/**
 * Website URL import: fetches the applicant's public homepage (SSRF-guarded,
 * robots.txt respected) and proposes values for empty fields. Proposed values
 * are stored as provenance=imported, confirmed=false; submission is blocked
 * until the applicant confirms or edits each one.
 */
export async function importFromWebsiteAction(applicationId: string): Promise<ActionResult<{ imported: Record<string, string> }>> {
  try {
    const user = await requireUser();
    if (!UUID.test(applicationId)) return fail("invalid", "Unknown application.");
    if (!(await rateLimit(`import:${user.id}`, 6, 3600))) return fail("rate_limited", "Import limit reached. Try again later.");
    const { fetchPublicPage, analyzeHtml } = await import("@/lib/intelligence/safe-fetch");
    const rows = await withUser(user.id, (tx) => tx<{ question_key: string; value: unknown }[]>`
      select question_key, value from public.application_answers where application_id = ${applicationId}`);
    const answers = Object.fromEntries(rows.map((r) => [r.question_key, r.value]));
    const website = typeof answers.website === "string" ? answers.website : "";
    if (!website) return fail("invalid", "Add your website first.");
    let page;
    try {
      page = analyzeHtml((await fetchPublicPage(website)).html);
    } catch (e) {
      return fail("unavailable", `We couldn't read your website: ${(e as Error).message}`);
    }
    const proposals: Record<string, string> = {};
    const empty = (k: string) => !answers[k] || (typeof answers[k] === "string" && !(answers[k] as string).trim());
    if (empty("technology_description") && page.description) proposals.technology_description = page.description.slice(0, 3000);
    if (empty("technology_name") && page.h1[0]) proposals.technology_name = page.h1[0].slice(0, 160);
    const li = page.textSample && /linkedin\.com\/company\/[\w-]+/i.exec(page.textSample);
    if (empty("linkedin_url") && li) proposals.linkedin_url = `https://www.${li[0]}`;
    if (Object.keys(proposals).length === 0) return ok({ imported: {} });
    await withUser(user.id, async (tx) => {
      for (const [k, v] of Object.entries(proposals)) {
        await tx`insert into public.application_answers (application_id, question_key, value, provenance, confirmed, updated_by)
                 values (${applicationId}, ${k}, ${tx.json(v)}, 'imported', false, ${user.id})
                 on conflict (application_id, question_key) do update set value = excluded.value, provenance = 'imported', confirmed = false, updated_by = excluded.updated_by, updated_at = now()`;
      }
    });
    return ok({ imported: proposals });
  } catch (e) {
    return toActionError(e);
  }
}
