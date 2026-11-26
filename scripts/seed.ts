/**
 * Idempotent seed. Inserts missing reference data only; never overwrites rows
 * that staff may have edited in Trident Command (prices, copy, publishing).
 *
 *   tsx scripts/seed.ts
 *
 * Seeds: the internal Trident organization, service categories, services,
 * service dependencies, recurring plans and the active readiness framework.
 * No demo companies, clients, metrics or testimonials are seeded.
 */
import postgres from "postgres";
import { categories, packages, services } from "../src/content/catalog.ts";
import {
  FRAMEWORK_KEY,
  FRAMEWORK_VERSION,
  frameworkCategories,
  frameworkCriteria,
  methodologyNote,
} from "../src/content/readiness-framework.ts";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const sql = postgres(url, { onnotice: () => {}, max: 1 });

async function main() {
  await sql.begin(async (tx) => {
    await tx`insert into public.organizations (kind, name, slug) values ('internal', 'Trident', 'trident')
             on conflict do nothing`;

    for (const [i, c] of categories.entries()) {
      await tx`insert into public.service_categories (slug, name, description, sort)
               values (${c.slug}, ${c.name}, ${c.description}, ${i})
               on conflict (slug) do nothing`;
    }

    for (const [i, s] of services.entries()) {
      const [cat] = await tx`select id from public.service_categories where slug = ${s.category}`;
      if (!cat) throw new Error(`unknown category ${s.category}`);
      await tx`
        insert into public.services (
          slug, name, summary, description, pillar, category_id, deliverable_types,
          starting_price_cents, billing_model, scope, deliverables,
          turnaround_weeks_min, turnaround_weeks_max, included_revisions, prerequisites,
          add_ons, exclusions, production_workflow, required_profile_fields, is_featured, sort)
        values (
          ${s.slug}, ${s.name}, ${s.summary}, ${s.description}, ${s.pillar}, ${cat.id}, ${s.deliverableTypes},
          ${s.startingPrice * 100}, ${s.billingModel}, ${s.scope}, ${tx.json(s.deliverables)},
          ${s.turnaroundWeeks[0]}, ${s.turnaroundWeeks[1]}, ${s.includedRevisions}, ${s.prerequisites},
          ${tx.json(s.addOns.map((a) => ({ ...a, price_cents: a.price * 100 })))}, ${s.exclusions},
          ${s.productionWorkflow}, ${s.requiredProfileFields}, ${s.featured ?? false}, ${i})
        on conflict (slug) do nothing`;
    }

    for (const s of services) {
      for (const rel of s.related) {
        await tx`
          insert into public.service_dependencies (service_id, depends_on_service_id, kind)
          select a.id, b.id, 'related' from public.services a, public.services b
          where a.slug = ${s.slug} and b.slug = ${rel}
          on conflict do nothing`;
      }
    }

    for (const [i, p] of packages.entries()) {
      await tx`
        insert into public.service_packages (
          slug, name, summary, monthly_price_cents, price_is_minimum, min_term_months, allowances,
          inclusions, exclusions, overage_terms, meeting_cadence, revision_limit, production_hours_capacity, sort)
        values (
          ${p.slug}, ${p.name}, ${p.summary}, ${p.monthlyPrice * 100}, ${p.priceIsMinimum}, ${p.minTermMonths},
          ${tx.json(p.allowances)}, ${p.inclusions}, ${p.exclusions}, ${p.overageTerms}, ${p.meetingCadence},
          ${p.revisionLimit}, ${p.productionHoursCapacity}, ${i})
        on conflict (slug) do nothing`;
    }

    const [existing] = await tx`select id from public.assessment_frameworks where key = ${FRAMEWORK_KEY} and version = ${FRAMEWORK_VERSION}`;
    if (!existing) {
      const [fw] = await tx`
        insert into public.assessment_frameworks (key, version, name, status, categories, methodology_note, published_at)
        values (${FRAMEWORK_KEY}, ${FRAMEWORK_VERSION}, 'Trident Commercial Readiness Index', 'active',
                ${tx.json(frameworkCategories)}, ${methodologyNote}, now())
        returning id`;
      for (const [i, c] of frameworkCriteria.entries()) {
        await tx`
          insert into public.assessment_criteria (framework_id, category_key, key, prompt, help, weight, options, improvement, service_slugs, sort)
          values (${fw!.id}, ${c.category}, ${c.key}, ${c.prompt}, ${c.help ?? null}, ${c.weight},
                  ${tx.json(c.options)}, ${c.improvement}, ${c.services}, ${i})`;
      }
    }
  });
  const [counts] = await sql`select
    (select count(*) from public.services) as services,
    (select count(*) from public.service_packages) as packages,
    (select count(*) from public.assessment_criteria) as criteria`;
  console.log(`seed complete: ${counts!.services} services, ${counts!.packages} plans, ${counts!.criteria} readiness criteria`);
}

main().then(() => sql.end()).catch(async (e) => { console.error(e); await sql.end(); process.exit(1); });
