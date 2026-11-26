"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Category, Service } from "@/lib/catalog";
import { useShortlist } from "./shortlist";
import { Arrow, ButtonLink, buttonClass } from "../ui/button";
import { cn } from "../ui/cn";

const PILLAR_LABEL: Record<string, string> = { position: "Position", build: "Build", activate: "Activate", program: "Program" };
const DELIVERABLE_LABEL: Record<string, string> = {
  strategy: "Strategy", messaging: "Messaging", report: "Reports", roadmap: "Roadmaps", logo: "Logo", brand: "Brand", templates: "Templates",
  web: "Web", document: "Documents", deck: "Decks", script: "Scripts", social: "Social", email: "Email", graphics: "Graphics", campaign: "Campaigns",
};
const BUDGETS = [
  { key: "all", label: "Any budget", test: () => true },
  { key: "u2500", label: "Under $2,500", test: (c: number) => c < 250_000 },
  { key: "2500-7500", label: "$2,500 to $7,500", test: (c: number) => c >= 250_000 && c <= 750_000 },
  { key: "7500", label: "Over $7,500", test: (c: number) => c > 750_000 },
];

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
const weeks = (s: Service) => (!s.turnaround_weeks_min ? "Scoped" : s.turnaround_weeks_min === s.turnaround_weeks_max ? `${s.turnaround_weeks_min} wk` : `${s.turnaround_weeks_min}–${s.turnaround_weeks_max} wk`);

