import type { Metadata } from "next";
import Link from "next/link";
import { Container, Eyebrow, Notice } from "@/components/ui/primitives";
import { ButtonLink, Arrow } from "@/components/ui/button";
import { LoginForm } from "@/components/forms/login-form";
import { StartApplicationForm } from "@/components/forms/start-application-form";
import { currentUser } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { STAGES } from "@/lib/application/questions";

export const metadata: Metadata = { title: "Apply", description: "Share your company profile once. We use it for everything that follows." };
export const dynamic = "force-dynamic";

export default async function ApplyPage() {
  const user = await currentUser().catch(() => null);
  const drafts = user ? await withUser(user.id, (tx) => tx<{ id: string; status: string; current_stage: number; updated_at: Date; name: string | null }[]>`
    select a.id, a.status, a.current_stage, a.updated_at, (select value #>> '{}' from public.application_answers x where x.application_id = a.id and x.question_key = 'company_name') as name
    from public.applications a where a.created_by = ${user.id} order by a.updated_at desc`) : [];
  const open = drafts.find((d) => d.status === "draft" || d.status === "needs_information");

  return (
    <Container className="grid gap-16 py-16 md:py-24 lg:grid-cols-12">
      <div className="lg:col-span-6">
        <Eyebrow>Company application</Eyebrow>
        <h1 className="mt-5 font-display text-[2.5rem] font-bold leading-[1.02] md:text-[3.25rem]">Tell us once. We use it for everything that follows.</h1>
        <p className="mt-6 text-body-l text-ivory-70">Your application becomes the company profile behind your assessment, proposal and every deliverable. Start with the basics; the rest can be completed over several sessions. Progress saves automatically.</p>
        <ol className="mt-10 border-t border-line">
          {STAGES.map((s) => <li key={s.number} className="flex gap-4 border-b border-line py-3 text-caption"><span className="font-mono text-gold">{String(s.number).padStart(2, "0")}</span><span className="font-medium text-ivory">{s.title}</span></li>)}
        </ol>
        <Notice tone="warning" className="mt-10" title="Don't include restricted information">
          Do not submit classified information, controlled unclassified information (CUI), export-controlled technical data, confidential third-party information or anything else Trident is not authorized to process.
        </Notice>
      </div>
      <div className="lg:col-span-5 lg:col-start-8">
        <div className="border border-line bg-carbon p-8">
          {!user ? (
            <>
              <h2 className="font-display text-h2 font-bold">Start with your email</h2>
              <p className="mt-2 text-caption text-ivory-70">We&apos;ll send a secure link. No password. Your progress saves to this account.</p>
              <div className="mt-6"><LoginForm next="/apply" withName cta="Email me a link to start" /></div>
            </>
          ) : open ? (
            <>
              <h2 className="font-display text-h2 font-bold">Continue your application</h2>
              <p className="mt-2 text-caption text-ivory-70">{open.name ?? "Your company"} · stage {open.current_stage} of 7{open.status === "needs_information" && " · more information requested"}</p>
              <ButtonLink href={`/apply/${open.id}`} className="mt-6">Continue <Arrow /></ButtonLink>
            </>
          ) : (
            <>
              <h2 className="font-display text-h2 font-bold">Start your application</h2>
              <p className="mt-2 text-caption text-ivory-70">Signed in as {user.email}.</p>
              <div className="mt-6"><StartApplicationForm defaultName={user.fullName ?? undefined} /></div>
            </>
          )}
          {user && drafts.some((d) => d.status !== "draft") && <p className="mt-6 text-caption text-ivory-70">Submitted applications are in your <Link href="/portal" className="text-gold-light">portal</Link>.</p>}
        </div>
      </div>
    </Container>
  );
}
