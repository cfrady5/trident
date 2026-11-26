import type { ReactNode } from "react";
import { Container, Eyebrow } from "../ui/primitives";
import { cn } from "../ui/cn";

/** Editorial section: eyebrow + headline in a left rail, content on the right. */
export function Section({ eyebrow, title, intro, children, tone = "black", id, className }: { eyebrow?: string; title?: ReactNode; intro?: ReactNode; children?: ReactNode; tone?: "black" | "carbon" | "ivory"; id?: string; className?: string }) {
  const bg = { black: "bg-black text-ivory", carbon: "bg-carbon text-ivory", ivory: "surface-light bg-ivory text-black" }[tone];
  return (
    <section id={id} className={cn(bg, "py-20 md:py-28", className)}>
      <Container>
        {(eyebrow || title) && (
          <div className="grid gap-6 md:grid-cols-12">
            <div className="md:col-span-7">
              {eyebrow && <Eyebrow tone={tone === "ivory" ? "bronze" : "gold"}>{eyebrow}</Eyebrow>}
              {title && <h2 className="mt-4 font-display text-[2rem] font-bold leading-[1.05] tracking-[-0.015em] md:text-h1">{title}</h2>}
            </div>
            {intro && <div className={cn("text-body-l md:col-span-5 md:pt-8", tone === "ivory" ? "text-black/70" : "text-ivory-70")}>{intro}</div>}
          </div>
        )}
        {children && <div className={cn(eyebrow || title ? "mt-14" : undefined)}>{children}</div>}
      </Container>
    </section>
  );
}
