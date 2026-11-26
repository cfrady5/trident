"use client";

export function PrintButton({ label = "Print or save as PDF" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="text-caption text-gold-light underline-offset-4 hover:underline print:hidden">
      {label}
    </button>
  );
}
