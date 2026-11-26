import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

const control =
  "w-full rounded-[2px] border bg-black/40 px-3 py-2.5 text-body text-ivory placeholder:text-ivory-50 transition-colors focus:border-gold-light focus:outline-none disabled:opacity-60";

export function Field({ id, label, help, error, required, children, className }: { id: string; label: string; help?: ReactNode; error?: string | null; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-caption font-medium text-ivory">
        {label}
        {required ? <span className="text-gold" aria-hidden> *</span> : <span className="ml-1.5 text-ivory-50">(optional)</span>}
      </label>
      {help && <p id={`${id}-help`} className="text-caption text-ivory-70">{help}</p>}
      {children}
      {error && <p id={`${id}-error`} className="text-caption text-danger">{error}</p>}
    </div>
  );
}

export function describedBy(id: string, help?: unknown, error?: unknown) {
  return [help ? `${id}-help` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
}

export function Input({ invalid, className, ...props }: ComponentProps<"input"> & { invalid?: boolean }) {
  return <input aria-invalid={invalid || undefined} className={cn(control, invalid ? "border-danger" : "border-ivory/20", "h-11", className)} {...props} />;
}

export function Textarea({ invalid, className, ...props }: ComponentProps<"textarea"> & { invalid?: boolean }) {
  return <textarea aria-invalid={invalid || undefined} className={cn(control, invalid ? "border-danger" : "border-ivory/20", "min-h-28 resize-y", className)} {...props} />;
}

export function Select({ invalid, className, children, ...props }: ComponentProps<"select"> & { invalid?: boolean }) {
  return (
    <select aria-invalid={invalid || undefined} className={cn(control, invalid ? "border-danger" : "border-ivory/20", "h-11 appearance-none bg-[length:12px] bg-[right_12px_center] bg-no-repeat pr-9", className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' fill='none' stroke='%23ADAAA4' stroke-width='1.5'%3E%3Cpath d='M2 4l4 4 4-4'/%3E%3C/svg%3E\")" }} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({ label, id, ...props }: ComponentProps<"input"> & { label: ReactNode; id: string }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-caption text-ivory">
      <input type="checkbox" id={id} className="mt-0.5 h-4 w-4 shrink-0 accent-[#E6A73B]" {...props} />
      <span>{label}</span>
    </label>
  );
}
