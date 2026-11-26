import { requireUser } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { Eyebrow } from "@/components/ui/primitives";
import { DataRequestButton } from "@/components/forms/data-request";

export default async function SettingsPage() {
  const user = await requireUser("/portal/settings");
  const requests = await withUser(user.id, (tx) => tx<{ id: string; kind: string; status: string; created_at: Date }[]>`
    select id, kind, status, created_at from public.data_requests where user_id = ${user.id} order by created_at desc`);
  const open = (k: string) => requests.some((r) => r.kind === k && ["requested", "in_progress"].includes(r.status));
  return (
    <div className="mx-auto max-w-[800px]">
      <Eyebrow>Settings</Eyebrow>
      <h1 className="mt-3 font-display text-[2.25rem] font-bold">Account</h1>
      <dl className="mt-8 border-t border-line text-caption">
        <div className="flex justify-between border-b border-line py-3"><dt className="text-ivory-70">Email</dt><dd>{user.email}</dd></div>
        <div className="flex justify-between border-b border-line py-3"><dt className="text-ivory-70">Organizations</dt><dd>{user.memberships.map((m) => `${m.organizationName} (${m.role.replace(/_/g, " ")})`).join(", ") || "—"}</dd></div>
      </dl>
      <section className="mt-12">
        <h2 className="font-display text-h2 font-bold">Your data</h2>
        <p className="mt-2 text-caption text-ivory-70">Request a copy of your data, or deletion of your account and the applications you created. A person at Trident completes each request and confirms by email.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <DataRequestButton kind="export" label="Request data export" disabled={open("export")} />
          <DataRequestButton kind="deletion" label="Request account deletion" disabled={open("deletion")} />
        </div>
        {requests.length > 0 && <ul className="mt-6 border-t border-line text-caption">{requests.map((r) => <li key={r.id} className="flex justify-between border-b border-line py-2"><span className="capitalize">{r.kind}</span><span className="text-ivory-70">{r.status.replace("_", " ")} · {r.created_at.toLocaleDateString()}</span></li>)}</ul>}
      </section>
    </div>
  );
}