export function MarketplaceBrowser({ services, categories, recommended }: { services: Service[]; categories: Category[]; recommended: string[] }) {
  const [pillar, setPillar] = useState("all");
  const [deliverable, setDeliverable] = useState("all");
  const [budget, setBudget] = useState("all");
  const [category, setCategory] = useState("all");
  const [compare, setCompare] = useState<string[]>([]);
  const shortlist = useShortlist();

  const deliverables = useMemo(() => Array.from(new Set(services.flatMap((s) => s.deliverable_types))).sort(), [services]);
  const budgetTest = BUDGETS.find((b) => b.key === budget)!.test;
  const filtered = services.filter((s) =>
    (pillar === "all" || s.pillar === pillar) && (deliverable === "all" || s.deliverable_types.includes(deliverable)) &&
    (category === "all" || s.category_slug === category) && budgetTest(s.starting_price_cents));
  const ordered = recommended.length ? [...filtered].sort((a, b) => Number(recommended.includes(b.slug)) - Number(recommended.includes(a.slug))) : filtered;
  const comparing = compare.map((slug) => services.find((s) => s.slug === slug)!).filter(Boolean);
  const toggleCompare = (slug: string) => setCompare((c) => (c.includes(slug) ? c.filter((x) => x !== slug) : c.length >= 3 ? c : [...c, slug]));
  const reset = () => { setPillar("all"); setDeliverable("all"); setBudget("all"); setCategory("all"); };

  const select = "h-10 w-full rounded-[2px] border border-ivory/20 bg-black px-3 text-caption text-ivory focus:border-gold-light focus:outline-none";
  return (
    <div className="grid gap-10 lg:grid-cols-12">
      <aside className="lg:col-span-3" aria-label="Filters">
        <div className="space-y-5 lg:sticky lg:top-24">
          <div>
            <p className="label text-ivory-70" id="f-stage">Commercialization stage</p>
            <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-labelledby="f-stage">
              {["all", "position", "build", "activate", "program"].map((p) => (
                <button key={p} type="button" aria-pressed={pillar === p} onClick={() => setPillar(p)}
                  className={cn("h-8 rounded-[2px] border px-2.5 text-caption", pillar === p ? "border-gold-light bg-gold-light text-black" : "border-ivory/20 text-ivory-70 hover:text-ivory")}>
                  {p === "all" ? "All" : PILLAR_LABEL[p]}
                </button>
              ))}
            </div>
          </div>
          <label className="block"><span className="label text-ivory-70">Category</span>
            <select className={cn(select, "mt-2")} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="all">All categories</option>
              {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </label>
          <label className="block"><span className="label text-ivory-70">Deliverable type</span>
            <select className={cn(select, "mt-2")} value={deliverable} onChange={(e) => setDeliverable(e.target.value)}>
              <option value="all">All deliverables</option>
              {deliverables.map((d) => <option key={d} value={d}>{DELIVERABLE_LABEL[d] ?? d}</option>)}
            </select>
          </label>
          <label className="block"><span className="label text-ivory-70">Starting price</span>
            <select className={cn(select, "mt-2")} value={budget} onChange={(e) => setBudget(e.target.value)}>
              {BUDGETS.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
            </select>
          </label>
          <div className="border-t border-line pt-5">
            <p className="label text-ivory-70">Shortlist · {shortlist.items.length}</p>
            {shortlist.items.length === 0 ? (
              <p className="mt-2 text-caption text-ivory-50">Add services to build an engagement shortlist.</p>
            ) : (
              <>
                <ul className="mt-2 space-y-1 text-caption">
                  {shortlist.items.map((slug) => <li key={slug} className="flex justify-between gap-2"><span>{services.find((s) => s.slug === slug)?.name ?? slug}</span><button type="button" className="text-ivory-50 hover:text-ivory" onClick={() => shortlist.toggle(slug)} aria-label={`Remove ${slug}`}>×</button></li>)}
                </ul>
                <ButtonLink href={`/contact?type=proposal&services=${shortlist.items.join(",")}`} size="sm" className="mt-4 w-full">Request a proposal</ButtonLink>
                <Link href="/apply" className="mt-2 block text-center text-caption text-ivory-70 hover:text-ivory">or start a company application</Link>
              </>
            )}
          </div>
        </div>
      </aside>

      <div className="lg:col-span-9">
        <div className="flex items-baseline justify-between border-b border-line pb-3">
          <p className="text-caption text-ivory-70" aria-live="polite">{ordered.length} of {services.length} services</p>
          {(pillar !== "all" || deliverable !== "all" || budget !== "all" || category !== "all") && <button type="button" onClick={reset} className="text-caption text-gold-light">Clear filters</button>}
        </div>
        {ordered.length === 0 ? (
          <p className="py-16 text-center text-ivory-70">No services match these filters. <button type="button" className="text-gold-light" onClick={reset}>Clear filters</button></p>
        ) : (
          <ul>
            {ordered.map((s) => (
              <li key={s.slug} className="grid gap-3 border-b border-line py-6 sm:grid-cols-12">
                <div className="sm:col-span-7">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="label text-gold">{PILLAR_LABEL[s.pillar]}</span>
                    <span className="label text-ivory-50">· {s.category_name}</span>
                    {recommended.includes(s.slug) && <span className="label border border-gold px-1.5 text-gold-light">Recommended from your assessment</span>}
                  </div>
                  <Link href={`/marketplace/${s.slug}`} className="mt-2 block font-display text-h2 font-bold hover:text-gold-light">{s.name}</Link>
                  <p className="mt-1 text-caption text-ivory-70">{s.summary}</p>
                </div>
                <dl className="grid grid-cols-3 content-start gap-2 text-caption sm:col-span-3 sm:grid-cols-1 sm:gap-1">
                  <div><dt className="sr-only">Starting price</dt><dd className="font-semibold">From {money(s.starting_price_cents)}</dd></div>
                  <div><dt className="sr-only">Estimated timeline</dt><dd className="text-ivory-70">{weeks(s)}{!s.turnaround_confirmed && " (est.)"}</dd></div>
                  <div><dt className="sr-only">Revisions</dt><dd className="text-ivory-70">{s.included_revisions === 0 ? "No revision rounds" : `${s.included_revisions} revision ${s.included_revisions === 1 ? "round" : "rounds"}`}</dd></div>
                </dl>
                <div className="flex gap-2 sm:col-span-2 sm:flex-col sm:items-end">
                  <button type="button" aria-pressed={shortlist.has(s.slug)} onClick={() => shortlist.toggle(s.slug)} className={buttonClass(shortlist.has(s.slug) ? "primary" : "secondary", "sm")}>
                    {shortlist.has(s.slug) ? "Shortlisted" : "Shortlist"}
                  </button>
                  <label className="flex items-center gap-1.5 text-caption text-ivory-70">
                    <input type="checkbox" className="accent-[#E6A73B]" checked={compare.includes(s.slug)} disabled={!compare.includes(s.slug) && compare.length >= 3} onChange={() => toggleCompare(s.slug)} />
                    Compare
                  </label>
                </div>
              </li>
            ))}
          </ul>
        )}

        {comparing.length >= 2 && (
          <section className="mt-12 overflow-x-auto border border-line" aria-label="Service comparison">
            <div className="flex items-center justify-between border-b border-line bg-carbon px-5 py-3">
              <p className="label text-gold">Comparing {comparing.length}</p>
              <button type="button" className="text-caption text-ivory-70 hover:text-ivory" onClick={() => setCompare([])}>Clear</button>
            </div>
            <table className="w-full min-w-[640px] text-left text-caption">
              <thead><tr className="border-b border-line"><th className="w-40 p-4 font-normal text-ivory-70" scope="col"><span className="sr-only">Attribute</span></th>{comparing.map((s) => <th key={s.slug} scope="col" className="p-4 font-display text-body font-bold">{s.name}</th>)}</tr></thead>
              <tbody>
                {[
                  ["Starting price", (s: Service) => money(s.starting_price_cents)],
                  ["Timeline", (s: Service) => `${weeks(s)}${s.turnaround_confirmed ? "" : " (estimate)"}`],
                  ["Revisions", (s: Service) => String(s.included_revisions)],
                  ["Scope", (s: Service) => s.scope.join(" · ")],
                  ["Deliverables", (s: Service) => s.deliverables.map((d) => `${d.name} (${d.format})`).join(" · ")],
                  ["Prerequisites", (s: Service) => s.prerequisites.join(" · ") || "—"],
                ].map(([label, fn]) => (
                  <tr key={label as string} className="border-b border-line align-top last:border-0">
                    <th scope="row" className="p-4 font-normal text-ivory-70">{label as string}</th>
                    {comparing.map((s) => <td key={s.slug} className="p-4">{(fn as (s: Service) => string)(s)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
        {compare.length === 1 && <p className="mt-6 text-caption text-ivory-70">Select one or two more services to compare.</p>}
        <p className="mt-10 flex items-center gap-2 text-caption text-ivory-70">Not sure where to start? <Link href="/assessment" className="inline-flex items-center gap-1 text-gold-light">Take the readiness assessment <Arrow /></Link></p>
      </div>
    </div>
  );
}
