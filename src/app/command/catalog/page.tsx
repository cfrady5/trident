import { hasStaffRole, requireStaff } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { PageTitle, Th, money } from "@/components/command/ui";
import { PackageRowEditor, ServiceRowEditor } from "@/components/command/actions";

export const metadata = { title: "Catalog & pricing" };

export default async function CatalogPage() {
  const user = await requireStaff();
  const canEdit = hasStaffRole(user, "finance");
  const { services, packages } = await withUser(user.id, async (tx) => ({
    services: await tx<{ id: string; slug: string; name: string; pillar: string; starting_price_cents: number; price_status: "proposed" | "approved"; turnaround_weeks_min: number | null; turnaround_weeks_max: number | null; turnaround_confirmed: boolean; included_revisions: number; is_published: boolean; is_featured: boolean }[]>`
      select id, slug, name, pillar, starting_price_cents, price_status, turnaround_weeks_min, turnaround_weeks_max, turnaround_confirmed, included_revisions, is_published, is_featured from public.services order by sort`,
    packages: await tx<{ id: string; name: string; monthly_price_cents: number; price_status: "proposed" | "approved"; min_term_months: number; revision_limit: number; production_hours_capacity: string | null; is_published: boolean }[]>`
      select id, name, monthly_price_cents, price_status, min_term_months, revision_limit, production_hours_capacity, is_published from public.service_packages order by sort`,
  }));
  const proposed = services.filter((s) => s.price_status === "proposed").length + packages.filter((p) => p.price_status === "proposed").length;
  return (
    <>
      <PageTitle title="Catalog & pricing" subtitle={<>This catalog drives the marketplace, recommendations and proposals. {proposed > 0 && <span className="text-gold">{proposed} prices are still proposed (brand guide: [CONFIRM: price]).</span>} {!canEdit && "Editing requires the finance or administrator role."}</>} />
      <h2 className="label mb-2 text-ivory-70">Fixed-scope services</h2>
      <div className="overflow-x-auto border border-line">
        <table className="w-full min-w-[960px] text-left text-[13px]">
          <thead><tr><Th>Service</Th><Th>Price ($)</Th><Th>Price status</Th><Th>Weeks</Th><Th>Revisions</Th><Th>Visibility</Th><Th></Th></tr></thead>
          <tbody>{services.map((s) => (
            <tr key={s.id}>
              <td className="border-b border-line px-3 py-2"><span className="font-medium">{s.name}</span><span className="block text-[11px] text-ivory-50">{s.pillar} · /{s.slug}</span></td>
              {canEdit ? <ServiceRowEditor s={s} /> : <td colSpan={6} className="border-b border-line px-3 py-2 text-ivory-70">{money(s.starting_price_cents)} · {s.price_status}</td>}
            </tr>
          ))}</tbody>
        </table>
      </div>
      <h2 className="label mb-2 mt-10 text-ivory-70">Recurring plans</h2>
      <div className="overflow-x-auto border border-line">
        <table className="w-full min-w-[860px] text-left text-[13px]">
          <thead><tr><Th>Plan</Th><Th>Monthly ($)</Th><Th>Price status</Th><Th>Min term</Th><Th>Revisions</Th><Th>Capacity (h)</Th><Th>Visibility</Th><Th></Th></tr></thead>
          <tbody>{packages.map((p) => (
            <tr key={p.id}><td className="border-b border-line px-3 py-2 font-medium">{p.name}</td>
              {canEdit ? <PackageRowEditor p={p} /> : <td colSpan={7} className="border-b border-line px-3 py-2 text-ivory-70">{money(p.monthly_price_cents)} · {p.price_status}</td>}
            </tr>
          ))}</tbody>
        </table>
      </div>
      <p className="mt-4 text-[12px] text-ivory-50">Allowances, scope text and deliverables are seeded from src/content/catalog.ts and will be editable here in a later iteration. Every price change is audited.</p>
    </>
  );
}
