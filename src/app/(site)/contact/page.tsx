import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/site/page-header";
import { Container } from "@/components/ui/primitives";
import { ContactForm } from "@/components/forms/contact-form";
import { listServices } from "@/lib/catalog";

export const metadata: Metadata = { title: "Contact" };
export const dynamic = "force-dynamic";

export default async function ContactPage({ searchParams }: PageProps<"/contact">) {
  const sp = await searchParams;
  const kind = sp.type === "proposal" ? "proposal_request" : "contact";
  const all = await listServices();
  const requested = typeof sp.services === "string" ? sp.services.split(",") : [];
  const chosen = all.filter((s) => s.is_published && requested.includes(s.slug));
  return (
    <>
      <PageHeader eyebrow={kind === "proposal_request" ? "Request a proposal" : "Contact"} title={kind === "proposal_request" ? "Tell us what you need. We'll confirm scope and price in writing." : "Talk to Trident."} intro="We reply within two business days." />
      <Container className="grid gap-12 py-16 lg:grid-cols-12">
        <div className="lg:col-span-7"><ContactForm kind={kind} services={chosen.map((s) => s.slug)} serviceNames={chosen.map((s) => s.name)} /></div>
        <aside className="space-y-6 text-caption text-ivory-70 lg:col-span-4 lg:col-start-9">
          <div><p className="label text-gold">Faster routes</p>
            <p className="mt-2"><Link href="/apply" className="text-gold-light">Start a company application</Link> to share your profile once and get a reviewed recommendation.</p>
            <p className="mt-2"><Link href="/assessment" className="text-gold-light">Take the readiness assessment</Link> for an instant, preliminary score.</p>
          </div>
          <div><p className="label text-gold">Email</p><p className="mt-2">[CONFIRM: public contact email]</p></div>
        </aside>
      </Container>
    </>
  );
}
