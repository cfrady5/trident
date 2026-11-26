import Link from "next/link";
import { ButtonLink, Arrow } from "@/components/ui/button";
import { Container, Eyebrow } from "@/components/ui/primitives";
import { HeroTrident } from "@/components/site/hero-trident";
import { Section } from "@/components/site/section";
import { audiences, engagementModels, pillars, qualitySteps, site } from "@/content/site";
import { formatPrice, listServices } from "@/lib/catalog";
import { frameworkCategories } from "@/content/readiness-framework";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const services = await listServices();
  const featured = services.filter((s) => s.is_featured && s.is_published).slice(0, 6);

  return (
    <>
      {/* Hero — owner-approved treatment (BRAND.md → Owner decisions). */}
      <section className="relative isolate overflow-hidden bg-black lg:min-h-[calc(100svh-72px)]">
        <HeroTrident />
        {/* Light shading only where the copy sits (mobile: top; desktop: left). */}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/70 via-black/30 to-transparent lg:bg-gradient-to-r lg:from-black/60 lg:via-black/10 lg:via-40% lg:to-transparent lg:to-55%" />
        <div className="relative mx-auto grid max-w-[1440px] items-center px-5 pb-[min(50vh,560px)] pt-16 sm:px-8 md:pt-24 lg:min-h-[calc(100svh-72px)] lg:grid-cols-12 lg:px-12 lg:pb-32 lg:pt-16">
          <div className="lg:col-span-6">
            <p className="flex items-center gap-3 text-[0.8rem] font-medium uppercase tracking-[0.18em] text-ivory sm:text-[0.95rem]">
              <span aria-hidden className="h-px w-7 bg-gold" />Technology commercialization &amp; creative agency
            </p>
            <h1 className="mt-8 font-display text-[3.6rem] font-semibold leading-[0.98] tracking-[-0.03em] sm:text-[5rem] lg:text-[6.25rem]">
              Beyond<br />the <span className="bg-gradient-to-br from-gold-light via-gold to-gold-deep bg-clip-text text-transparent">Award.</span>
            </h1>
            <p className="mt-7 max-w-[34rem] text-body-l text-ivory md:text-[1.4rem] md:leading-[1.45]">
              Your technology has earned validation. Now build the positioning, presence and demand it needs to compete in the market.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link href="/assessment" className="inline-flex h-14 items-center justify-center gap-3 whitespace-nowrap rounded-md bg-gradient-to-br from-gold-light via-gold to-gold-deep px-5 text-[15px] font-semibold sm:px-7 sm:text-base text-black shadow-[0_8px_30px_rgba(230,167,59,0.25)] transition-[filter] hover:brightness-110">
                Assess Your Commercial Readiness <Arrow />
              </Link>
              <Link href="/marketplace" className="inline-flex h-14 items-center justify-center whitespace-nowrap rounded-md border border-gold-light/70 px-5 text-[15px] font-semibold sm:px-7 sm:text-base text-ivory transition-colors hover:bg-gold/10">
                Explore Our Capabilities
              </Link>
            </div>
            <ul className="mt-14 grid max-w-2xl grid-cols-1 gap-6 sm:grid-cols-3" aria-label="The method">
              {pillars.map((p) => (
                <li key={p.key} className="border-l border-gold pl-5">
                  <Link href={`/services/${p.key}`} className="font-display text-[1.3rem] font-semibold hover:text-gold-light">{p.name}</Link>
                  <p className="mt-1 text-body text-ivory-70">{p.line}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Problem */}
      <Section eyebrow="The gap we close" title="Awardable is not the same as adopted.">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="space-y-5 text-body-l text-ivory-70 lg:col-span-6">
            <p>Every year, small technology companies win competitive government innovation awards and earn awardable status on government marketplaces. The award proves the technology works. It does not build a brand, a buyer pipeline or a story that a commercial customer understands.</p>
            <p>Many strong teams stall right there: validated, credentialed and invisible to the investors, primes and commercial buyers who could scale them.</p>
            <p className="text-ivory">Trident exists for what comes next. That is what <span className="text-gold">Beyond the Award.</span> means.</p>
          </div>
          <div className="border border-line bg-carbon p-8 lg:col-span-6">
            <p className="label text-gold">A</p>
            <p className="mt-2 font-display text-h2 font-bold">The award</p>
            <p className="mt-2 text-ivory-70">A competitive selection: an award, a marketplace awardable status, a prize. Proof the technology is credible. Not a contract and not an endorsement.</p>
            <div className="my-7 border-l border-dashed border-gold pl-5">
              <p className="label text-gold">The gap</p>
              <p className="mt-1">No positioning · no presence · no pipeline</p>
            </div>
            <p className="label text-gold">B</p>
            <p className="mt-2 font-display text-h2 font-bold">The market</p>
            <p className="mt-2 text-ivory-70">Buyers, partners and investors who understand the value, can find the company and have a reason to act.</p>
            <div className="gradient-gold mt-8 h-1" aria-hidden />
            <p className="mt-4 text-caption text-ivory-70">Trident&apos;s work is the line from A to B: <span className="font-semibold text-ivory">Position · Build · Activate.</span></p>
          </div>
        </div>
      </Section>

      {/* Method */}
      <Section tone="carbon" eyebrow="The method" title="Position. Build. Activate." intro="Three prongs, always in this order. Each one answers a question the company can't skip, and each ends in a finished deliverable.">
        <div className="border-t border-line">
          {pillars.map((p) => (
            <div key={p.key} className="grid gap-6 border-b border-line py-10 md:grid-cols-12">
              <div className="md:col-span-3">
                <p className="label text-gold">{p.number} · {p.question}</p>
                <h3 className="mt-3 font-display text-[2rem] font-bold leading-none">{p.name}</h3>
                <p className="mt-2 text-gold">{p.line}</p>
              </div>
              <p className="text-ivory-70 md:col-span-4">{p.problem}</p>
              <ul className="space-y-1.5 text-caption md:col-span-3">
                {p.services.map((s) => <li key={s} className="flex gap-2"><span className="text-gold" aria-hidden>—</span>{s}</li>)}
              </ul>
              <div className="md:col-span-2 md:text-right">
                <p className="label text-ivory-70">Output</p>
                <p className="mt-1 text-caption font-semibold">{p.output}</p>
                <Link href={`/services/${p.key}`} className="mt-4 inline-flex items-center gap-2 text-caption text-gold-light hover:text-gold">Explore {p.name} <Arrow /></Link>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Marketplace preview */}
      <Section tone="ivory" eyebrow="Marketplace" title="Fixed scopes. Clear prices. Clear finish lines." intro="Every product ships with editable source files and blank templates your team can reuse.">
        <div className="border-t border-black/15">
          {featured.map((s) => (
            <Link key={s.slug} href={`/marketplace/${s.slug}`} className="group grid gap-2 border-b border-black/15 py-5 sm:grid-cols-12 sm:items-baseline">
              <span className="label text-bronze sm:col-span-2">{s.pillar}</span>
              <span className="font-display text-h2 font-bold sm:col-span-4">{s.name}</span>
              <span className="text-caption text-black/70 sm:col-span-4">{s.summary}</span>
              <span className="flex items-center justify-between gap-3 font-semibold sm:col-span-2 sm:justify-end">
                <span>From {formatPrice(s.starting_price_cents)}</span>
                <span className="transition-transform group-hover:translate-x-1"><Arrow /></span>
              </span>
            </Link>
          ))}
        </div>
        <div className="mt-10"><ButtonLink href="/marketplace" variant="dark">Browse all {services.filter((s) => s.is_published).length} services <Arrow /></ButtonLink></div>
      </Section>

      {/* Readiness index */}
      <Section eyebrow="Commercial Readiness Index" title="Know where you stand before you spend." intro={<>A structured assessment across six categories. You get an overall score, a category breakdown, your three to five highest-impact gaps and the improvements that close them. Useful whether or not you work with Trident.</>}>
        <div className="grid gap-12 lg:grid-cols-12">
          <dl className="border-t border-line lg:col-span-7">
            {frameworkCategories.map((c) => (
              <div key={c.key} className="grid grid-cols-12 gap-4 border-b border-line py-4">
                <dt className="col-span-7 font-medium sm:col-span-5">{c.name}</dt>
                <dd className="col-span-5 text-right font-mono text-caption text-gold sm:col-span-2 sm:text-left">{Math.round(c.weight * 100)}%</dd>
                <dd className="col-span-12 text-caption text-ivory-70 sm:col-span-5">{c.description}</dd>
              </div>
            ))}
          </dl>
          <div className="lg:col-span-5">
            <p className="text-ivory-70">Sixteen questions, about five minutes. Answer &ldquo;Not sure&rdquo; when you don&apos;t know: missing information is reported, never scored as zero.</p>
            <p className="mt-5 border-l-2 border-gold pl-4 text-caption text-ivory-70">The index is Trident&apos;s own preliminary assessment methodology. It is not a government certification, an endorsement or a validated industry benchmark.</p>
            <ButtonLink href="/assessment" className="mt-8">Start the assessment <Arrow /></ButtonLink>
          </div>
        </div>
      </Section>

      {/* Who we serve */}
      <Section tone="carbon" eyebrow="Who we serve" title={<>Three audiences, one question: <span className="text-gold">&ldquo;We won. Now what?&rdquo;</span></>}>
        <div className="hidden grid-cols-12 gap-6 border-b border-line pb-3 md:grid">
          <p className="label col-span-4 text-ivory-70">Audience</p><p className="label col-span-4 text-ivory-70">What they need</p><p className="label col-span-4 text-ivory-70">What Trident gives them</p>
        </div>
        {audiences.map((a) => (
          <div key={a.number} className="grid gap-3 border-b border-line py-7 md:grid-cols-12 md:gap-6">
            <div className="md:col-span-4">
              <p className="font-semibold"><span className="mr-3 font-mono text-gold">{a.number}</span>{a.name}</p>
              <p className="mt-1 text-caption text-ivory-70">{a.who}</p>
            </div>
            <p className="text-ivory-70 md:col-span-4">{a.need}</p>
            <p className="md:col-span-4">{a.gives}</p>
          </div>
        ))}
        <p className="mt-8 max-w-2xl text-caption text-ivory-70">Our clients take part in public programs and marketplaces. {site.disclaimer}</p>
      </Section>

      {/* Engagement models + quality */}
      <Section eyebrow="Engagement models" title="Start with one deliverable or the whole method.">
        <div className="grid gap-px border border-line bg-line md:grid-cols-3">
          {engagementModels.map((m) => (
            <Link key={m.name} href={m.href} className="group flex flex-col bg-black p-8 transition-colors hover:bg-carbon">
              <p className="label text-gold">{m.price}</p>
              <p className="mt-4 font-display text-h2 font-bold">{m.name}</p>
              <p className="mt-3 flex-1 text-ivory-70">{m.text}</p>
              <span className="mt-6 inline-flex items-center gap-2 text-caption text-gold-light">Learn more <Arrow /></span>
            </Link>
          ))}
        </div>
        <div className="mt-20">
          <Eyebrow>Quality standard</Eyebrow>
          <p className="mt-4 max-w-2xl font-display text-[1.75rem] font-bold leading-[1.1]">Nothing ships until it has been rendered and reviewed.</p>
          <ol className="mt-8 grid gap-px border border-line bg-line sm:grid-cols-5">
            {qualitySteps.map((q, i) => (
              <li key={q.n} className={`bg-black p-5 ${i === qualitySteps.length - 1 ? "outline outline-1 -outline-offset-1 outline-gold" : ""}`}>
                <p className="label text-gold">{q.n}</p>
                <p className="mt-2 font-display text-h2 font-bold">{q.name}</p>
                <p className="mt-1 text-caption text-ivory-70">{q.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      {/* Closing CTA */}
      <section className="border-t border-line bg-black py-24 md:py-32">
        <Container className="text-center">
          <h2 className="mx-auto max-w-3xl font-display text-[2.75rem] font-bold leading-[1] tracking-[-0.02em] md:text-[4.25rem]">Innovation deserves a market.</h2>
          <p className="mx-auto mt-6 max-w-xl text-body-l text-ivory-70">{site.promise}</p>
          <div className="mt-10 flex justify-center">
            <ButtonLink href="/assessment" size="lg">Start your commercialization assessment <Arrow /></ButtonLink>
          </div>
        </Container>
      </section>
    </>
  );
}
