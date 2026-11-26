/**
 * Binary Trident hero: tunable parameters and presets.
 *
 * Every visual decision the renderer makes is driven by these values so they
 * can be tuned (dev panel at /dev/hero-lab) without touching rendering code.
 * Geometry parameters (count, spacing, density, dispersion, scale, seed)
 * trigger a particle rebuild; everything else applies live.
 */

export type FormationMode = "converge" | "streams";

export interface TridentParams {
  /** Deterministic seed: same seed, same composition. */
  seed: number;
  /** Target number of binary characters forming the mark (desktop). */
  particleCount: number;
  /** Character size multiplier relative to the mark's average spacing. */
  charSize: number;
  /** Minimum spacing between characters, relative to average spacing (0.4–1.2). */
  charSpacing: number;
  /** 0 = even density, 1 = strong dense/sparse regions. */
  densityVariation: number;
  /** 0 = flat, 1 = strong depth (size, opacity and parallax by depth). */
  depthRange: number;
  /** Share of characters dispersed beyond the silhouette edge (0–0.6). */
  dispersion: number;
  /** Formation speed multiplier (1 = brief timing: 0.8s → 3.2s). */
  formationSpeed: number;
  /** Ambient motion amount (drift, sway, edge events, streams). */
  ambientMovement: number;
  /** Character 0↔1 switches per character per second. */
  switchFrequency: number;
  /** Highlight glow strength (0 = none). */
  glowIntensity: number;
  /** Palette bias: −1 toward Bronze/Gold Deep, +1 toward Gold Light/Ivory. */
  paletteBias: number;
  /** Cursor displacement + illumination strength (desktop, fine pointers). */
  cursorInfluence: number;
  /** Binary landscape density (0 = off). */
  landscapeDensity: number;
  /** Landscape wave motion. */
  landscapeMovement: number;
  /** Camera perspective strength (landscape depth + mark sway). */
  perspective: number;
  /** Mark scale within its layout slot. */
  tridentScale: number;
  /** Horizontal data stream intensity (0–1). */
  streams: number;
  /** How characters assemble: radial convergence or horizontal streams. */
  formationMode: FormationMode;
  /** Particles rising from the landscape into the mark (per second). */
  riseRate: number;
}

export const GEOMETRY_KEYS: (keyof TridentParams)[] = ["seed", "particleCount", "charSpacing", "densityVariation", "dispersion", "tridentScale"];

export const PRESETS = {
  "binary-sculpture": {
    label: "01 · Binary Sculpture",
    description: "Dense, sophisticated construction with strong geometric definition and subtle depth.",
    params: {
      seed: 11, particleCount: 5200, charSize: 1.32, charSpacing: 0.82, densityVariation: 0.2, depthRange: 0.45, dispersion: 0.06,
      formationSpeed: 1, ambientMovement: 0.35, switchFrequency: 0.18, glowIntensity: 0.35, paletteBias: 0, cursorInfluence: 0.7,
      landscapeDensity: 0.7, landscapeMovement: 0.5, perspective: 0.6, tridentScale: 1, streams: 0.25, formationMode: "converge", riseRate: 6,
    },
  },
  "digital-dispersion": {
    label: "02 · Digital Dispersion",
    description: "Organic characters dispersing from the edges, after the digital portrait references.",
    params: {
      seed: 23, particleCount: 4200, charSize: 1.42, charSpacing: 0.72, densityVariation: 0.85, depthRange: 0.8, dispersion: 0.38,
      formationSpeed: 0.9, ambientMovement: 0.75, switchFrequency: 0.3, glowIntensity: 0.3, paletteBias: -0.1, cursorInfluence: 1,
      landscapeDensity: 0.8, landscapeMovement: 0.8, perspective: 0.7, tridentScale: 1, streams: 0.15, formationMode: "converge", riseRate: 12,
    },
  },
  "data-convergence": {
    label: "03 · Data Convergence",
    description: "Fine horizontal binary streams converging into the official silhouette.",
    params: {
      seed: 37, particleCount: 4800, charSize: 1.35, charSpacing: 0.78, densityVariation: 0.4, depthRange: 0.5, dispersion: 0.12,
      formationSpeed: 1, ambientMovement: 0.55, switchFrequency: 0.25, glowIntensity: 0.35, paletteBias: 0.05, cursorInfluence: 0.8,
      landscapeDensity: 0.5, landscapeMovement: 0.5, perspective: 0.5, tridentScale: 1, streams: 1, formationMode: "streams", riseRate: 4,
    },
  },
  "living-intelligence": {
    label: "04 · Living Intelligence",
    description: "Sculptural density, continuous mutation, localized dispersion and dimensional movement.",
    params: {
      seed: 41, particleCount: 4600, charSize: 1.4, charSpacing: 0.78, densityVariation: 0.55, depthRange: 0.65, dispersion: 0.2,
      formationSpeed: 1, ambientMovement: 0.6, switchFrequency: 0.28, glowIntensity: 0.4, paletteBias: 0.05, cursorInfluence: 0.9,
      landscapeDensity: 0.75, landscapeMovement: 0.65, perspective: 0.65, tridentScale: 1, streams: 0.55, formationMode: "converge", riseRate: 9,
    },
  },
} as const satisfies Record<string, { label: string; description: string; params: TridentParams }>;

