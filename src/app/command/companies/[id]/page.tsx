import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { STAGE_LABEL } from "@/lib/status";
import { questionByKey } from "@/lib/application/questions";
import { PageTitle, Panel, dt, money } from "@/components/command/ui";
import { Pill } from "@/components/ui/primitives";
import { ActivityForm, CoiReviewForm, CompleteTaskButton, CredentialVerify, FactReview, OpportunityEditor, StageSelect } from "@/components/command/actions";

const SECTION_LABEL: Record<string, string> = {
  corporate_identity: "Corporate identity", technology: "Technology", product: "Product", market: "Market", competitor: "Competitors",
  buyer_persona: "Buyer personas", credential: "Credentials and traction", objectives: "Commercial objectives", brand: "Brand", messaging: "Messaging",
  digital_assets: "Digital assets", preferences: "Engagement preferences",
};

export default async function CompanyPage({ params }: PageProps<"/command/companies/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await requireStaff();
  const d = await withUser(user.id, async (tx) => {
    const [company] = await tx<{ id: string; name: string; website: string | null; domain: string | null; linkedin_url: string | null; industry: string | null; headquarters: string | null; employee_range: string | null; organization_id: string | null; created_at: Date }[]>`
      select id, name, website, domain, linkedin_url, industry, headquarters, employee_range, organization_id, created_at from public.companies where id = ${id}`;
    if (!company) return null;
    return {
      company,
      opp: (await tx<{ id: string; stage: string; owner_user_id: string | null; estimated_contract_value_cents: number | null; estimated_mrr_cents: number | null; probability: number | null; next_action: string | null; next_action_due: string | null; qualification: Record<string, number>; qualification_score: number | null; coi_status: string; application_id: string | null }[]>`
        select id, stage, owner_user_id, estimated_contract_value_cents, estimated_mrr_cents, probability, next_action, to_char(next_action_due, 'YYYY-MM-DD') as next_action_due, qualification, qualification_score, coi_status, application_id
        from public.opportunities where company_id = ${id} and closed_at is null`)[0],
      facts: await tx<{ id: string; section: string; fact_key: string; value: unknown; provenance: string; verification_status: string; approval_status: string; version: number; created_at: Date }[]>`
        select id, section, fact_key, value, provenance, verification_status, approval_status, version, created_at from public.company_facts where company_id = ${id} and is_current order by section, fact_key`,
      creds: await tx<{ id: string; credential_type: string; title: string; agency: string | null; awarded_on: Date | null; source_url: string | null; verification_status: string; publicly_shareable: boolean }[]>`
        select id, credential_type, title, agency, awarded_on, source_url, verification_status, publicly_shareable from public.credentials where company_id = ${id} order by created_at`,
      activity: await tx<{ id: string; kind: string; body: string; created_at: Date; due_on: Date | null; completed_at: Date | null; actor: string | null }[]>`
        select a.id, a.kind, a.body, a.created_at, a.due_on, a.completed_at, p.email as actor from public.pipeline_activities a left join public.profiles p on p.id = a.actor_user_id
        where a.company_id = ${id} order by a.created_at desc limit 100`,
      contacts: await tx<{ full_name: string; role_title: string | null; email: string | null; contact_permission: string }[]>`select full_name, role_title, email, contact_permission from public.company_contacts where company_id = ${id}`,
      staff: await tx<{ id: string; email: string }[]>`select p.id, p.email from public.organization_memberships m join public.organizations o on o.id = m.organization_id join public.profiles p on p.id = m.user_id where o.kind = 'internal' order by p.email`,
      records: await tx<{ id: string; kind: string; status: string; created_at: Date }[]>`select id, kind, status, created_at from public.company_intelligence_records where company_id = ${id} order by created_at desc`,
    };
  });
  if (!d) notFound();
  const { company: c, opp } = d;
  const sections = Array.from(new Set(d.facts.map((f) => f.section)));
  const fmt = (v: unknown) => (Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v));

  return (
    <>
      <PageTitle title={c.name} subtitle={<>{c.domain ?? "no domain"} · {c.industry ?? "industry unknown"} · {c.headquarters ?? ""} · profile created {dt(c.created_at)}</>}
        actions={opp?.application_id && <Link href={`/command/applications/${opp.application_id}`} className="text-[13px] text-gold-light">Application →</Link>} />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Panel title="Credentials and claims">
            {d.creds.length === 0 ? <p className="text-[13px] text-ivory-70">No credential claims.</p> : (
              <ul className="divide-y divide-line text-[13px]">{d.creds.map((k) => (
                <li key={k.id} className="flex flex-wrap items-start justify-between gap-3 py-2.5">
                  <span><span className="font-medium">{k.title}</span><span className="block text-[12px] text-ivory-70">{k.credential_type.replace(/_/g, " ")}{k.agency && ` · ${k.agency}`}{k.awarded_on && ` · ${dt(k.awarded_on)}`}{k.publicly_shareable && " · shareable"} {k.source_url && <a href={k.source_url} target="_blank" rel="noopener noreferrer nofollow" className="text-gold-light">source</a>}</span></span>
                  <span className="flex items-center gap-3"><Pill tone={k.verification_status === "verified" ? "ok" : k.verification_status === "rejected" || k.verification_status === "disputed" ? "danger" : "neutral"}>{k.verification_status.replace(/_/g, " ")}</Pill><CredentialVerify id={k.id} hasSource={!!k.source_url} /></span>
                </li>
              ))}</ul>
            )}
          </Panel>
          {sections.map((s) => (
            <Panel key={s} title={SECTION_LABEL[s] ?? s}>
              <dl className="divide-y divide-line text-[13px]">{d.facts.filter((f) => f.section === s).map((f) => (
                <div key={f.id} className="grid gap-2 py-2 sm:grid-cols-[200px_1fr_auto]">
                  <dt className="text-ivory-70">{questionByKey(f.fact_key)?.label ?? f.fact_key}</dt>
                  <dd className="whitespace-pre-line">{fmt(f.value)}<span className="mt-1 block text-[11px] text-ivory-50">{f.provenance} · {f.verification_status.replace(/_/g, " ")} · v{f.version}</span></dd>
                  <dd className="flex items-start gap-2">{f.approval_status === "pending" ? <FactReview id={f.id} /> : <Pill tone={f.approval_status === "approved" ? "ok" : "neutral"}>{f.approval_status}</Pill>}</dd>
                </div>
              ))}</dl>
            </Panel>
          ))}
          {sections.length === 0 && <Panel title="Profile"><p className="text-[13px] text-ivory-70">No facts recorded yet.</p></Panel>}
        </div>
        <div className="space-y-6">
          {opp ? (
            <>
              <Panel title="Opportunity">
                <div className="mb-3 flex items-center justify-between text-[13px]"><span className="text-ivory-70">Stage</span><StageSelect id={opp.id} stage={opp.stage} /></div>
                <p className="mb-3 text-[12px] text-ivory-70">{STAGE_LABEL[opp.stage]} · value {money(opp.estimated_contract_value_cents)} · qualification {opp.qualification_score ?? "—"}/100</p>
                <OpportunityEditor opp={opp} staff={d.staff} />
              </Panel>
              <Panel title="Conflict-of-interest review"><CoiReviewForm opportunityId={opp.id} status={opp.coi_status} /></Panel>
            </>
          ) : <Panel title="Opportunity"><p className="text-[13px] text-ivory-70">No open opportunity.</p></Panel>}
          <Panel title="Contacts"><ul className="space-y-1 text-[13px]">{d.contacts.map((p) => <li key={p.email ?? p.full_name}>{p.full_name}{p.role_title && ` · ${p.role_title}`}<span className="block text-[12px] text-ivory-70">{p.email} · {p.contact_permission.replace(/_/g, " ")}</span></li>)}</ul></Panel>
          <Panel title="Notes and tasks">
            <ActivityForm companyId={id} opportunityId={opp?.id} />
            <ul className="mt-4 space-y-3 border-t border-line pt-3 text-[13px]">{d.activity.map((a) => (
              <li key={a.id}><span className="font-mono text-[11px] uppercase text-gold">{a.kind.replace("_", " ")}</span> <span className="text-[11px] text-ivory-50">{dt(a.created_at)}{a.actor && ` · ${a.actor}`}</span>
                <p className={a.completed_at ? "text-ivory-50 line-through" : ""}>{a.body}</p>
                {a.kind === "task" && !a.completed_at && <span className="text-[12px] text-ivory-70">{a.due_on && `Due ${dt(a.due_on)} · `}<CompleteTaskButton id={a.id} /></span>}
              </li>
            ))}</ul>
          </Panel>
          <Panel title="Intelligence records">{d.records.length === 0 ? <p className="text-[13px] text-ivory-70">None yet.</p> : <ul className="space-y-1 text-[13px]">{d.records.map((r) => <li key={r.id} className="flex justify-between"><Link href="/command/intelligence" className="hover:text-gold-light">{r.kind.replace(/_/g, " ")}</Link><span className="text-ivory-70">{r.status.replace("_", " ")} · {dt(r.created_at)}</span></li>)}</ul>}</Panel>
        </div>
      </div>
    </>
  );
}
