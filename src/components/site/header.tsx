"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "../brand/logo";
import { ButtonLink } from "../ui/button";
import { cn } from "../ui/cn";
import { nav } from "@/content/site";

export function Header({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  // The menu belongs to the page it was opened on, so navigating closes it without an effect.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-black/90 backdrop-blur-sm">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:bg-gold-light focus:px-3 focus:py-2 focus:text-black">Skip to content</a>
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="Trident home">
          <Logo variant="mark-gold" width={22} priority />
          <span className="label hidden border-l border-line pl-3 text-ivory-70 lg:inline">Beyond the Award.</span>
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-7 md:flex">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className={cn("text-caption transition-colors hover:text-ivory", pathname.startsWith(n.href) ? "text-ivory" : "text-ivory-70")} aria-current={pathname.startsWith(n.href) ? "page" : undefined}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-4 md:flex">
          <Link href={signedIn ? "/portal" : "/login"} className="text-caption text-ivory-70 hover:text-ivory">{signedIn ? "Portal" : "Sign in"}</Link>
          <ButtonLink href="/assessment" size="sm">Assess readiness</ButtonLink>
        </div>
        <button type="button" className="flex h-10 w-10 items-center justify-center md:hidden" aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpenOn(open ? null : pathname)}>
          <svg width="20" height="20" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            {open ? <path d="M4 4l12 12M16 4L4 16" /> : <path d="M3 6h14M3 10h14M3 14h14" />}
          </svg>
        </button>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-line bg-black px-5 pb-6 pt-2 md:hidden">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="block border-b border-line py-3 text-body">{n.label}</Link>
          ))}
          <Link href={signedIn ? "/portal" : "/login"} className="block border-b border-line py-3 text-body text-ivory-70">{signedIn ? "Portal" : "Sign in"}</Link>
          <ButtonLink href="/assessment" className="mt-5 w-full">Assess your commercial readiness</ButtonLink>
        </nav>
      )}
    </header>
  );
}
