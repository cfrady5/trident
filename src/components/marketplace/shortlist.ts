"use client";

import { useCallback, useSyncExternalStore } from "react";

const KEY = "trident.shortlist.v1";
const EVENT = "trident-shortlist";
const EMPTY = "[]";

/** Raw string snapshot keeps useSyncExternalStore referentially stable. */
function snapshot(): string {
  try {
    return localStorage.getItem(KEY) ?? EMPTY;
  } catch {
    return EMPTY;
  }
}

function parse(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 12) : [];
  } catch {
    return [];
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

/** Engagement shortlist kept in this browser (a per-viewer convenience, not a record). */
export function useShortlist() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => EMPTY);
  const items = parse(raw);
  const write = useCallback((next: string[]) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable: the shortlist simply won't persist */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  const toggle = useCallback((slug: string) => {
    const current = parse(snapshot());
    write(current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug]);
  }, [write]);
  const clear = useCallback(() => write([]), [write]);
  return { items, toggle, clear, has: (slug: string) => items.includes(slug) };
}
