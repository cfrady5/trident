import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container, Eyebrow } from "@/components/ui/primitives";
import { Arrow, ButtonLink } from "@/components/ui/button";
import { PrintButton } from "@/components/site/print-button";
import { loadAssessmentByToken } from "@/lib/index/service";
import { BAND_LABELS, recommendedServiceSlugs } from "@/lib/index/scoring";
import { formatPrice } from "@/lib/catalog";

export const metadata: Metadata = { title: "Your readiness results", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ResultsPage({ params, searchParams }: PageProps<"/assessment/results/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const data = await loadAssessmentByToken(id, typeof sp.t === "string" ? sp.t : "");
  if (!data) notFound();
  const { assessment: a, framework: fw, services } = data;
  const r = a.computed;
  const recSlugs = recommendedServiceSlugs(r);
  const recs = recSlugs.map((slug) => services.find((s) => s.slug === slug)).filter((s): s is NonNullable<typeof s> => !!s);
  const strengths = r.criteria.filter((c) => c.score !== null && c.score >= 80);
  const investment = recs.reduce((sum, s) => sum + s.starting_price_cents, 0);
  const roadmap = [
    { window: "Days 1 to 30", items: r.priorities.slice(0, 2) },
    { window: "Days 31 to 60", items: r.priorities.slice(2, 4) },
    { window: "Days 61 to 90", items: r.priorities.slice(4, 5) },
  ].filter((p) => p.items.length);

  return (
    <article>
      <section className="border-b border-line">
        <Container className="py-16 md:py-20">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Eyebrow>Commercial Readiness Index · {fw.name} v{fw.version}</Eyebrow>
            <span className="label border border-gold/60 px-2 py-1 text-gold">{a.review_state === "human_reviewed" ? "Reviewed by a Trident strategist" : "Preliminary · self-assessment · not reviewed"}</span>
          </div>
          <h1 className="mt-6 font-display text-[2.5rem] font-bold leading-[1.02] md:text-[3.5rem]">{a.company_name}</h1>
          <div className="mt-10 grid gap-10 md:grid-cols-12">
            <div className="md:col-span-4">
              <p className="label text-ivory-70">Overall readiness</p>
              <p className="mt-2 font-display text-[5rem] font-bold leading-none text-gold-light">{r.overall ?? "—"}<span className="text-h2 text-ivory-70"> / 100</span></p>
              {r.band && <p className="mt-2 font-display text-h2 font-bold">{BAND_LABELS[r.band]}</p>}
            </div>
            <div className="space-y-3 text-ivory-70 md:col-span-8">
              <p className="text-body-l text-ivory">
                {r.overall === null ? "There isn't enough information to calculate an overall score." :
                  `Based on your answers, ${a.company_name} is at ${/^[aeiou]/i.test(BAND_LABELS[r.band!]) ? "an" : "a"} ${BAND_LABELS[r.band!].toLowerCase()} stage of commercial readiness. ${r.priorities.length ? `The highest-impact improvement is: ${r.priorities[0]!.recommendation!.charAt(0).toLowerCase()}${r.priorities[0]!.recommendation!.slice(1)}` : "No major gaps were identified in the areas you answered."}`}
              </p>
              <p>Completeness {Math.round(r.completeness * 100)}% · Confidence {r.confidence} · {r.missing.length} item(s) not answered</p>
              <div className="flex flex-wrap gap-5 pt-2"><PrintButton /><a className="text-caption text-gold-light" href={`/api/assessments/${a.id}?t=${encodeURIComponent(String(sp.t))}`}>Download JSON</a></div>
            </div>
          </div>
        </Container>
      </section>

      <Container className="grid gap-16 py-16 lg:grid-cols-12">
        <section className="lg:col-span-7" aria-labelledby="breakdown">
          <h2 id="breakdown" className="font-display text-h2 font-bold">Category breakdown</h2>
          <ul className="mt-6 border-t border-line">
            {r.categories.map((c) => (
              <li key={c.key} className="border-b border-line py-4">
                <div className="flex items-baseline justify-between gap-4"><span className="font-medium">{c.name} <span className="font-mono text-caption text-ivory-50">{Math.round(c.weight * 100)}%</span></span><span className="font-mono">{c.score ?? "Insufficient information"}</span></div>
                <div className="mt-2 h-1.5 bg-line" aria-hidden><div className="h-1.5 bg-gold" style={{ width: `${c.score ?? 0}%` }} /></div>
                <p className="mt-1 text-caption text-ivory-50">{c.answered} of {c.total} answered</p>
              </li>
            ))}
          </ul>
        </section>
        <section className="lg:col-span-5" aria-labelledby="strengths">
          <h2 id="strengths" className="font-display text-h2 font-bold">Commercial strengths</h2>
          {strengths.length ? <ul className="mt-6 space-y-3">{strengths.map((s) => <li key={s.key} className="border-l-2 border-gold pl-3"><span className="block text-caption text-ivory-70">{s.prompt}</span>{s.answerLabel}</li>)}</ul>
            : <p className="mt-6 text-ivory-70">No area scored 80 or above yet. That is common at award stage.</p>}
        </section>
      </Container>

      <section className="surface-light bg-ivory text-black">
        <Container className="py-16">
          <Eyebrow tone="bronze">Prioritized improvements</Eyebrow>
          <h2 className="mt-3 font-display text-[2rem] font-bold">Identified gaps, highest impact first</h2>
          <ol className="mt-8 border-t border-black/15">
            {r.priorities.map((p, i) => (
              <li key={p.key} className="grid gap-3 border-b border-black/15 py-5 md:grid-cols-12">
                <span className="font-mono text-bronze md:col-span-1">{String(i + 1).padStart(2, "0")}</span>
                <div className="md:col-span-6"><p className="font-semibold">{p.recommendation}</p><p className="mt-1 text-caption text-black/70">Evidence: you answered &ldquo;{p.answerLabel}&rdquo; to &ldquo;{p.prompt}&rdquo; (score {p.score}).</p></div>
                <div className="text-caption md:col-span-5">{p.services.map((slug) => { const s = services.find((x) => x.slug === slug); return s ? <Link key={slug} href={`/marketplace/${slug}`} className="mr-4 inline-flex items-center gap-1 text-bronze underline-offset-4 hover:underline">{s.name}</Link> : null; })}</div>
              </li>
            ))}
            {r.priorities.length === 0 && <li className="py-5 text-black/70">No gaps identified in the areas you answered.</li>}
          </ol>
          {roadmap.length > 0 && (
            <>
              <h3 className="mt-14 font-display text-h2 font-bold">Proposed 90-day focus</h3>
              <div className="mt-6 grid gap-px border border-black/15 bg-black/15 md:grid-cols-3">
                {roadmap.map((w) => <div key={w.window} className="bg-ivory p-5"><p className="label text-bronze">{w.window}</p><ul className="mt-3 space-y-2 text-caption">{w.items.map((it) => <li key={it.key}>{it.recommendation}</li>)}</ul></div>)}
              </div>
            </>
          )}
        </Container>
      </section>

      <Container className="grid gap-16 py-16 lg:grid-cols-12">
        <section className="lg:col-span-7" aria-labelledby="recs">
          <h2 id="recs" className="font-display text-h2 font-bold">Recommended services</h2>
          <p className="mt-2 text-caption text-ivory-70">Drawn only from your highest-impact gaps, at most four. Not padded to increase scope.</p>
          {recs.length ? (
            <>
              <ul className="mt-6 border-t border-line">{recs.map((s) => <li key={s.slug}><Link href={`/marketplace/${s.slug}`} className="flex items-baseline justify-between gap-6 border-b border-line py-4 hover:text-gold-light"><span><span className="font-semibold">{s.name}</span><span className="block text-caption text-ivory-70">{s.summary}</span></span><span className="shrink-0 text-caption">From {formatPrice(s.starting_price_cents)}</span></Link></li>)}</ul>
              <p className="mt-4 text-caption text-ivory-70">Estimated investment if you did all of these: from {formatPrice(investment)}, before scoping. Many companies start with one.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row"><ButtonLink href="/apply">Apply for a reviewed assessment <Arrow /></ButtonLink><ButtonLink href={`/marketplace?recommended=${recSlugs.join(",")}`} variant="secondary">See in marketplace</ButtonLink></div>
            </>
          ) : <p className="mt-6 text-ivory-70">No services recommended from your answers.</p>}
        </section>
        <section className="lg:col-span-5" aria-labelledby="limits">
          <h2 id="limits" className="font-display text-h2 font-bold">Assumptions and limitations</h2>
          <ul className="mt-6 space-y-3 text-caption text-ivory-70">
            <li>{fw.methodologyNote}</li>
            <li>Scores reflect self-reported answers only. No public information was reviewed.</li>
            <li>Items answered &ldquo;Not sure&rdquo; are excluded from scores and listed as missing information.</li>
            <li>Prices are starting prices; scope and price are confirmed in a written proposal.</li>
          </ul>
          {r.missing.length > 0 && <><p className="label mt-8 text-ivory-70">Missing information</p><ul className="mt-3 space-y-1 text-caption">{r.missing.map((m) => <li key={m.key}>{m.prompt}</li>)}</ul></>}
        </section>
      </Container>
    </article>
  );
}
