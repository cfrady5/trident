import type { ReactNode } from "react";
import { cn } from "./cn";

export function Container({ children, className, wide }: { children: ReactNode; className?: string; wide?: boolean }) {
  return <div className={cn("mx-auto w-full px-5 sm:px-8", wide ? "max-w-[1440px]" : "max-w-[1240px]", className)}>{children}</div>;
}

export function Eyebrow({ children, className, tone = "gold" }: { children: ReactNode; className?: string; tone?: "gold" | "muted" | "bronze" | "black" }) {
  const color = { gold: "text-gold", muted: "text-ivory-70", bronze: "text-bronze", black: "text-black" }[tone];
  return <p className={cn("label", color, className)}>{children}</p>;
}

type Tone = "info" | "warning" | "error" | "success";
export function Notice({ tone = "info", title, children, className, light }: { tone?: Tone; title?: string; children?: ReactNode; className?: string; light?: boolean }) {
  const border = { info: "border-ivory/25", warning: "border-gold", error: "border-danger", success: "border-success" }[tone];
  const lightBorder = { info: "border-black/20", warning: "border-bronze", error: "border-danger-deep", success: "border-black/40" }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("border-l-2 py-3 pl-4 pr-3", light ? lightBorder : border, className)}>
      {title && <p className={cn("font-semibold", light ? "text-black" : "text-ivory")}>{title}</p>}
      {children && <div className={cn("text-caption", light ? "text-black/75" : "text-ivory-70", title && "mt-1")}>{children}</div>}
    </div>
  );
}

const pillTone: Record<string, string> = {
  neutral: "border-ivory/25 text-ivory-70",
  gold: "border-gold/60 text-gold-light",
  warn: "border-gold text-gold",
  danger: "border-danger/70 text-danger",
  ok: "border-success/60 text-success",
};
export function Pill({ children, tone = "neutral", className }: { children: ReactNode; tone?: keyof typeof pillTone; className?: string }) {
  return <span className={cn("label inline-flex items-center border px-1.5 py-0.5 !text-[10.5px] !tracking-[0.1em] rounded-[2px]", pillTone[tone], className)}>{children}</span>;
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="border border-dashed border-line px-6 py-10 text-center">
      <p className="font-display text-h3 font-medium">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-caption text-ivory-70">{children}</div>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function Provisional({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("label inline-block border border-gold/50 px-1.5 py-0.5 !text-[10px] text-gold", className)}>{children}</span>;
}
