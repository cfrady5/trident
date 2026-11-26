import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { loadApplication } from "@/lib/application/service";
import { APPLICATION_STATUS, STAGE_LABEL } from "@/lib/status";
import { STAGES, displayValue, isVisible, questionsForStage, type CredentialEntry } from "@/lib/application/questions";
import { PageTitle, Panel, dt } from "@/components/command/ui";
import { Pill } from "@/components/ui/primitives";
import { ApplicationStatusControl, FileReviewControls } from "@/components/command/actions";

export default async function CommandApplicationPage({ params }: PageProps<"/command/applications/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await requireStaff();
  const data = await loadApplication(user.id, id);
  if (!data) notFound();
  const { app, answers } = data;
  const extra = await withUser(user.id, async (tx) => ({
    applicant: (await tx<{ email: string; full_name: string | null }[]>`select p.email, p.full_name from public.applications a join public.profiles p on p.id = a.created_by where a.id = ${id}`)[0],
    opp: app.company_id ? (await tx<{ id: string; stage: string; coi_status: string }[]>`select id, stage, coi_status from public.opportunities where company_id = ${app.company_id} and closed_at is null`)[0] : undefined,
    run: app.company_id ? (await tx<{ id: string; status: string; steps: { key: string; label: string; status: string; detail: string }[]; created_at: Date }[]>`
      select id, status, steps, created_at from public.automation_runs where company_id = ${app.company_id} and workflow_key = 'research.initial' order by created_at desc limit 1`)[0] : undefined,
  }));
  const s = APPLICATION_STATUS[app.status]!;
  const services = data.services.map((x) => ({ value: x.slug, label: x.name }));
  return (
    <>
      <PageTitle title={String(answers.company_name ?? "Untitled application")} subtitle={<>{extra.applicant?.full_name} · {extra.applicant?.email} · started {dt(app.created_at)}</>}
        actions={<><Pill tone={s.tone}>{s.label}</Pill>{app.company_id && <Link href={`/command/companies/${app.company_id}`} className="text-[13px] text-gold-light">Company profile →</Link>}</>} />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {STAGES.slice(0, 6).map((st) => (
            <Panel key={st.number} title={`${String(st.number).padStart(2, "0")} · ${st.title}`}>
              <dl className="divide-y divide-line text-[13px]">
                {questionsForStage(st.number).filter((q) => isVisible(q, answers)).map((q) => (
                  <div key={q.key} className="grid gap-1 py-2 sm:grid-cols-3">
                    <dt className="text-ivory-70">{q.label}</dt>
                    <dd className="whitespace-pre-line sm:col-span-2">
                      {q.type === "credentials" && Array.isArray(answers[q.key]) ? (answers[q.key] as CredentialEntry[]).map((c, i) => (
                        <p key={i}>{c.title} {c.agency && `· ${c.agency}`} {c.date && `· ${c.date}`} {c.sourceUrl ? <a href={c.sourceUrl} className="text-gold-light" target="_blank" rel="noopener noreferrer nofollow">source</a> : <span className="text-ivory-50">(no source)</span>}</p>
                      )) : displayValue(q.key === "services_of_interest" ? { ...q, options: services } : q, answers[q.key])}
                    </dd>
                  </div>
                ))}
              </dl>
            </Panel>
          ))}
        </div>
        <div className="space-y-6">
          <Panel title="Review decision">{app.status === "draft" ? <p className="text-[13px] text-ivory-70">Not yet submitted.</p> : <ApplicationStatusControl id={id} status={app.status} />}</Panel>
          {extra.opp && <Panel title="Opportunity"><p className="text-[13px]">{STAGE_LABEL[extra.opp.stage]} · COI <span className={extra.opp.coi_status === "cleared" ? "text-success" : "text-gold"}>{extra.opp.coi_status}</span></p><Link href={`/command/companies/${app.company_id}`} className="mt-2 inline-block text-[13px] text-gold-light">Manage in company profile →</Link></Panel>}
          <Panel title={`Files · ${data.files.length}`}>
            {data.files.length === 0 ? <p className="text-[13px] text-ivory-70">No files.</p> : (
              <ul className="space-y-4 text-[13px]">{data.files.map((f) => (
                <li key={f.id} className="border-b border-line pb-3 last:border-0">
                  <p className="font-medium break-all">{f.original_name}</p>
                  <p className="text-[12px] text-ivory-50">{f.category} · {(Number(f.size_bytes) / 1024).toFixed(0)} KB · scan {f.scan_status} · <span className={f.quarantine_status === "released" ? "text-success" : "text-gold"}>{f.quarantine_status.replace(/_/g, " ")}</span></p>
                  <ul className="mt-1 text-[12px] text-ivory-70">{f.screening_notes.map((n, i) => <li key={i} className={n.result === "flag" || n.result === "fail" ? "text-gold" : ""}>{n.check}: {n.detail}</li>)}</ul>
                  <div className="mt-2"><FileReviewControls id={f.id} status={f.quarantine_status} /></div>
                </li>
              ))}</ul>
            )}
          </Panel>
          <Panel title="Initial research">
            {!extra.run ? <p className="text-[13px] text-ivory-70">{app.status === "draft" ? "Runs after submission." : "Queued. Runs when the job worker next executes."}</p> : (
              <ul className="space-y-2 text-[12px]">{extra.run.steps.map((st) => <li key={st.key}><span className={st.status === "succeeded" ? "text-success" : st.status === "flagged" || st.status === "failed" ? "text-gold" : "text-ivory-50"}>{st.status.replace(/_/g, " ")}</span> · {st.label}<span className="block text-ivory-70">{st.detail}</span></li>)}</ul>
            )}
          </Panel>
          <Panel title="Status history"><ul className="space-y-1 text-[12px]">{data.history.map((h, i) => <li key={i}>{APPLICATION_STATUS[h.to_status]?.label} · {dt(h.created_at)}{h.note && <span className="block text-ivory-70">{h.note}</span>}</li>)}</ul></Panel>
        </div>
      </div>
    </>
  );
}
