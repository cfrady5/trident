import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/site/page-header";
import { Container } from "@/components/ui/primitives";
import { Arrow, ButtonLink } from "@/components/ui/button";
import { pillars } from "@/content/site";
import { formatPrice, listServices } from "@/lib/catalog";

export const metadata: Metadata = { title: "Services", description: "Services organized by Position, Build and Activate." };
export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const services = (await listServices()).filter((s) => s.is_published);
  return (
    <>
      <PageHeader eyebrow="Services" title="Every service maps to one prong of the method." intro="Start with the prong you need most, or run all three as one program.">
        <ButtonLink href="/marketplace" variant="secondary">Browse the full marketplace <Arrow /></ButtonLink>
      </PageHeader>
      <Container className="py-16">
        {pillars.map((p) => {
          const list = services.filter((s) => s.pillar === p.key);
          return (
            <section key={p.key} className="grid gap-8 border-b border-line py-12 lg:grid-cols-12" aria-labelledby={`pillar-${p.key}`}>
              <div className="lg:col-span-4">
                <p className="label text-gold">{p.number} · {p.question}</p>
                <h2 id={`pillar-${p.key}`} className="mt-3 font-display text-[2rem] font-bold">{p.name}</h2>
                <p className="mt-2 text-ivory-70">{p.intro}</p>
                <Link href={`/services/${p.key}`} className="mt-5 inline-flex items-center gap-2 text-gold-light">About {p.name} <Arrow /></Link>
              </div>
              <ul className="lg:col-span-8">
                {list.map((s) => (
                  <li key={s.slug} className="border-b border-line last:border-0">
                    <Link href={`/marketplace/${s.slug}`} className="flex items-baseline justify-between gap-6 py-4 hover:text-gold-light">
                      <span><span className="font-semibold">{s.name}</span><span className="mt-1 block text-caption text-ivory-70">{s.summary}</span></span>
                      <span className="shrink-0 text-caption">From {formatPrice(s.starting_price_cents)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </Container>
    </>
  );
}
