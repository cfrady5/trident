import { notFound } from "next/navigation";
import { PageHeader } from "@/components/site/page-header";
import { Container } from "@/components/ui/primitives";
import { publishedCaseStudies } from "@/content/case-studies";

export function generateStaticParams() {
  return publishedCaseStudies().map((c) => ({ slug: c.slug }));
}

export default async function CaseStudyPage({ params }: PageProps<"/case-studies/[slug]">) {
  const { slug: key } = await params;
  const cs = publishedCaseStudies().find((c) => c.slug === key);
  if (!cs) notFound();
  return (
    <>
      <PageHeader eyebrow={`Case study · ${cs.clientName}`} title={cs.headline} intro={cs.challenge} />
      <Container className="py-16">
        <ul className="space-y-2">{cs.work.map((w) => <li key={w}>{w}</li>)}</ul>
        <dl className="mt-10 border-t border-line">
          {cs.outcomes.map((o) => (
            <div key={o.claim} className="border-b border-line py-4"><dt>{o.claim}</dt><dd className="text-caption text-ivory-70">{o.source} · {o.date}</dd></div>
          ))}
        </dl>
      </Container>
    </>
  );
}
