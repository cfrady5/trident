import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { APPLICATION_STATUS } from "@/lib/status";
import { PageTitle, Table, Td, Th, dt } from "@/components/command/ui";
import { Pill } from "@/components/ui/primitives";
import { cn } from "@/components/ui/cn";

export const metadata = { title: "Applications" };

export default async function ApplicationsPage({ searchParams }: PageProps<"/command/applications">) {
  const sp = await searchParams;
  const status = typeof sp.status === "string" && APPLICATION_STATUS[sp.status] ? sp.status : null;
  const user = await requireStaff();
  const rows = await withUser(user.id, (tx) => tx<{ id: string; status: string; current_stage: number; submitted_at: Date | null; updated_at: Date; name: string | null; email: string | null; files: number; held: number; company_id: string | null }[]>`
    select a.id, a.status, a.current_stage, a.submitted_at, a.updated_at, a.company_id,
      (select value #>> '{}' from public.application_answers x where x.application_id = a.id and x.question_key = 'company_name') as name,
      p.email,
      (select count(*)::int from public.files f where f.application_id = a.id and f.deleted_at is null) as files,
      (select count(*)::int from public.files f where f.application_id = a.id and f.deleted_at is null and f.quarantine_status in ('quarantined','held_for_review')) as held
    from public.applications a left join public.profiles p on p.id = a.created_by
    where (${status}::text is null or a.status::text = ${status})
    order by coalesce(a.submitted_at, a.updated_at) desc limit 200`);
  const tabs = [["", "All"], ["submitted", "Submitted"], ["under_review", "Under review"], ["needs_information", "Info requested"], ["draft", "Drafts"], ["accepted", "Accepted"], ["declined", "Declined"]];
  return (
    <>
      <PageTitle title="Applications" subtitle="Every application creates or updates one company profile and one opportunity." />
      <div className="mb-4 flex flex-wrap gap-1">{tabs.map(([k, l]) => <Link key={k} href={k ? `?status=${k}` : "?"} className={cn("rounded-[2px] px-2.5 py-1 text-[13px]", (status ?? "") === k ? "bg-carbon-2 text-ivory" : "text-ivory-70 hover:text-ivory")}>{l}</Link>)}</div>
      {rows.length === 0 ? <p className="border border-dashed border-line p-8 text-center text-caption text-ivory-70">No applications{status ? ` with status "${APPLICATION_STATUS[status]!.label}"` : ""} yet.</p> : (
        <Table>
          <thead><tr><Th>Company</Th><Th>Applicant</Th><Th>Status</Th><Th>Stage</Th><Th>Files</Th><Th>Submitted</Th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id} className="hover:bg-carbon">
              <Td><Link href={`/command/applications/${r.id}`} className="font-medium hover:text-gold-light">{r.name ?? "Untitled"}</Link></Td>
              <Td className="text-ivory-70">{r.email}</Td>
              <Td><Pill tone={APPLICATION_STATUS[r.status]!.tone}>{APPLICATION_STATUS[r.status]!.label}</Pill></Td>
              <Td className="font-mono">{r.current_stage}/7</Td>
              <Td>{r.files}{r.held > 0 && <span className="ml-1 text-gold">({r.held} to review)</span>}</Td>
              <Td className="text-ivory-70">{r.submitted_at ? dt(r.submitted_at) : `saved ${dt(r.updated_at)}`}</Td>
            </tr>
          ))}</tbody>
        </Table>
      )}
    </>
  );
}
