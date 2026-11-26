"use client";

import { useState } from "react";
import { BinaryTridentHero, PRESETS, DEFAULT_PRESET, type PresetKey } from "@/components/hero/binary-trident";
import { cn } from "@/components/ui/cn";

export function HeroLab({ initial }: { initial?: string }) {
  const keys = Object.keys(PRESETS) as PresetKey[];
  const [preset, setPreset] = useState<PresetKey>(keys.includes(initial as PresetKey) ? (initial as PresetKey) : DEFAULT_PRESET);
  return (
    <>
      <div className="border-b border-line bg-carbon">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-2 px-5 py-3 font-mono text-[12px] sm:px-8 lg:px-12">
          <span className="mr-3 text-ivory-70">Hero lab · development only</span>
          {keys.map((k) => (
            <button key={k} type="button" onClick={() => { setPreset(k); history.replaceState(null, "", `?preset=${k}`); }} aria-pressed={preset === k}
              className={cn("border px-3 py-1.5", preset === k ? "border-gold text-gold-light" : "border-line text-ivory hover:border-gold")}>
              {PRESETS[k].label}
            </button>
          ))}
          <span className="basis-full pt-1 text-ivory-70">{PRESETS[preset].description}</span>
        </div>
      </div>
      <BinaryTridentHero key={preset} preset={preset} tuning />
    </>
  );
}
