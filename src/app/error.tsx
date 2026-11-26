"use client";

import Link from "next/link";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="mx-auto flex min-h-[70vh] max-w-[640px] flex-col justify-center px-5 py-24">
      <p className="label text-gold">Something went wrong</p>
      <h1 className="mt-4 font-display text-[2.5rem] font-bold leading-tight">We couldn&apos;t load this page.</h1>
      <p className="mt-4 text-ivory-70">Nothing you entered has been lost. Try again, or come back in a few minutes.{error.digest && <span className="mt-2 block font-mono text-caption text-ivory-50">Reference {error.digest}</span>}</p>
      <div className="mt-8 flex gap-6 text-caption"><button type="button" onClick={reset} className="text-gold-light">Try again</button><Link href="/" className="text-gold-light">Home</Link></div>
    </main>
  );
}
