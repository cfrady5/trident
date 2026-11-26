import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/site/page-header";
import { Container } from "@/components/ui/primitives";
import { Arrow } from "@/components/ui/button";
import { industries } from "@/content/site";

export const metadata: Metadata = { title: "Industries", description: "Commercialization for defense, aerospace, advanced manufacturing and emerging technology companies." };

export default function IndustriesPage() {
  return (
    <>
      <PageHeader eyebrow="Industries" title="Built for dual-use buyers: defense programs and commercial operators." intro="The method is the same everywhere. The buyer, the language and the proof change by industry." />
      <Container className="py-12">
        {industries.map((ind, i) => (
          <Link key={ind.slug} href={`/industries/${ind.slug}`} className="group grid gap-4 border-b border-line py-10 md:grid-cols-12">
            <span className="font-mono text-caption text-gold md:col-span-1">{String(i + 1).padStart(2, "0")}</span>
            <span className="font-display text-[1.75rem] font-bold leading-tight md:col-span-4">{ind.name}</span>
            <span className="text-ivory-70 md:col-span-6"><span className="block text-ivory">{ind.headline}</span>{ind.intro}</span>
            <span className="text-gold-light transition-transform group-hover:translate-x-1 md:col-span-1 md:text-right"><Arrow /></span>
          </Link>
        ))}
      </Container>
    </>
  );
}
