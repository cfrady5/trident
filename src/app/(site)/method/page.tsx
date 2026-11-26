import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/site/page-header";
import { Section } from "@/components/site/section";
import { ButtonLink, Arrow } from "@/components/ui/button";
import { pillars, qualitySteps } from "@/content/site";

export const metadata: Metadata = { title: "Method", description: "Position, Build, Activate: three prongs, always in this order." };

export default function MethodPage() {
  return (
    <>
      <PageHeader eyebrow="The method" title="Position. Build. Activate." intro="Three prongs, always in this order. Each answers a question the company can't skip, and each ends in a finished deliverable." />
      {pillars.map((p, i) => (
        <Section key={p.key} tone={i % 2 ? "carbon" : "black"} eyebrow={`${p.number} · ${p.question}`} title={<>{p.name}. <span className="text-gold">{p.line}</span></>} intro={p.intro}>
          <div className="grid gap-10 md:grid-cols-3">
            <div>
              <p className="label text-ivory-70">The problem</p>
              <p className="mt-3">{p.problem}</p>
            </div>
            <div>
              <p className="label text-ivory-70">Core services</p>
              <ul className="mt-3 space-y-2">{p.services.map((s) => <li key={s} className="flex gap-2"><span className="text-gold" aria-hidden>—</span>{s}</li>)}</ul>
            </div>
            <div>
              <p className="label text-ivory-70">Deliverables</p>
              <ul className="mt-3 space-y-2">{p.deliverables.map((s) => <li key={s} className="flex gap-2"><span className="text-gold" aria-hidden>—</span>{s}</li>)}</ul>
              <Link href={`/services/${p.key}`} className="mt-6 inline-flex items-center gap-2 text-gold-light hover:text-gold">Explore {p.name} services <Arrow /></Link>
            </div>
          </div>
        </Section>
      ))}
      <Section eyebrow="Quality standard" title="Make → Render → Review → Fix → Ship" intro="A visible quality system. Every client knows exactly how their work is checked.">
        <ol className="grid gap-px border border-line bg-line sm:grid-cols-5">
          {qualitySteps.map((q) => (
            <li key={q.n} className="bg-black p-5"><p className="label text-gold">{q.n}</p><p className="mt-2 font-display text-h2 font-bold">{q.name}</p><p className="mt-1 text-caption text-ivory-70">{q.text}</p></li>
          ))}
        </ol>
        <dl className="mt-12 border-t border-line">
          {[["L1", "Internal draft", "Rendered and self-reviewed against the brand checklist. Never sent to a client."], ["L2", "Client review", "Peer-reviewed, with one consolidated feedback round and changes tracked."], ["L3", "Release", "Final files in every agreed format, contrast and compliance checks passed, source files included."]].map(([l, n, t]) => (
            <div key={l} className="grid grid-cols-12 gap-4 border-b border-line py-4"><dt className="col-span-2 font-mono text-gold sm:col-span-1">{l}</dt><dd className="col-span-10 font-semibold sm:col-span-3">{n}</dd><dd className="col-span-12 text-ivory-70 sm:col-span-8">{t}</dd></div>
          ))}
        </dl>
        <div className="mt-12"><ButtonLink href="/assessment">Assess your commercial readiness <Arrow /></ButtonLink></div>
      </Section>
    </>
  );
}
