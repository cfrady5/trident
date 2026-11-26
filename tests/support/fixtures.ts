import { randomUUID } from "node:crypto";
import { withSystem } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";

export async function createUser(email = `${randomUUID().slice(0, 8)}@example.com`, fullName = "Test User"): Promise<CurrentUser> {
  const id = await withSystem(async (tx) => {
    const [u] = await tx<{ id: string }[]>`insert into auth.users (email, raw_user_meta_data) values (${email}, ${tx.json({ full_name: fullName })}) returning id`;
    return u!.id;
  });
  return { id, email, fullName, memberships: [], staffRoles: [], isStaff: false };
}

export async function makeStaff(user: CurrentUser, role = "strategist"): Promise<CurrentUser> {
  await withSystem((tx) => tx`insert into public.organization_memberships (organization_id, user_id, role)
    select id, ${user.id}, ${role} from public.organizations where kind = 'internal'`);
  return { ...user, isStaff: true, staffRoles: [role as never] };
}

export const completeAnswers = (overrides: Record<string, unknown> = {}) => ({
  company_name: "Acme Photonics", website: "https://acme-photonics.example", industry: "aerospace", headquarters: "Dayton, OH", employee_range: "11-25",
  contact_name: "Ada Founder", contact_role: "CEO", company_maturity: "seed",
  technology_name: "LumaLink", technology_description: "Free-space optical links for satellites.", problem_solved: "Bandwidth limits between satellites.",
  core_differentiators: "Half the mass of incumbents.", product_maturity: "pilot",
  sbir_status: "awarded", sbir_agency: "Air Force", sbir_phase: "phase_ii",
  credentials: [{ type: "marketplace_selection", title: "Selected as Awardable on a marketplace", date: "2026-03", sourceUrl: "https://example.org/listing" }],
  target_buyers: ["commercial_operators"], desired_outcomes: "Three commercial pilots.", commercialization_timeline: "3_6",
  monthly_budget: "1500_3500", project_budget: "2500_7500", decision_authority: "decision_maker", engagement_objectives: "Positioning and website.",
  ...overrides,
});

export const allConsents = { processing: true, public_research: true, no_restricted_information: true } as const;
