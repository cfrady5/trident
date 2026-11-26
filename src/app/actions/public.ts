"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { withSystem } from "@/lib/db";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { requestMagicLink, safeRedirect } from "@/lib/auth";
import { assessmentInput, submitSelfAssessment } from "@/lib/index/service";
import { currentUser } from "@/lib/auth";
import { layout, sendEmail, staffRecipients } from "@/lib/email";
import { normalizeWebsite } from "@/lib/intelligence/normalize";
import { audit } from "@/lib/audit";
import { AppError, type ActionResult, fail, ok, toActionError } from "@/lib/errors";
import { env } from "@/lib/env";

const contactSchema = z.object({
  kind: z.enum(["contact", "proposal_request"]),
  fullName: z.string().trim().min(1, "Enter your name.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  companyName: z.string().trim().max(200).optional(),
  website: z.string().trim().max(300).optional(),
  message: z.string().trim().max(5000).optional(),
  services: z.array(z.string().regex(/^[a-z0-9-]+$/)).max(12),
  consent: z.literal(true, { error: "Please confirm we may contact you about this request." }),
  // Honeypot: real users never fill this in.
  company_url_confirm: z.string().max(0).optional(),
});

function fieldErrors(e: z.ZodError): Record<string, string> {
  return Object.fromEntries(e.issues.map((i) => [String(i.path[0]), i.message]));
}

export async function submitInquiry(_: unknown, form: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = contactSchema.safeParse({
      kind: form.get("kind"), fullName: form.get("fullName"), email: form.get("email"),
      companyName: form.get("companyName") || undefined, website: form.get("website") || undefined, message: form.get("message") || undefined,
      services: String(form.get("services") ?? "").split(",").filter(Boolean), consent: form.get("consent") === "on",
      company_url_confirm: (form.get("company_url_confirm") as string) || undefined,
    });
    if (!parsed.success) return fail("invalid", "Check the highlighted fields.", fieldErrors(parsed.error));
    if (!(await rateLimit(`inquiry:${await clientKey()}`, 5, 3600))) return fail("rate_limited", "Too many requests. Please try again later.");
    const d = parsed.data;
    const id = await withSystem(async (tx) => {
      const valid = (await tx<{ slug: string }[]>`select slug from public.services where slug = any(${d.services}) and is_published`).map((r) => r.slug);
      const [row] = await tx<{ id: string }[]>`
        insert into public.inquiries (kind, full_name, email, company_name, website, message, service_slugs, consent_contact)
        values (${d.kind}, ${d.fullName}, ${d.email}, ${d.companyName ?? null}, ${normalizeWebsite(d.website)}, ${d.message ?? null}, ${valid}, true)
        returning id`;
      await audit(tx, { action: "inquiry.received", entityType: "inquiry", entityId: row!.id, actorType: "system", metadata: { kind: d.kind } });
      return row!.id;
    });
    const msg = layout({ heading: `${d.kind === "proposal_request" ? "Proposal request" : "Inquiry"}: ${d.companyName ?? d.fullName}`, paragraphs: [`From ${d.fullName}.`, d.services.length ? `Services: ${d.services.join(", ")}` : "No services selected."], cta: { label: "Open in Trident Command", url: `${env().APP_URL}/command/inquiries` } });
    for (const to of staffRecipients()) await sendEmail({ to, subject: `New ${d.kind.replace("_", " ")}`, ...msg, tag: "staff_inquiry" }).catch(() => undefined);
    return ok({ id });
  } catch (e) {
    return toActionError(e);
  }
}

export async function requestLogin(_: unknown, form: FormData): Promise<ActionResult<{ email: string; devLink?: string }>> {
  try {
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    if (!z.string().email().safeParse(email).success) return fail("invalid", "Enter a valid email address.", { email: "Enter a valid email address." });
    const key = await clientKey();
    if (!(await rateLimit(`login:${key}`, 10, 900)) || !(await rateLimit(`login-email:${email}`, 5, 900))) {
      return fail("rate_limited", "Too many sign-in requests. Wait a few minutes and try again.");
    }
    const r = await requestMagicLink({ email, fullName: String(form.get("fullName") ?? "").trim() || undefined, redirectTo: safeRedirect(String(form.get("next") ?? ""), "/portal") });
    return ok({ email, devLink: r.devLink });
  } catch (e) {
    return toActionError(e);
  }
}

export async function submitAssessment(_: unknown, form: FormData): Promise<ActionResult<never>> {
  let target = "";
  try {
    const answers: Record<string, string> = {};
    for (const [k, v] of form.entries()) if (k.startsWith("q_") && typeof v === "string" && v) answers[k.slice(2)] = v;
    const parsed = assessmentInput.safeParse({
      respondentName: form.get("respondentName"), respondentEmail: form.get("respondentEmail"), companyName: form.get("companyName"),
      companyWebsite: form.get("companyWebsite") || undefined, answers, consent: form.get("consent") === "on",
    });
    if (!parsed.success) return fail("invalid", "Check the highlighted fields.", fieldErrors(parsed.error));
    if (!(await rateLimit(`assessment:${await clientKey()}`, 8, 3600))) return fail("rate_limited", "Too many submissions. Please try again later.");
    const user = await currentUser().catch(() => null);
    const r = await submitSelfAssessment(parsed.data, user?.id ?? null);
    target = `/assessment/results/${r.id}?t=${r.token}`;
  } catch (e) {
    if (e instanceof AppError) return fail(e.code, e.message);
    return toActionError(e);
  }
  redirect(target);
}
