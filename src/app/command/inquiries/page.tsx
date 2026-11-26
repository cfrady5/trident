import { requireStaff } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { PageTitle, Table, Td, Th, dt } from "@/components/command/ui";
import { InquiryStatus } from "@/components/command/actions";

export const metadata = { title: "Inquiries" };

export default async function InquiriesPage() {
  const user = await requireStaff();
  const rows = await withUser(user.id, (tx) => tx<{ id: string; kind: string; full_name: string; email: string; company_name: string | null; website: string | null; message: string | null; service_slugs: string[]; status: string; created_at: Date }[]>`
    select id, kind, full_name, email, company_name, website, message, service_slugs, status, created_at from public.inquiries order by created_at desc limit 300`);
  return (
    <>
      <PageTitle title="Inquiries" subtitle="Contact messages and proposal requests from the website. Reply personally; no automated outreach." />
      {rows.length === 0 ? <p className="border border-dashed border-line p-8 text-center text-caption text-ivory-70">No inquiries yet.</p> : (
        <Table>
          <thead><tr><Th>Received</Th><Th>From</Th><Th>Type</Th><Th>Services</Th><Th>Message</Th><Th>Status</Th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}>
              <Td className="whitespace-nowrap text-ivory-70">{dt(r.created_at)}</Td>
              <Td><span className="font-medium">{r.full_name}</span><span className="block text-[12px] text-ivory-70">{r.email}{r.company_name && ` · ${r.company_name}`}</span></Td>
              <Td>{r.kind.replace("_", " ")}</Td>
              <Td className="text-[12px] text-ivory-70">{r.service_slugs.join(", ") || "—"}</Td>
              <Td className="max-w-md whitespace-pre-line text-[12px] text-ivory-70">{r.message ?? "—"}</Td>
              <Td><InquiryStatus id={r.id} status={r.status} /></Td>
            </tr>
          ))}</tbody>
        </Table>
      )}
    </>
  );
}
