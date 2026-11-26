import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-[70vh] max-w-[640px] flex-col justify-center px-5 py-24">
      <Link href="/" aria-label="Trident home"><Logo variant="mark-gold" width={28} /></Link>
      <p className="label mt-10 text-gold">404 · Not found</p>
      <h1 className="mt-4 font-display text-[2.5rem] font-bold leading-tight">This page doesn&apos;t exist, or you don&apos;t have access to it.</h1>
      <div className="mt-8 flex gap-6 text-caption"><Link href="/" className="text-gold-light">Home</Link><Link href="/marketplace" className="text-gold-light">Marketplace</Link><Link href="/portal" className="text-gold-light">Your portal</Link></div>
    </main>
  );
}
