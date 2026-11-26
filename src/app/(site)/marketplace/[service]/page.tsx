import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container, Eyebrow } from "@/components/ui/primitives";
import { Arrow, ButtonLink } from "@/components/ui/button";
import { ShortlistButton } from "@/components/marketplace/shortlist-button";
import { PILLARS, formatPrice, getService, turnaround } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/marketplace/[service]">): Promise<Metadata> {
  const r = await getService((await params).service);
  return r ? { title: r.service.name, description: r.service.summary } : {};
}

const BILLING: Record<string, string> = { fixed: "Fixed price", milestone: "Billed by milestone", monthly: "Monthly", custom: "Custom" };

export default async function ServicePage({ params }: PageProps<"/marketplace/[service]">) {
  const r = await getService((await params).service);
  if (!r || !r.service.is_published) notFound();
  const { service: s, related } = r;
  const pillar = PILLARS[s.pillar];
  return (
    <>
      <section className="border-b border-line">
        <Container className="grid gap-12 py-16 md:py-20 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <nav aria-label="Breadcrumb" className="label text-ivory-70"><Link href="/marketplace" className="hover:text-ivory">Marketplace</Link> / <Link href={s.pillar === "program" ? "/method" : `/services/${s.pillar}`} className="hover:text-ivory">{pillar.label}</Link></nav>
            <h1 className="mt-5 font-display text-[2.5rem] font-bold leading-[1.02] tracking-[-0.02em] md:text-[3.5rem]">{s.name}</h1>
            <p className="mt-5 max-w-2xl text-body-l text-ivory-70">{s.description}</p>
          </div>
          <aside className="border border-line bg-carbon p-6 lg:col-span-4" aria-label="Pricing summary">
            <p className="label text-ivory-70">Starting price</p>
            <p className="mt-1 font-display text-[2.25rem] font-bold">{formatPrice(s.starting_price_cents)}</p>
            <dl className="mt-5 space-y-2 border-t border-line pt-5 text-caption">
              <div className="flex justify-between"><dt className="text-ivory-70">Billing</dt><dd>{BILLING[s.billing_model]}</dd></div>
              <div className="flex justify-between"><dt className="text-ivory-70">Timeline</dt><dd>{turnaround(s)}{!s.turnaround_confirmed && " (estimate)"}</dd></div>
              <div className="flex justify-between"><dt className="text-ivory-70">Revision rounds</dt><dd>{s.included_revisions}</dd></div>
            </dl>
            <div className="mt-6 flex flex-col gap-2">
              <ButtonLink href={`/contact?type=proposal&services=${s.slug}`}>Request a proposal</ButtonLink>
              <ShortlistButton slug={s.slug} />
              <Link href="/apply" className="mt-1 text-center text-caption text-ivory-70 hover:text-ivory">Start a company application</Link>
            </div>
          </aside>
        </Container>
      </section>
      <Container className="grid gap-12 py-16 md:grid-cols-2 lg:grid-cols-3">
        <div><Eyebrow>Scope</Eyebrow><ul className="mt-4 space-y-2">{s.scope.map((x) => <li key={x} className="flex gap-2"><span className="text-gold" aria-hidden>—</span>{x}</li>)}</ul></div>
        <div><Eyebrow>Deliverables</Eyebrow><ul className="mt-4 space-y-3">{s.deliverables.map((d) => <li key={d.name}><span className="font-semibold">{d.name}</span><span className="block text-caption text-ivory-70">{d.format}</span></li>)}</ul></div>
        <div><Eyebrow>Before we start</Eyebrow><ul className="mt-4 space-y-2 text-ivory-70">{s.prerequisites.map((x) => <li key={x}>{x}</li>)}</ul></div>
        {s.add_ons.length > 0 && <div><Eyebrow>Optional add-ons</Eyebrow><ul className="mt-4 space-y-2">{s.add_ons.map((a) => <li key={a.name} className="flex justify-between gap-4"><span>{a.name}</span><span className="text-ivory-70">+{formatPrice(a.price_cents)}</span></li>)}</ul></div>}
        {s.exclusions.length > 0 && <div><Eyebrow tone="muted">Not included</Eyebrow><ul className="mt-4 space-y-2 text-ivory-70">{s.exclusions.map((x) => <li key={x}>{x}</li>)}</ul></div>}
      </Container>
      {related.length > 0 && (
        <section className="border-t border-line bg-carbon">
          <Container className="py-16">
            <Eyebrow>Related services</Eyebrow>
            <div className="mt-6 border-t border-line">
              {related.map((x) => (
                <Link key={x.slug} href={`/marketplace/${x.slug}`} className="flex items-baseline justify-between gap-6 border-b border-line py-4 hover:text-gold-light">
                  <span><span className="font-semibold">{x.name}</span><span className="mt-1 block text-caption text-ivory-70">{x.summary}</span></span>
                  <span className="flex shrink-0 items-center gap-2 text-caption">From {formatPrice(x.starting_price_cents)} <Arrow /></span>
                </Link>
              ))}
            </div>
          </Container>
        </section>
      )}
    </>
  );
}
