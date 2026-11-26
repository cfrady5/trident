"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../ui/cn";

export interface NavItem { href: string; label: string; phase?: number; count?: number }

export function CommandSidebar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Trident Command" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      {items.map((i) => {
        const active = i.href === "/command" ? pathname === "/command" : pathname.startsWith(i.href);
        if (i.phase) {
          return (
            <span key={i.href} className="flex shrink-0 items-center justify-between gap-3 px-3 py-1.5 text-caption text-ivory-50" title={`Arrives in Phase ${i.phase}`}>
              {i.label}<span className="font-mono text-[10px]">P{i.phase}</span>
            </span>
          );
        }
        return (
          <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined}
            className={cn("flex shrink-0 items-center justify-between gap-3 rounded-[2px] px-3 py-1.5 text-caption", active ? "bg-carbon-2 text-ivory" : "text-ivory-70 hover:bg-carbon hover:text-ivory")}>
            {i.label}
            {!!i.count && <span className="font-mono text-[11px] text-gold">{i.count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
