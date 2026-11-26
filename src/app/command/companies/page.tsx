import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { PageTitle, Table, Td, Th, dt } from "@/components/command/ui";
import { STAGE_LABEL } from "@/lib/status";

export const metadata = { title: "Companies" };

export default async function CompaniesPage({ searchParams }: PageProps<"/command/companies">) {
  const q = typeof (await searchParams).q === "string" ? String((await searchParams).q).slice(0, 100) : "";
  const user = await requireStaff();
  const rows = await withUser(user.id, (tx) => tx<{ id: string; name: string; domain: string | null; industry: string | null; stage: string | null; facts: number; credentials: number; created_at: Date }[]>`
    select c.id, c.name, c.domain, c.industry, c.created_at,
      (select stage::text from public.opportunities o where o.company_id = c.id and o.closed_at is null) as stage,
      (select count(*)::int from public.company_facts f where f.company_id = c.id and f.is_current) as facts,
      (select count(*)::int from public.credentials k where k.company_id = c.id) as credentials
    from public.companies c where c.merged_into_id is null and (${q} = '' or c.name ilike ${"%" + q + "%"} or c.domain ilike ${"%" + q + "%"})
    order by c.created_at desc limit 300`);
  return (
    <>
      <PageTitle title="Companies" subtitle="One intelligence profile per company, deduplicated by domain." />
      <form className="mb-4" role="search"><input name="q" defaultValue={q} placeholder="Search name or domain" aria-label="Search companies" className="h-8 w-64 rounded-[2px] border border-ivory/20 bg-black px-2 text-[13px]" /></form>
      {rows.length === 0 ? <p className="border border-dashed border-line p-8 text-center text-caption text-ivory-70">No companies yet. Profiles are created when applications are submitted.</p> : (
        <Table>
          <thead><tr><Th>Company</Th><Th>Domain</Th><Th>Industry</Th><Th>Pipeline</Th><Th>Facts</Th><Th>Credentials</Th><Th>Created</Th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id} className="hover:bg-carbon">
              <Td><Link className="font-medium hover:text-gold-light" href={`/command/companies/${r.id}`}>{r.name}</Link></Td>
              <Td className="text-ivory-70">{r.domain ?? "—"}</Td><Td className="text-ivory-70">{r.industry ?? "—"}</Td>
              <Td>{r.stage ? STAGE_LABEL[r.stage] : "—"}</Td><Td className="font-mono">{r.facts}</Td><Td className="font-mono">{r.credentials}</Td><Td className="text-ivory-70">{dt(r.created_at)}</Td>
            </tr>
          ))}</tbody>
        </Table>
      )}
    </>
  );
}
