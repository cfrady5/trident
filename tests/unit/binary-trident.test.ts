import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TIERS } from "@/components/hero/binary-trident/atlas";
import { CONTROLS, DEFAULT_PRESET, PRESETS, deviceScale, presetParams } from "@/components/hero/binary-trident/config";
import { fbm, noise2, rng } from "@/components/hero/binary-trident/random";

describe("binary trident hero", () => {
  it("is deterministic for a given seed", () => {
    const a = rng(41), b = rng(41), c = rng(42);
    const seqA = Array.from({ length: 50 }, a), seqB = Array.from({ length: 50 }, b), seqC = Array.from({ length: 50 }, c);
    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
    expect(noise2(1.3, 2.7, 5)).toBe(noise2(1.3, 2.7, 5));
    for (const v of [...seqA, fbm(0.4, 9.1, 3)]) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });

  it("uses only approved palette colors", () => {
    const css = readFileSync(path.resolve("src/app/globals.css"), "utf8").toLowerCase();
    const approved = ["bronze", "gold-deep", "gold", "gold-light", "ivory"].map((k) => css.match(new RegExp(`--color-${k}:\\s*(#[0-9a-f]{6})`))?.[1]);
    for (const color of TIERS) expect(approved).toContain(color.toLowerCase());
  });

  it("defines four presets within the tuning ranges", () => {
    expect(Object.keys(PRESETS)).toHaveLength(4);
    expect(PRESETS[DEFAULT_PRESET]).toBeDefined();
    for (const key of Object.keys(PRESETS) as (keyof typeof PRESETS)[]) {
      const p = presetParams(key);
      for (const c of CONTROLS) {
        const v = p[c.key] as number;
        expect(v, `${key}.${c.key}`).toBeGreaterThanOrEqual(c.min);
        expect(v, `${key}.${c.key}`).toBeLessThanOrEqual(c.max);
      }
    }
  });

  it("reduces work on small screens", () => {
    expect(deviceScale(390).particles).toBeLessThan(deviceScale(1440).particles);
    expect(deviceScale(390).dprCap).toBeLessThanOrEqual(2);
  });
});
