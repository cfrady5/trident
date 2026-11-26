import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { APPLICATION_STATUS } from "@/lib/status";
import { EmptyState, Eyebrow, Pill } from "@/components/ui/primitives";
import { ButtonLink, Arrow } from "@/components/ui/button";

export const metadata: Metadata = { title: "Portal" };

export default async function PortalPage() {
  const user = await requireUser("/portal");
  const data = await withUser(user.id, async (tx) => {
    const apps = await tx<{ id: string; status: string; current_stage: number; submitted_at: Date | null; updated_at: Date; name: string | null }[]>`
      select a.id, a.status, a.current_stage, a.submitted_at, a.updated_at,
             (select value #>> '{}' from public.application_answers x where x.application_id = a.id and x.question_key = 'company_name') as name
      from public.applications a order by a.updated_at desc`;
    const assessments = await tx<{ id: string; company_name: string; overall_score: string | null; review_state: string; completed_at: Date }[]>`
      select id, company_name, overall_score, review_state, completed_at from public.assessments where user_id = ${user.id} order by completed_at desc limit 5`;
    const notes = await tx<{ id: string; title: string; body: string | null; link: string | null; created_at: Date }[]>`
      select id, title, body, link, created_at from public.notifications where user_id = ${user.id} and read_at is null order by created_at desc limit 5`;
    return { apps, assessments, notes };
  });
  const clientOrgs = user.memberships.filter((m) => m.organizationKind === "client");

  return (
    <div className="mx-auto max-w-[1100px]">
      <Eyebrow>Overview</Eyebrow>
      <h1 className="mt-3 font-display text-[2.25rem] font-bold">{clientOrgs[0]?.organizationName ?? (user.fullName ? `Welcome, ${user.fullName.split(" ")[0]}` : "Welcome")}</h1>
      <p className="mt-2 text-ivory-70">What Trident is doing, what&apos;s waiting on you and what&apos;s next.</p>

      <section className="mt-10" aria-labelledby="apps">
        <h2 id="apps" className="font-display text-h2 font-bold">Applications</h2>
        {data.apps.length === 0 ? (
          <div className="mt-4"><EmptyState title="No application yet" action={<ButtonLink href="/apply">Start your application <Arrow /></ButtonLink>}>Your application becomes the profile behind your assessment, proposal and every deliverable.</EmptyState></div>
        ) : (
          <ul className="mt-4 border-t border-line">
            {data.apps.map((a) => {
              const s = APPLICATION_STATUS[a.status]!;
              const editable = a.status === "draft" || a.status === "needs_information";
              return (
                <li key={a.id} className="grid gap-3 border-b border-line py-5 md:grid-cols-12 md:items-center">
                  <div className="md:col-span-5"><p className="font-semibold">{a.name ?? "Untitled company"}</p><p className="text-caption text-ivory-70">{a.submitted_at ? `Submitted ${a.submitted_at.toLocaleDateString()}` : `Stage ${a.current_stage} of 7 · saved ${a.updated_at.toLocaleDateString()}`}</p></div>
                  <div className="md:col-span-5"><Pill tone={s.tone}>{s.label}</Pill><p className="mt-1 text-caption text-ivory-70">{s.client}</p></div>
                  <div className="md:col-span-2 md:text-right"><Link className="text-caption text-gold-light" href={editable ? `/apply/${a.id}` : `/portal/applications/${a.id}`}>{editable ? "Continue" : "View"} →</Link></div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="mt-14 grid gap-12 md:grid-cols-2">
        <section aria-labelledby="assess">
          <h2 id="assess" className="font-display text-h2 font-bold">Readiness assessments</h2>
          {data.assessments.length === 0 ? <p className="mt-4 text-caption text-ivory-70">None yet. <Link href="/assessment" className="text-gold-light">Take the assessment</Link>.</p> : (
            <ul className="mt-4 border-t border-line">{data.assessments.map((a) => <li key={a.id} className="flex justify-between border-b border-line py-3 text-caption"><span>{a.company_name} · {a.completed_at.toLocaleDateString()}</span><span>{a.overall_score ?? "—"} · {a.review_state === "human_reviewed" ? "reviewed" : "preliminary"}</span></li>)}</ul>
          )}
          <p className="mt-3 text-caption text-ivory-50">Results links are emailed to you; reports are private to the link holder.</p>
        </section>
        <section aria-labelledby="updates">
          <h2 id="updates" className="font-display text-h2 font-bold">Updates</h2>
          {data.notes.length === 0 ? <p className="mt-4 text-caption text-ivory-70">Nothing new.</p> : (
            <ul className="mt-4 border-t border-line">{data.notes.map((n) => <li key={n.id} className="border-b border-line py-3 text-caption">{n.link ? <Link href={n.link} className="text-gold-light">{n.title}</Link> : n.title}{n.body && <span className="block text-ivory-70">{n.body}</span>}</li>)}</ul>
          )}
        </section>
      </div>

      <section className="mt-14 border border-dashed border-line p-6 text-caption text-ivory-70">
        <p className="label text-ivory-70">After your engagement begins</p>
        <p className="mt-2">Your roadmap, projects, requests, approvals, brand assets, deliverables and billing appear here once an engagement is active. These areas are not yet available.</p>
      </section>
    </div>
  );
}
