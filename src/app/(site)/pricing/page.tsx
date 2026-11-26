import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/site/page-header";
import { Section } from "@/components/site/section";
import { Arrow, ButtonLink } from "@/components/ui/button";
import { faqs } from "@/content/site";
import { formatPrice, listPackages, listServices } from "@/lib/catalog";

export const metadata: Metadata = { title: "Pricing", description: "Fixed-scope products and recurring plans with defined allowances." };
export const dynamic = "force-dynamic";

const PACKAGE_SLUGS = ["position-sprint", "build-kit", "90-day-activate-program", "beyond-the-award"];

export default async function PricingPage() {
  const [plans, services] = await Promise.all([listPackages(), listServices()]);
  const published = plans.filter((p) => p.is_published);
  const packaged = PACKAGE_SLUGS.map((slug) => services.find((s) => s.slug === slug && s.is_published)).filter(Boolean);
  return (
    <>
      <PageHeader eyebrow="Pricing" title="Clear prices. Defined allowances. Nothing unlimited." intro="Start with a fixed-scope product, keep momentum with a recurring plan or run the full method as one program." />
      <Section eyebrow="Recurring plans" title="Monthly plans with defined allowances." intro="Every plan has a minimum term, revision limits and exclusions. Work beyond an allowance is quoted and approved before production begins.">
        <div className="grid gap-px border border-line bg-line md:grid-cols-2 xl:grid-cols-4">
          {published.map((p) => (
            <article key={p.slug} className="flex flex-col bg-black p-7">
              <h3 className="font-display text-h2 font-bold">{p.name}</h3>
              <p className="mt-2 min-h-12 text-caption text-ivory-70">{p.summary}</p>
              <p className="mt-6 font-display text-[2.25rem] font-bold leading-none">{formatPrice(p.monthly_price_cents)}{p.price_is_minimum && "+"}<span className="ml-1 font-sans text-caption font-normal text-ivory-70">/month</span></p>
              <p className="mt-2 text-caption text-ivory-70">{p.min_term_months}-month minimum · {p.meeting_cadence} meetings</p>
              {p.allowances.length > 0 && (
                <ul className="mt-6 space-y-2 border-t border-line pt-5 text-caption">
                  {p.allowances.map((a) => <li key={a.key} className="flex gap-3"><span className="w-6 shrink-0 text-right font-mono text-gold">{a.quantity}</span><span>{a.label}{a.unit === "hours" ? " (hours)" : ""}</span></li>)}
                </ul>
              )}
              <ul className="mt-5 flex-1 space-y-1.5 text-caption text-ivory-70">{p.inclusions.map((i) => <li key={i}>{i}</li>)}</ul>
              <details className="mt-5 text-caption text-ivory-70"><summary className="cursor-pointer text-ivory">Limits and exclusions</summary>
                <ul className="mt-2 space-y-1">{p.exclusions.map((x) => <li key={x}>{x}</li>)}<li>{p.revision_limit} revision round(s) per deliverable</li>{p.overage_terms && <li>{p.overage_terms}</li>}</ul>
              </details>
              <ButtonLink href={`/contact?type=proposal`} variant="secondary" size="sm" className="mt-6">Discuss {p.name}</ButtonLink>
            </article>
          ))}
        </div>
      </Section>
      <Section tone="ivory" eyebrow="Packages" title="The method as fixed-scope packages.">
        <div className="border-t border-black/15">
          {packaged.map((s) => s && (
            <Link key={s.slug} href={`/marketplace/${s.slug}`} className="group grid gap-2 border-b border-black/15 py-5 sm:grid-cols-12 sm:items-baseline">
              <span className="font-display text-h2 font-bold sm:col-span-4">{s.name}</span>
              <span className="text-caption text-black/70 sm:col-span-6">{s.summary}</span>
              <span className="flex justify-between font-semibold sm:col-span-2 sm:justify-end sm:gap-3">From {formatPrice(s.starting_price_cents)} <Arrow /></span>
            </Link>
          ))}
        </div>
        <ButtonLink href="/marketplace" variant="dark" className="mt-10">See all fixed-scope products <Arrow /></ButtonLink>
      </Section>
      <Section eyebrow="Questions" title="Before you ask.">
        <dl className="border-t border-line">
          {faqs.map((f) => <div key={f.q} className="grid gap-2 border-b border-line py-6 md:grid-cols-12"><dt className="font-semibold md:col-span-5">{f.q}</dt><dd className="text-ivory-70 md:col-span-7">{f.a}</dd></div>)}
        </dl>
      </Section>
    </>
  );
}
