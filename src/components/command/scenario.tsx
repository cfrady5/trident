"use client";

import { useState } from "react";
import { DEFAULT_SCENARIO, scenario, type ScenarioInputs } from "@/lib/command/metrics";

const usd = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export function ScenarioModel() {
  const [i, setI] = useState<ScenarioInputs>(DEFAULT_SCENARIO);
  const r = scenario(i);
  const field = (k: keyof ScenarioInputs, label: string, step = 1, scale = 1) => (
    <label className="text-[13px]">{label}
      <input type="number" step={step} min={0} value={Math.round(i[k] * scale * 100) / 100} onChange={(e) => setI({ ...i, [k]: Math.max(0, Number(e.target.value) / scale) })}
        className="mt-1 h-8 w-full rounded-[2px] border border-ivory/20 bg-black px-2" />
    </label>
  );
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="grid grid-cols-2 gap-3">
        {field("clients", "Recurring clients")}
        {field("avgRetainer", "Average monthly retainer ($)", 100)}
        {field("conventionalHours", "Conventional hours / client / month")}
        {field("laborReduction", "Labor reduction (%) · aspirational", 1, 100)}
        {field("hourlyCost", "Loaded hourly labor cost ($)")}
        {field("softwarePerClient", "Variable software / client / month ($)")}
        <button type="button" onClick={() => setI(DEFAULT_SCENARIO)} className="col-span-2 justify-self-start text-[12px] text-gold-light">Reset to planning assumptions</button>
      </div>
      <dl className="grid grid-cols-2 gap-px self-start border border-line bg-line text-[13px]">
        {[
          ["Monthly revenue", usd(r.revenue)], ["Annualized revenue", usd(r.annualRevenue)],
          ["Production hours / client", r.hoursPerClient.toFixed(1)], ["Total monthly hours", r.totalHours.toFixed(0)],
          ["Labor cost", usd(r.labor)], ["Software cost", usd(r.software)],
          ["Gross profit", usd(r.gross)], ["Gross margin", `${Math.round(r.margin * 100)}%`],
          ["Labor without automation", usd(r.conventionalLabor)], ["Margin without automation", `${r.revenue > 0 ? Math.round(((r.revenue - r.conventionalLabor - r.software) / r.revenue) * 100) : 0}%`],
        ].map(([k, v]) => <div key={k} className="bg-black p-3"><dt className="text-[11px] text-ivory-70">{k}</dt><dd className="mt-1 font-mono">{v}</dd></div>)}
      </dl>
    </div>
  );
}
