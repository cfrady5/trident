import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container, Eyebrow } from "@/components/ui/primitives";
import { Arrow, ButtonLink } from "@/components/ui/button";
import { insights } from "@/content/site";

const fmtDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

export function generateStaticParams() {
  return insights.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: PageProps<"/insights/[slug]">): Promise<Metadata> {
  const { slug: key } = await params;
  const a = insights.find((x) => x.slug === key);
  return a ? { title: a.title, description: a.summary, openGraph: { type: "article", publishedTime: a.published } } : {};
}

export default async function InsightPage({ params }: PageProps<"/insights/[slug]">) {
  const { slug: key } = await params;
  const a = insights.find((x) => x.slug === key);
  if (!a) notFound();
  return (
    <article>
      <Container className="max-w-[760px] py-16 md:py-24">
        <Eyebrow>Insights · {fmtDate(a.published)}</Eyebrow>
        <h1 className="mt-5 font-display text-[2.5rem] font-bold leading-[1.05] tracking-[-0.02em] md:text-[3.25rem]">{a.title}</h1>
        <p className="mt-6 text-body-l text-ivory-70">{a.summary}</p>
        <div className="prose-trident mt-12 text-body-l">
          {a.body.map((b, i) => {
            if (b.type === "h2") return <h2 key={i}>{b.text}</h2>;
            if (b.type === "ul") return <ul key={i}>{b.items!.map((it) => <li key={it}>{it}</li>)}</ul>;
            if (b.type === "source") return <p key={i} className="mt-12 border-t border-line pt-6 text-caption text-ivory-70">{b.text}</p>;
            return <p key={i}>{b.text}</p>;
          })}
        </div>
        <div className="mt-14 border-t border-line pt-10">
          <ButtonLink href="/assessment">Assess your commercial readiness <Arrow /></ButtonLink>
        </div>
      </Container>
    </article>
  );
}
