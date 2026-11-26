import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/site/page-header";
import { Section } from "@/components/site/section";
import { Arrow, ButtonLink } from "@/components/ui/button";
import { industries, site } from "@/content/site";
import { formatPrice, listServices } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/industries/[slug]">): Promise<Metadata> {
  const { slug: key } = await params;
  const ind = industries.find((x) => x.slug === key);
  return ind ? { title: ind.name, description: ind.intro } : {};
}

export default async function IndustryPage({ params }: PageProps<"/industries/[slug]">) {
  const { slug: key } = await params;
  const ind = industries.find((x) => x.slug === key);
  if (!ind) notFound();
  const services = (await listServices()).filter((s) => s.is_published && ind.serviceSlugs.includes(s.slug));
  return (
    <>
      <PageHeader eyebrow={`Industries · ${ind.name}`} title={ind.headline} intro={ind.intro} />
      <Section>
        <div className="grid gap-12 md:grid-cols-2">
          <div><p className="label text-gold">Who buys</p><ul className="mt-4 border-t border-line">{ind.buyers.map((b) => <li key={b} className="border-b border-line py-3">{b}</li>)}</ul></div>
          <div><p className="label text-gold">Gaps we see most often</p><ul className="mt-4 border-t border-line">{ind.gaps.map((g) => <li key={g} className="border-b border-line py-3 text-ivory-70">{g}</li>)}</ul></div>
        </div>
      </Section>
      <Section tone="carbon" eyebrow="Where to start" title="Relevant services">
        <div className="border-t border-line">
          {services.map((s) => (
            <Link key={s.slug} href={`/marketplace/${s.slug}`} className="flex items-baseline justify-between gap-6 border-b border-line py-5 hover:text-gold-light">
              <span><span className="font-display text-h2 font-bold">{s.name}</span><span className="mt-1 block text-caption text-ivory-70">{s.summary}</span></span>
              <span className="shrink-0 text-caption">From {formatPrice(s.starting_price_cents)}</span>
            </Link>
          ))}
        </div>
        <div className="mt-10"><ButtonLink href="/assessment">Assess your commercial readiness <Arrow /></ButtonLink></div>
        <p className="mt-10 max-w-2xl text-caption text-ivory-70">{site.disclaimer}</p>
      </Section>
    </>
  );
}
