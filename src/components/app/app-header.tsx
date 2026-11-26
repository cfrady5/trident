import Link from "next/link";
import { Logo } from "../brand/logo";

export function AppHeader({ email, area, links }: { email: string; area: string; links: { href: string; label: string }[] }) {
  return (
    <header className="border-b border-line bg-black">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-4 px-5 sm:px-8">
        <div className="flex items-center gap-4">
          <Link href="/" aria-label="Trident home"><Logo variant="mark-gold" width={20} /></Link>
          <span className="label text-ivory-70">{area}</span>
          <nav aria-label={area} className="hidden items-center gap-5 md:flex">
            {links.map((l) => <Link key={l.href} href={l.href} className="text-caption text-ivory-70 hover:text-ivory">{l.label}</Link>)}
          </nav>
        </div>
        <div className="flex items-center gap-4 text-caption">
          <span className="hidden text-ivory-70 sm:inline">{email}</span>
          <form action="/auth/signout" method="post"><button className="text-ivory-70 hover:text-ivory">Sign out</button></form>
        </div>
      </div>
    </header>
  );
}
