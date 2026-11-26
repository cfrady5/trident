import type { ReactNode } from "react";
import { Container, Eyebrow } from "../ui/primitives";

export function PageHeader({ eyebrow, title, intro, children }: { eyebrow: string; title: ReactNode; intro?: ReactNode; children?: ReactNode }) {
  return (
    <section className="border-b border-line">
      <Container className="py-16 md:py-24">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-5 max-w-4xl font-display text-[2.5rem] font-bold leading-[1.02] tracking-[-0.02em] md:text-[3.75rem]">{title}</h1>
        {intro && <div className="mt-6 max-w-2xl text-body-l text-ivory-70">{intro}</div>}
        {children && <div className="mt-8">{children}</div>}
      </Container>
    </section>
  );
}
