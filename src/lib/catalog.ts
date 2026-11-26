import { withAnon, type Tx } from "./db";

export type PillarKey = "position" | "build" | "activate" | "program";

export interface Service {
  id: string;
  slug: string;
  name: string;
  summary: string;
  description: string;
  pillar: PillarKey;
  category_slug: string;
  category_name: string;
  deliverable_types: string[];
  starting_price_cents: number;
  price_status: "proposed" | "approved";
  billing_model: "fixed" | "monthly" | "milestone" | "custom";
  scope: string[];
  deliverables: { name: string; format: string }[];
  turnaround_weeks_min: number | null;
  turnaround_weeks_max: number | null;
  turnaround_confirmed: boolean;
  included_revisions: number;
  prerequisites: string[];
  add_ons: { name: string; price_cents: number; note?: string }[];
  exclusions: string[];
  is_featured: boolean;
  is_published: boolean;
  sort: number;
}

export interface ServicePackage {
  id: string;
  slug: string;
  name: string;
  summary: string;
  monthly_price_cents: number;
  price_is_minimum: boolean;
  price_status: "proposed" | "approved";
  min_term_months: number;
  allowances: { key: string; label: string; quantity: number; unit: string }[];
  inclusions: string[];
  exclusions: string[];
  overage_terms: string | null;
  meeting_cadence: string | null;
  revision_limit: number;
  is_published: boolean;
}

export interface Category {
  slug: string;
  name: string;
  description: string | null;
}

export async function listServicesTx(tx: Tx): Promise<Service[]> {
  return tx<Service[]>`
    select s.*, c.slug as category_slug, c.name as category_name
    from public.services s join public.service_categories c on c.id = s.category_id
    order by s.sort, s.name`;
}

export const listServices = () => withAnon(listServicesTx);

export function listCategories(): Promise<Category[]> {
  return withAnon((tx) => tx<Category[]>`select slug, name, description from public.service_categories order by sort`);
}

export async function getService(slug: string): Promise<{ service: Service; related: Service[] } | null> {
  return withAnon(async (tx) => {
    const [service] = await tx<Service[]>`
      select s.*, c.slug as category_slug, c.name as category_name
      from public.services s join public.service_categories c on c.id = s.category_id where s.slug = ${slug}`;
    if (!service) return null;
    const related = await tx<Service[]>`
      select s.*, c.slug as category_slug, c.name as category_name
      from public.service_dependencies d join public.services s on s.id = d.depends_on_service_id
      join public.service_categories c on c.id = s.category_id
      where d.service_id = ${service.id} order by s.sort`;
    return { service, related };
  });
}

export function listPackages(): Promise<ServicePackage[]> {
  return withAnon((tx) => tx<ServicePackage[]>`select * from public.service_packages order by sort`);
}

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

export function turnaround(s: Pick<Service, "turnaround_weeks_min" | "turnaround_weeks_max">): string {
  const { turnaround_weeks_min: a, turnaround_weeks_max: b } = s;
  if (!a) return "Scoped per engagement";
  if (!b || a === b) return `${a} ${a === 1 ? "week" : "weeks"}`;
  return `${a} to ${b} weeks`;
}

export const PILLARS: Record<PillarKey, { label: string; question: string; line: string; number: string }> = {
  position: { label: "Position", question: "Who buys this and why?", line: "Define the opportunity.", number: "01" },
  build: { label: "Build", question: "Will they believe us?", line: "Establish the presence.", number: "02" },
  activate: { label: "Activate", question: "Will they act?", line: "Generate demand.", number: "03" },
  program: { label: "Program", question: "All three, in order.", line: "Position, Build and Activate as one program.", number: "—" },
};

export const BUDGET_BANDS = [
  { key: "under-2500", label: "Under $2,500", min: 0, max: 249_999 },
  { key: "2500-7500", label: "$2,500 to $7,500", min: 250_000, max: 750_000 },
  { key: "7500-plus", label: "Over $7,500", min: 750_001, max: Number.MAX_SAFE_INTEGER },
] as const;
