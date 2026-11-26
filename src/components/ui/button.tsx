import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "dark" | "outline-dark";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-sans font-semibold whitespace-nowrap transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none rounded-[2px]";
const variants: Record<Variant, string> = {
  // Black on Gold Light: 14.77:1 (AAA)
  primary: "bg-gold-light text-black hover:bg-gold active:bg-gold-deep",
  secondary: "border border-ivory/30 text-ivory hover:border-ivory hover:bg-ivory/5",
  ghost: "text-ivory hover:text-gold-light",
  // For Ivory surfaces: Ivory on Black
  dark: "bg-black text-ivory hover:bg-carbon",
  "outline-dark": "border border-black/30 text-black hover:border-black",
};
const sizes: Record<Size, string> = { sm: "h-8 px-3 text-caption", md: "h-11 px-5 text-body", lg: "h-13 px-6 text-body" };

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cn(base, variants[variant], sizes[size], extra);
}

export function Button({ variant = "primary", size = "md", className, ...props }: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({ href, variant = "primary", size = "md", className, children, ...rest }: { href: string; variant?: Variant; size?: Size; className?: string; children: ReactNode } & Omit<ComponentProps<typeof Link>, "href">) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}

export function Arrow() {
  return (
    <svg aria-hidden width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square">
      <path d="M2 7h10M8 3l4 4-4 4" />
    </svg>
  );
}
