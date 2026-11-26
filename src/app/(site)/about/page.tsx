import type { Metadata } from "next";
import { PageHeader } from "@/components/site/page-header";
import { Section } from "@/components/site/section";
import { Arrow, ButtonLink } from "@/components/ui/button";
import { site } from "@/content/site";

export const metadata: Metadata = { title: "About", description: "Trident is an independent technology commercialization and creative agency." };

// PROVISIONAL: independence language pending the outside-activity review (BRAND.md).
const values = [
  ["01", "Proof over promise", "Every claim is specific and checkable. We show the work."],
  ["02", "Independent by design", "No program affiliation, no platform loyalty. Advice serves the client's market only."],
  ["03", "Commercial first", "We judge work by whether a buyer understands it and acts."],
  ["04", "Craft at speed", "Fixed scopes, clear dates, finished files. Quality is a system, not a mood."],
];

const personality = [
  ["Precision-driven", "Specific. Real numbers, named outcomes, exact status language."],
  ["Sophisticated", "Confident and restrained. Short sentences."],
  ["Ambitious", "Forward-looking. We describe the market a client can win."],
  ["Technical", "Fluent in the technology and the program world, and able to translate both."],
  ["Entrepreneurial", "Commercial and action-oriented. Every piece points to a next step."],
];

export default function AboutPage() {
  return (
    <>
      <PageHeader eyebrow="About Trident" title="Turning breakthrough technology into market opportunity." intro="We transform emerging technologies into commercially competitive brands, digital experiences and growth strategies." />
      <Section eyebrow="Brand story" title="Make sure breakthrough technology doesn't stop at the award.">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="space-y-5 text-body-l text-ivory-70 lg:col-span-7">
            <p>Every year, small technology companies win competitive government innovation awards and earn awardable status on government marketplaces. The award proves the technology works. It does not build a brand, a buyer pipeline or a story that a commercial customer understands.</p>
            <p>Trident takes technology that has already passed a demanding review and gives it the positioning, presence and demand engine it needs to compete in the market.</p>
          </div>
          <blockquote className="border border-line bg-carbon p-8 lg:col-span-5">
            <p className="label text-gold">Positioning</p>
            <p className="mt-4">For founders and teams whose technology has earned government validation but not yet a commercial market, Trident is the independent technology commercialization and creative agency that turns that validation into positioning, presence and demand. Unlike generalist agencies, we speak the language of both the program office and the private buyer. Unlike program-affiliated services, we are independent and platform-agnostic.</p>
          </blockquote>
        </div>
      </Section>
      <Section tone="ivory" eyebrow="What we value" title="Four working values.">
        <dl className="border-t border-black/15">
          {values.map(([n, name, text]) => (
            <div key={n} className="grid gap-2 border-b border-black/15 py-5 sm:grid-cols-12">
              <dt className="font-mono text-bronze sm:col-span-1">{n}</dt>
              <dt className="font-display text-h2 font-bold sm:col-span-4">{name}</dt>
              <dd className="text-black/75 sm:col-span-7">{text}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <Section eyebrow="How we sound" title="The expert in the room who also knows how to sell." intro="Calm, exact and commercially minded. We respect the science and we respect the buyer's time.">
        <dl className="border-t border-line">
          {personality.map(([t, d]) => (
            <div key={t} className="grid gap-2 border-b border-line py-4 sm:grid-cols-12"><dt className="font-semibold sm:col-span-4">{t}</dt><dd className="text-ivory-70 sm:col-span-8">{d}</dd></div>
          ))}
        </dl>
        <p className="mt-12 max-w-2xl text-caption text-ivory-70">{site.disclaimer} We never imply government endorsement, never describe a marketplace selection as a contract award and never use agency or program seals without written permission.</p>
        <div className="mt-10"><ButtonLink href="/contact" variant="secondary">Contact Trident <Arrow /></ButtonLink></div>
      </Section>
    </>
  );
}
