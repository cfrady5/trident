import type { Metadata } from "next";
import { DevBanner } from "@/components/site/dev-banner";
import { AppHeader } from "@/components/app/app-header";
import { CommandSidebar, type NavItem } from "@/components/command/sidebar";
import { requireStaff } from "@/lib/auth";
import { withUser } from "@/lib/db";

export const metadata: Metadata = { title: { default: "Trident Command", template: "%s · Command" }, robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CommandLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const [c] = await withUser(user.id, (tx) => tx<{ apps: number; inquiries: number; review: number }[]>`
    select (select count(*) from public.applications where status in ('submitted','under_review'))::int as apps,
           (select count(*) from public.inquiries where status = 'new')::int as inquiries,
           (select count(*) from public.automation_runs where status = 'needs_review')::int as review`);
  const items: NavItem[] = [
    { href: "/command", label: "Overview" },
    { href: "/command/opportunities", label: "Opportunities" },
    { href: "/command/applications", label: "Applications", count: c?.apps },
    { href: "/command/inquiries", label: "Inquiries", count: c?.inquiries },
    { href: "/command/companies", label: "Companies" },
    { href: "/command/intelligence", label: "Intelligence", count: c?.review },
    { href: "/command/assessments", label: "Assessments" },
    { href: "/command/proposals", label: "Proposals", phase: 3 },
    { href: "/command/engagements", label: "Engagements", phase: 3 },
    { href: "/command/clients", label: "Clients", phase: 3 },
    { href: "/command/production", label: "Production", phase: 4 },
    { href: "/command/campaigns", label: "Campaigns", phase: 5 },
    { href: "/command/assets", label: "Assets", phase: 4 },
    { href: "/command/catalog", label: "Catalog & pricing" },
    { href: "/command/finance", label: "Finance" },
    { href: "/command/automations", label: "Automations" },
    { href: "/command/team", label: "Team" },
    { href: "/command/settings", label: "Settings" },
  ];
  return (
    <>
      <DevBanner />
      <AppHeader email={user.email} area="Trident Command" links={[{ href: "/portal", label: "Portal" }, { href: "/", label: "Website" }]} />
      <div className="mx-auto grid max-w-[1600px] gap-6 px-4 py-6 lg:grid-cols-[200px_1fr] lg:px-6">
        <aside className="lg:sticky lg:top-4 lg:self-start"><CommandSidebar items={items} /></aside>
        <main id="main" className="min-w-0">{children}</main>
      </div>
    </>
  );
}
