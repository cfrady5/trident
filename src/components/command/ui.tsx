import type { ReactNode } from "react";
import { cn } from "../ui/cn";

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
      <div>
        <h1 className="font-display text-[1.5rem] font-bold leading-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-caption text-ivory-70">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Metric({ label, value, note, href }: { label: string; value: ReactNode; note?: string; href?: string }) {
  const body = (
    <>
      <p className="label !text-[10.5px] text-ivory-70">{label}</p>
      <p className="mt-1.5 font-display text-[1.5rem] font-bold leading-none">{value}</p>
      {note && <p className="mt-1.5 text-[12px] text-ivory-50">{note}</p>}
    </>
  );
  return href ? <a href={href} className="block bg-black p-4 hover:bg-carbon">{body}</a> : <div className="bg-black p-4">{body}</div>;
}

export const NoData = () => <span className="text-[1rem] font-normal text-ivory-50">No data yet</span>;

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("overflow-x-auto border border-line", className)}><table className="w-full min-w-[720px] text-left text-[13px]">{children}</table></div>;
}
export const Th = ({ children, className }: { children?: ReactNode; className?: string }) => <th scope="col" className={cn("border-b border-line bg-carbon px-3 py-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-ivory-70", className)}>{children}</th>;
export const Td = ({ children, className }: { children?: ReactNode; className?: string }) => <td className={cn("border-b border-line px-3 py-2.5 align-top", className)}>{children}</td>;

export function Panel({ title, children, actions, className }: { title: string; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={cn("border border-line", className)}>
      <div className="flex items-center justify-between border-b border-line bg-carbon px-4 py-2.5"><h2 className="label text-ivory-70">{title}</h2>{actions}</div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export const money = (cents: number | null | undefined) => cents == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
export const pct = (v: number | null) => (v == null ? null : `${Math.round(v * 100)}%`);
export const dt = (d: Date | string | null | undefined) => (d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");
