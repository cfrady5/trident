"use client";

import { useShortlist } from "./shortlist";
import { buttonClass } from "../ui/button";

export function ShortlistButton({ slug, light }: { slug: string; light?: boolean }) {
  const { has, toggle } = useShortlist();
  const on = has(slug);
  return (
    <button type="button" aria-pressed={on} onClick={() => toggle(slug)} className={buttonClass(light ? "outline-dark" : "secondary", "md")}>
      {on ? "On your shortlist ✓" : "Add to shortlist"}
    </button>
  );
}
