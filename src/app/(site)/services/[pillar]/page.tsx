import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/site/page-header";
import { Section } from "@/components/site/section";
import { Arrow, ButtonLink } from "@/components/ui/button";
import { pillars } from "@/content/site";
import { formatPrice, listServices, turnaround } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/services/[pillar]">): Promise<Metadata> {
  const { pillar: key } = await params;
  const p = pillars.find((x) => x.key === key);
  return p ? { title: `${p.name}: ${p.line}`, description: p.intro } : {};
}

export default async function PillarPage({ params }: PageProps<"/services/[pillar]">) {
  const { pillar } = await params;
  const p = pillars.find((x) => x.key === pillar);
  if (!p) notFound();
  const services = (await listServices()).filter((s) => s.is_published && (s.pillar === p.key || p.serviceSlugs.includes(s.slug)));
  const next = pillars[pillars.indexOf(p) + 1];
  return (
    <>
      <PageHeader eyebrow={`${p.number} · ${p.question}`} title={<>{p.name}. <span className="text-gold">{p.line}</span></>} intro={p.intro} />
      <Section eyebrow="What it solves" title={p.problem}>
        <div className="grid gap-10 md:grid-cols-2">
          <div><p className="label text-ivory-70">Core services</p><ul className="mt-3 space-y-2">{p.services.map((s) => <li key={s} className="flex gap-2"><span className="text-gold" aria-hidden>—</span>{s}</li>)}</ul></div>
          <div><p className="label text-ivory-70">Output</p><p className="mt-3 font-display text-h2 font-bold">{p.output}</p></div>
        </div>
      </Section>
      <Section tone="ivory" eyebrow="Products" title={`${p.name} in the marketplace`}>
        <div className="border-t border-black/15">
          {services.map((s) => (
            <Link key={s.slug} href={`/marketplace/${s.slug}`} className="group grid gap-2 border-b border-black/15 py-5 sm:grid-cols-12 sm:items-baseline">
              <span className="font-display text-h2 font-bold sm:col-span-4">{s.name}</span>
              <span className="text-caption text-black/70 sm:col-span-5">{s.summary}</span>
              <span className="text-caption text-black/70 sm:col-span-1">{turnaround(s)}</span>
              <span className="flex justify-between font-semibold sm:col-span-2 sm:justify-end sm:gap-3">From {formatPrice(s.starting_price_cents)} <Arrow /></span>
            </Link>
          ))}
        </div>
      </Section>
      <Section>
        <div className="flex flex-col gap-4 sm:flex-row">
          <ButtonLink href="/assessment">Assess your commercial readiness <Arrow /></ButtonLink>
          {next && <ButtonLink href={`/services/${next.key}`} variant="secondary">Next: {next.name}</ButtonLink>}
        </div>
      </Section>
    </>
  );
}
