"use client";

import { useState } from "react";
import { CONTROLS, PRESETS, type PresetKey, type TridentParams } from "./config";

/** Development-only tuning controls. Never rendered in production. */
export function TuningPanel({ params, onChange, onReplay }: { params: TridentParams; onChange: (p: TridentParams) => void; onReplay: () => void }) {
  const [open, setOpen] = useState(false);
  if (process.env.NODE_ENV === "production") return null;
  const set = (k: keyof TridentParams, v: number | string) => onChange({ ...params, [k]: v });
  return (
    <aside className="fixed bottom-4 right-4 z-50 w-[300px] border border-line bg-carbon/95 font-mono text-[11px] text-ivory shadow-2xl backdrop-blur" aria-label="Hero tuning (development)">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <span className="text-gold-light">Hero tuning · dev only</span>
        <button type="button" onClick={() => setOpen(!open)} className="text-ivory-70 hover:text-ivory">{open ? "Hide" : "Show"}</button>
      </div>
      {open && (
        <div className="max-h-[70vh] space-y-2 overflow-y-auto p-3">
          <div className="flex flex-wrap gap-1">
            {(Object.keys(PRESETS) as PresetKey[]).map((k) => (
              <button key={k} type="button" onClick={() => onChange({ ...PRESETS[k].params })} className="border border-line px-2 py-1 hover:border-gold">{PRESETS[k].label.split(" · ")[0]}</button>
            ))}
            <button type="button" onClick={onReplay} className="ml-auto border border-gold px-2 py-1 text-gold-light">Replay</button>
          </div>
          <label className="flex items-center justify-between gap-2">
            <span>Formation</span>
            <select value={params.formationMode} onChange={(e) => set("formationMode", e.target.value)} className="bg-black px-1 py-0.5">
              <option value="converge">Converge</option>
              <option value="streams">Streams</option>
            </select>
          </label>
          {CONTROLS.map((c) => (
            <label key={c.key} className="block">
              <span className="flex justify-between"><span>{c.label}</span><span className="text-ivory-70">{String(params[c.key])}</span></span>
              <input type="range" min={c.min} max={c.max} step={c.step} value={Number(params[c.key])} onChange={(e) => set(c.key, Number(e.target.value))} className="w-full accent-[var(--color-gold)]" />
            </label>
          ))}
          <button type="button" onClick={() => navigator.clipboard?.writeText(JSON.stringify(params))} className="w-full border border-line py-1 hover:border-gold">Copy parameters</button>
        </div>
      )}
    </aside>
  );
}
