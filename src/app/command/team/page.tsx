import { hasStaffRole, requireStaff } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { PageTitle, Panel, Table, Td, Th, dt } from "@/components/command/ui";
import { GrantRoleForm, RevokeRoleButton } from "@/components/command/actions";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const user = await requireStaff();
  const admin = hasStaffRole(user, "administrator");
  const rows = await withUser(user.id, (tx) => tx<{ id: string; email: string; full_name: string | null; role: string; created_at: Date }[]>`
    select m.id, p.email, p.full_name, m.role, m.created_at from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id join public.profiles p on p.id = m.user_id
    where o.kind = 'internal' order by m.role, p.email`);
  return (
    <>
      <PageTitle title="Team" subtitle="Internal roles. Least privilege: grant the narrowest role that fits the work." />
      {admin && <Panel title="Grant a role" className="mb-6"><GrantRoleForm /><p className="mt-2 text-[12px] text-ivory-50">The person must sign in once first. Staff accounts are kept separate from client accounts.</p></Panel>}
      <Table>
        <thead><tr><Th>Person</Th><Th>Role</Th><Th>Since</Th><Th></Th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.id}><Td>{r.full_name ?? r.email}<span className="block text-[12px] text-ivory-70">{r.email}</span></Td><Td>{r.role.replace(/_/g, " ")}</Td><Td className="text-ivory-70">{dt(r.created_at)}</Td><Td>{admin && r.email !== user.email && r.role !== "platform_owner" && <RevokeRoleButton id={r.id} />}</Td></tr>)}</tbody>
      </Table>
    </>
  );
}
