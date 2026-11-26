import { requireStaff } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { integrationStatus } from "@/lib/env";
import { PageTitle, Panel, Table, Td, Th, dt } from "@/components/command/ui";
import { DataRequestControls } from "@/components/command/actions";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireStaff();
  const requests = await withUser(user.id, (tx) => tx<{ id: string; kind: string; status: string; email: string; created_at: Date }[]>`
    select r.id, r.kind, r.status, p.email, r.created_at from public.data_requests r join public.profiles p on p.id = r.user_id order by r.created_at desc limit 100`);
  return (
    <>
      <PageTitle title="Settings" subtitle="Integration status and privacy requests. Secrets are never displayed." />
      <Panel title="Integrations">
        <ul className="divide-y divide-line text-[13px]">{integrationStatus().map((i) => (
          <li key={i.name} className="grid gap-1 py-2 sm:grid-cols-[180px_120px_1fr]"><span className="font-medium">{i.name}</span><span className={i.connected ? "text-success" : "text-gold"}>{i.connected ? "connected" : i.mode}</span><span className="text-ivory-70">{i.note}</span></li>
        ))}</ul>
      </Panel>
      <Panel title="Data export and deletion requests" className="mt-6">
        {requests.length === 0 ? <p className="text-[13px] text-ivory-70">No requests.</p> : (
          <Table className="border-0">
            <thead><tr><Th>Requested</Th><Th>Person</Th><Th>Type</Th><Th>Status</Th><Th></Th></tr></thead>
            <tbody>{requests.map((r) => <tr key={r.id}><Td className="text-ivory-70">{dt(r.created_at)}</Td><Td>{r.email}</Td><Td>{r.kind}</Td><Td>{r.status.replace("_", " ")}</Td><Td>{["requested", "in_progress"].includes(r.status) && <DataRequestControls id={r.id} />}</Td></tr>)}</tbody>
          </Table>
        )}
        <p className="mt-3 text-[12px] text-ivory-50">Fulfilment is manual in this phase (see SECURITY.md → Data retention and deletion).</p>
      </Panel>
    </>
  );
}