export type PresetKey = keyof typeof PRESETS;
export const DEFAULT_PRESET: PresetKey = "living-intelligence";

export function presetParams(key: PresetKey): TridentParams {
  return { ...PRESETS[key].params };
}

/** Device-aware scaling so phones and low-power devices get fewer particles. */
export function deviceScale(viewportWidth: number): { particles: number; landscape: number; dprCap: number } {
  const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 4 : 4;
  const lowPower = cores <= 4 ? 0.75 : 1;
  if (viewportWidth < 640) return { particles: 0.42 * lowPower, landscape: 0.45, dprCap: 1.75 };
  if (viewportWidth < 1024) return { particles: 0.7 * lowPower, landscape: 0.7, dprCap: 2 };
  return { particles: lowPower, landscape: 1, dprCap: 2 };
}

/** Slider definitions for the dev tuning panel. */
export const CONTROLS: { key: keyof TridentParams; label: string; min: number; max: number; step: number }[] = [
  { key: "particleCount", label: "Particle count", min: 1500, max: 12000, step: 100 },
  { key: "charSize", label: "Character size", min: 0.6, max: 2.2, step: 0.01 },
  { key: "charSpacing", label: "Character spacing", min: 0.35, max: 1.2, step: 0.01 },
  { key: "densityVariation", label: "Density variation", min: 0, max: 1, step: 0.01 },
  { key: "depthRange", label: "Depth range", min: 0, max: 1, step: 0.01 },
  { key: "dispersion", label: "Dispersion", min: 0, max: 0.6, step: 0.01 },
  { key: "formationSpeed", label: "Formation speed", min: 0.4, max: 2.5, step: 0.05 },
  { key: "ambientMovement", label: "Ambient movement", min: 0, max: 1.5, step: 0.01 },
  { key: "switchFrequency", label: "Switching frequency", min: 0, max: 2, step: 0.01 },
  { key: "glowIntensity", label: "Glow intensity", min: 0, max: 1, step: 0.01 },
  { key: "paletteBias", label: "Gold distribution", min: -1, max: 1, step: 0.01 },
  { key: "cursorInfluence", label: "Cursor influence", min: 0, max: 2, step: 0.01 },
  { key: "streams", label: "Data streams", min: 0, max: 1, step: 0.01 },
  { key: "riseRate", label: "Rising particles /s", min: 0, max: 30, step: 1 },
  { key: "landscapeDensity", label: "Landscape density", min: 0, max: 1.5, step: 0.01 },
  { key: "landscapeMovement", label: "Landscape movement", min: 0, max: 1.5, step: 0.01 },
  { key: "perspective", label: "Camera perspective", min: 0, max: 1.5, step: 0.01 },
  { key: "tridentScale", label: "Trident scale", min: 0.6, max: 1.3, step: 0.01 },
  { key: "seed", label: "Seed", min: 1, max: 99, step: 1 },
];
