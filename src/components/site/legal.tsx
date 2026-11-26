import type { ReactNode } from "react";
import { Container, Eyebrow } from "../ui/primitives";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <Container className="max-w-[760px] py-16 md:py-24">
      <Eyebrow>Legal</Eyebrow>
      <h1 className="mt-5 font-display text-[2.5rem] font-bold leading-tight">{title}</h1>
      <p className="mt-3 text-caption text-ivory-70">Last updated {updated}</p>
      <div className="mt-6 border-l-2 border-gold pl-4 text-caption text-ivory-70">
        Draft prepared with the product build. It must be reviewed by qualified counsel before Trident accepts real applications. [CONFIRM: legal review, legal entity name, jurisdiction and contact address]
      </div>
      <div className="prose-trident mt-10 text-body">{children}</div>
    </Container>
  );
}
