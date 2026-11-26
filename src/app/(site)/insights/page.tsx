import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/site/page-header";
import { Container } from "@/components/ui/primitives";
import { insights } from "@/content/site";

export const metadata: Metadata = { title: "Insights", description: "Points of view on commercializing government-validated technology." };

const fmtDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

export default function InsightsPage() {
  const list = [...insights].sort((a, b) => b.published.localeCompare(a.published));
  return (
    <>
      <PageHeader eyebrow="Insights" title="Fewer, better posts. Thought leadership first." intro="Points of view on turning validation into demand. Every figure carries its source and the year it covers." />
      <Container className="py-12">
        {list.map((a) => (
          <Link key={a.slug} href={`/insights/${a.slug}`} className="group grid gap-3 border-b border-line py-10 md:grid-cols-12">
            <span className="label text-ivory-70 md:col-span-3">{fmtDate(a.published)} · {a.readingMinutes} min</span>
            <span className="md:col-span-9">
              <span className="block font-display text-[1.75rem] font-bold leading-tight group-hover:text-gold-light">{a.title}</span>
              <span className="mt-2 block max-w-2xl text-ivory-70">{a.summary}</span>
            </span>
          </Link>
        ))}
      </Container>
    </>
  );
}
