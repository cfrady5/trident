import { z } from "zod";
import { withAnon, withSystem, type Tx } from "../db";
import { randomToken, sha256 } from "../crypto";
import { audit } from "../audit";
import { emitEvent } from "../events";
import { layout, sendEmail } from "../email";
import { env } from "../env";
import { AppError, log } from "../errors";
import { normalizeWebsite } from "../intelligence/normalize";
import { scoreAssessment, type ScoreResult, type ScoringCategory, type ScoringCriterion } from "./scoring";

export interface ActiveFramework {
  id: string;
  key: string;
  version: number;
  name: string;
  methodologyNote: string;
  categories: (ScoringCategory & { description: string })[];
  criteria: (ScoringCriterion & { id: string; help: string | null })[];
}

async function loadFramework(tx: Tx, where: { id?: string }): Promise<ActiveFramework | null> {
  const [fw] = where.id
    ? await tx<{ id: string; key: string; version: number; name: string; methodology_note: string; categories: ActiveFramework["categories"] }[]>`
        select id, key, version, name, methodology_note, categories from public.assessment_frameworks where id = ${where.id}`
    : await tx<{ id: string; key: string; version: number; name: string; methodology_note: string; categories: ActiveFramework["categories"] }[]>`
        select id, key, version, name, methodology_note, categories from public.assessment_frameworks where key = 'commercial_readiness' and status = 'active'`;
  if (!fw) return null;
  const crit = await tx<{ id: string; key: string; category_key: string; prompt: string; help: string | null; weight: string; options: ScoringCriterion["options"]; improvement: string; service_slugs: string[] }[]>`
    select id, key, category_key, prompt, help, weight, options, improvement, service_slugs
    from public.assessment_criteria where framework_id = ${fw.id} order by sort`;
  return {
    id: fw.id, key: fw.key, version: fw.version, name: fw.name, methodologyNote: fw.methodology_note, categories: fw.categories,
    criteria: crit.map((c) => ({ id: c.id, key: c.key, category: c.category_key, prompt: c.prompt, help: c.help, weight: Number(c.weight), options: c.options, improvement: c.improvement, services: c.service_slugs })),
  };
}

export function activeFramework(): Promise<ActiveFramework | null> {
  return withAnon((tx) => loadFramework(tx, {}));
}

export const assessmentInput = z.object({
  respondentName: z.string().trim().min(1, "Enter your name.").max(120),
  respondentEmail: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  companyName: z.string().trim().min(1, "Enter your company name.").max(200),
  companyWebsite: z.string().trim().max(300).optional(),
  answers: z.record(z.string(), z.string().max(60)),
  consent: z.literal(true, { error: "Consent is required to save your results." }),
});

/** Scores and stores a self-assessment. Returns the private results token. */
export async function submitSelfAssessment(input: z.infer<typeof assessmentInput>, userId: string | null): Promise<{ id: string; token: string; result: ScoreResult }> {
  const fw = await activeFramework();
  if (!fw) throw new AppError("unavailable", "The assessment is not available right now.");
  const validKeys = new Set(fw.criteria.map((c) => c.key));
  for (const [k, v] of Object.entries(input.answers)) {
    const c = fw.criteria.find((x) => x.key === k);
    if (!validKeys.has(k) || !c?.options.some((o) => o.value === v)) throw new AppError("invalid", "One or more answers are invalid.");
  }
  if (Object.keys(input.answers).length < Math.ceil(fw.criteria.length / 2)) throw new AppError("invalid", "Answer at least half of the questions to get a result.");

  const result = scoreAssessment(fw.categories, fw.criteria, input.answers);
  const token = randomToken(24);
  const id = await withSystem(async (tx) => {
    const [a] = await tx<{ id: string }[]>`
      insert into public.assessments (framework_id, user_id, respondent_name, respondent_email, company_name, company_website, mode, status, review_state,
                                      overall_score, completeness, computed, access_token_hash, completed_at)
      values (${fw.id}, ${userId}, ${input.respondentName}, ${input.respondentEmail}, ${input.companyName}, ${normalizeWebsite(input.companyWebsite)},
              'self_assessment', 'completed', 'preliminary', ${result.overall}, ${result.completeness}, ${tx.json(result as never)}, ${sha256(token)}, now())
      returning id`;
    for (const c of fw.criteria) {
      const r = result.criteria.find((x) => x.key === c.key)!;
      await tx`
        insert into public.assessment_results (assessment_id, criterion_id, answer, score, explanation, confidence, missing_information, recommendation, service_slugs, source)
        values (${a!.id}, ${c.id}, ${r.answer}, ${r.score}, ${r.answerLabel ? `Self-reported: ${r.answerLabel}` : null}, ${r.missing ? null : "low"},
                ${r.missing ? "Not answered or marked 'Not sure'" : null}, ${r.recommendation}, ${r.services}, 'respondent')`;
    }
    await tx`insert into public.consent_records (user_id, email, subject_type, subject_id, consent_key, consent_version, granted, statement)
             values (${userId}, ${input.respondentEmail}, 'assessment', ${a!.id}, 'assessment_processing', '2026-11-v1', true,
                     'I agree that Trident may store my answers and contact me about my results.')`;
    await audit(tx, { action: "assessment.generated", entityType: "assessment", entityId: a!.id, actorUserId: userId, actorType: userId ? "user" : "system", metadata: { framework_version: fw.version, overall: result.overall } });
    await emitEvent(tx, { name: "assessment.generated", idempotencyKey: `assessment.generated:${a!.id}`, producer: "public_assessment", payload: { assessment_id: a!.id }, actorUserId: userId, subjectType: "assessment", subjectId: a!.id });
    return a!.id;
  });

  try {
    const url = `${env().APP_URL}/assessment/results/${id}?t=${token}`;
    const msg = layout({
      heading: "Your Commercial Readiness Index results",
      paragraphs: [
        `Your preliminary results for ${input.companyName} are ready. This link is private to you; keep it if you want to return to your results.`,
        "The index is Trident's own preliminary methodology based on your answers. It is not a certification or an industry benchmark.",
      ],
      cta: { label: "View your results", url },
    });
    await sendEmail({ to: input.respondentEmail, subject: "Your Commercial Readiness Index results", ...msg, tag: "assessment_results" });
  } catch (e) {
    log("warn", "assessment.email_failed", { id, error: (e as Error).message });
  }
  return { id, token, result };
}

/** Loads results for a token holder (respondent) without requiring an account. */
export async function loadAssessmentByToken(id: string, token: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id) || !token) return null;
  return withSystem(async (tx) => {
    const [a] = await tx<{ id: string; framework_id: string; company_name: string; respondent_name: string; review_state: string; computed: ScoreResult; completed_at: Date }[]>`
      select id, framework_id, company_name, respondent_name, review_state, computed, completed_at
      from public.assessments where id = ${id} and access_token_hash = ${sha256(token)}`;
    if (!a) return null;
    const fw = await loadFramework(tx, { id: a.framework_id });
    const services = await tx<{ slug: string; name: string; summary: string; starting_price_cents: number; pillar: string }[]>`
      select slug, name, summary, starting_price_cents, pillar from public.services where is_published`;
    return { assessment: a, framework: fw!, services };
  });
}
