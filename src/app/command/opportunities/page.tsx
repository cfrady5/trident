import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { PIPELINE_STAGES, STAGE_LABEL } from "@/lib/status";
import { PageTitle, Table, Td, Th, dt, money } from "@/components/command/ui";
import { DeleteViewButton, SaveViewButton, StageSelect } from "@/components/command/actions";
import { cn } from "@/components/ui/cn";

export const metadata = { title: "Opportunities" };

type Row = { id: string; title: string; stage: string; source: string; company_id: string; company: string; owner: string | null; estimated_contract_value_cents: number | null; estimated_mrr_cents: number | null; probability: number | null; qualification_score: number | null; coi_status: string; next_action: string | null; next_action_due: Date | null; updated_at: Date };

export default async function OpportunitiesPage({ searchParams }: PageProps<"/command/opportunities">) {
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const filters = { stage: str("stage"), source: str("source"), owner: str("owner"), q: str("q").slice(0, 100), view: str("view") || "table" };
  const user = await requireStaff();
  const { rows, views } = await withUser(user.id, async (tx) => ({
    rows: await tx<Row[]>`
      select o.id, o.title, o.stage, o.source, o.company_id, c.name as company, p.email as owner, o.estimated_contract_value_cents, o.estimated_mrr_cents,
             o.probability, o.qualification_score, o.coi_status, o.next_action, o.next_action_due, o.updated_at
      from public.opportunities o join public.companies c on c.id = o.company_id left join public.profiles p on p.id = o.owner_user_id
      where (${filters.stage} = '' or o.stage::text = ${filters.stage})
        and (${filters.source} = '' or o.source = ${filters.source})
        and (${filters.owner} = '' or (${filters.owner} = 'me' and o.owner_user_id = ${user.id}) or (${filters.owner} = 'none' and o.owner_user_id is null))
        and (${filters.q} = '' or c.name ilike ${"%" + filters.q + "%"} or o.title ilike ${"%" + filters.q + "%"})
      order by o.updated_at desc limit 500`,
    views: await tx<{ id: string; name: string; filters: Record<string, string> }[]>`select id, name, filters from public.saved_filters where user_id = ${user.id} and scope = 'opportunities' order by name`,
  }));
  const qs = (o: Record<string, string>) => "?" + new URLSearchParams(Object.entries({ ...filters, ...o }).filter(([, v]) => v)).toString();
  const sel = "h-8 rounded-[2px] border border-ivory/20 bg-black px-2 text-[13px]";
  const kanbanStages = PIPELINE_STAGES.filter((s) => rows.some((r) => r.stage === s) || ["application_submitted", "research_in_progress", "qualified", "discovery_scheduled", "proposal_sent", "negotiation"].includes(s));

  return (
    <>
      <PageTitle title="Opportunities" subtitle={`${rows.length} shown · sales qualification is tracked separately from commercial readiness`}
        actions={<div className="flex gap-1 text-[13px]">{["table", "kanban"].map((v) => <Link key={v} href={qs({ view: v })} className={cn("rounded-[2px] px-2.5 py-1 capitalize", filters.view === v ? "bg-carbon-2" : "text-ivory-70")}>{v}</Link>)}</div>} />
      <form className="mb-3 flex flex-wrap items-center gap-2" role="search">
        <input type="hidden" name="view" value={filters.view} />
        <input name="q" defaultValue={filters.q} placeholder="Search company" aria-label="Search" className={cn(sel, "w-52")} />
        <select name="stage" defaultValue={filters.stage} aria-label="Stage" className={sel}><option value="">All stages</option>{PIPELINE_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}</select>
        <select name="source" defaultValue={filters.source} aria-label="Source" className={sel}><option value="">All sources</option>{["application", "assessment", "prospecting", "referral", "inbound", "event", "other"].map((s) => <option key={s} value={s}>{s}</option>)}</select>
        <select name="owner" defaultValue={filters.owner} aria-label="Owner" className={sel}><option value="">Any owner</option><option value="me">Mine</option><option value="none">Unassigned</option></select>
        <button className="h-8 rounded-[2px] bg-carbon-2 px-3 text-[13px]">Apply</button>
        <SaveViewButton scope="opportunities" filters={{ stage: filters.stage, source: filters.source, owner: filters.owner, q: filters.q }} />
      </form>
      {views.length > 0 && <div className="mb-4 flex flex-wrap gap-2 text-[12px]">{views.map((v) => <span key={v.id} className="inline-flex items-center gap-1.5 border border-line px-2 py-0.5"><Link href={qs(v.filters)} className="text-gold-light">{v.name}</Link><DeleteViewButton id={v.id} /></span>)}</div>}

      {rows.length === 0 ? <p className="border border-dashed border-line p-8 text-center text-caption text-ivory-70">No opportunities match. Opportunities are created automatically when an application is submitted.</p> : filters.view === "kanban" ? (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {kanbanStages.map((s) => {
            const col = rows.filter((r) => r.stage === s);
            return (
              <section key={s} className="w-64 shrink-0 border border-line" aria-label={STAGE_LABEL[s]}>
                <h2 className="flex justify-between border-b border-line bg-carbon px-3 py-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-ivory-70">{STAGE_LABEL[s]}<span>{col.length}</span></h2>
                <ul className="space-y-2 p-2">{col.map((r) => (
                  <li key={r.id} className="border border-line bg-black p-2.5 text-[13px]">
                    <Link href={`/command/companies/${r.company_id}`} className="font-medium hover:text-gold-light">{r.company}</Link>
                    <p className="mt-1 text-[12px] text-ivory-70">{money(r.estimated_contract_value_cents)}{r.probability != null && ` · ${r.probability}%`}{r.qualification_score != null && ` · Q${r.qualification_score}`}</p>
                    {r.coi_status !== "cleared" && r.coi_status !== "not_required" && <p className="mt-1 text-[11px] text-gold">COI {r.coi_status}</p>}
                  </li>
                ))}</ul>
              </section>
            );
          })}
        </div>
      ) : (
        <Table>
          <thead><tr><Th>Company</Th><Th>Stage</Th><Th>Source</Th><Th>Owner</Th><Th>Est. value</Th><Th>Est. MRR</Th><Th>Prob.</Th><Th>Qual.</Th><Th>COI</Th><Th>Next action</Th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id} className="hover:bg-carbon">
              <Td><Link href={`/command/companies/${r.company_id}`} className="font-medium hover:text-gold-light">{r.company}</Link></Td>
              <Td><StageSelect id={r.id} stage={r.stage} /></Td>
              <Td className="text-ivory-70">{r.source}</Td>
              <Td className="text-ivory-70">{r.owner ?? "—"}</Td>
              <Td className="font-mono">{money(r.estimated_contract_value_cents)}</Td>
              <Td className="font-mono">{money(r.estimated_mrr_cents)}</Td>
              <Td className="font-mono">{r.probability != null ? `${r.probability}%` : "—"}</Td>
              <Td className="font-mono">{r.qualification_score ?? "—"}</Td>
              <Td className={r.coi_status === "cleared" ? "text-success" : r.coi_status === "blocked" ? "text-danger" : "text-gold"}>{r.coi_status}</Td>
              <Td className="text-ivory-70">{r.next_action ?? "—"}{r.next_action_due && <span className="block text-[12px] text-ivory-50">{dt(r.next_action_due)}</span>}</Td>
            </tr>
          ))}</tbody>
        </Table>
      )}
    </>
  );
}
