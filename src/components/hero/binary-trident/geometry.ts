/**
 * Particle target generation from the official Trident mark.
 *
 * The silhouette is never drawn. The supplied mark artwork (alpha channel) is
 * rasterized offscreen as an invisible mask; its luminance supplies the
 * metallic shading that the characters reproduce through palette and opacity.
 * Today the source is the official raster mark (brand kit v1.0 has no vector
 * masters); pass the SVG master's URL instead when it is supplied.
 *
 * All randomness is seeded, so a given seed always yields the same composition.
 */
import type { TridentParams } from "./config";
import { clamp, fbm, rng } from "./random";

export const MARK_SRC = "/brand/mark-gold.png";
export const MARK_ASPECT = 370 / 453; // width / height of the official mark

export interface MaskData {
  w: number;
  h: number;
  alpha: Float32Array; // 0..1
  lum: Float32Array; // 0..1, normalized to the brightest pixel
  dist: Float32Array; // inside: distance (px) to the nearest outside pixel
  inside: Int32Array; // indices of inside pixels
}

/** Rasterize the mark into an offscreen mask at a fixed sample resolution. */
export function buildMask(img: HTMLImageElement, sampleWidth = 300): MaskData {
  const w = sampleWidth;
  const h = Math.round(sampleWidth / MARK_ASPECT);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(img, 0, 0, w, h);
  const px = g.getImageData(0, 0, w, h).data;
  const alpha = new Float32Array(w * h);
  const lum = new Float32Array(w * h);
  let maxL = 0;
  for (let i = 0; i < w * h; i++) {
    alpha[i] = px[i * 4 + 3]! / 255;
    const l = (0.2126 * px[i * 4]! + 0.7152 * px[i * 4 + 1]! + 0.0722 * px[i * 4 + 2]!) / 255;
    lum[i] = l;
    if (alpha[i]! > 0.5 && l > maxL) maxL = l;
  }
  for (let i = 0; i < w * h; i++) lum[i] = maxL ? lum[i]! / maxL : 0;

  // Two-pass chamfer distance transform (inside pixels → distance to edge).
  const INF = 1e6;
  const dist = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) dist[i] = alpha[i]! > 0.5 ? INF : 0;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : dist[y * w + x]!);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!dist[i]) continue;
    dist[i] = Math.min(dist[i]!, at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.414, at(x + 1, y - 1) + 1.414);
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x;
    if (!dist[i]) continue;
    dist[i] = Math.min(dist[i]!, at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.414, at(x - 1, y + 1) + 1.414);
  }
  const ins: number[] = [];
  for (let i = 0; i < w * h; i++) if (alpha[i]! > 0.5) ins.push(i);
  return { w, h, alpha, lum, dist, inside: Int32Array.from(ins) };
}

/** Particle targets. Coordinates are normalized to the mark box (0..1). */
export interface Targets {
  count: number;
  x: Float32Array; y: Float32Array;
  lum: Float32Array; edge: Float32Array;
  nx: Float32Array; ny: Float32Array; // outward normal at the nearest edge
  z: Float32Array; size: Float32Array; alpha: Float32Array; phase: Float32Array;
  dust: Uint8Array; ivory: Uint8Array; ch: Uint8Array; prong: Uint8Array;
  /** Average spacing between core characters, as a fraction of mark width. */
  spacing: number;
  edgeIndices: Int32Array;
}

function sampleBilinear(arr: Float32Array, m: MaskData, x: number, y: number): number {
  const xi = Math.max(0, Math.min(m.w - 2, Math.floor(x))), yi = Math.max(0, Math.min(m.h - 2, Math.floor(y)));
  const fx = clamp(x - xi), fy = clamp(y - yi);
  const i = yi * m.w + xi;
  return arr[i]! * (1 - fx) * (1 - fy) + arr[i + 1]! * fx * (1 - fy) + arr[i + m.w]! * (1 - fx) * fy + arr[i + m.w + 1]! * fx * fy;
}

export function generateTargets(m: MaskData, p: TridentParams, countScale: number): Targets {
  const r = rng(p.seed * 7919 + 13);
  const core = Math.max(400, Math.round(p.particleCount * countScale));
  const dustCount = Math.round(core * p.dispersion);
  const total = core + dustCount;
  const T: Targets = {
    count: 0,
    x: new Float32Array(total), y: new Float32Array(total), lum: new Float32Array(total), edge: new Float32Array(total),
    nx: new Float32Array(total), ny: new Float32Array(total), z: new Float32Array(total), size: new Float32Array(total),
    alpha: new Float32Array(total), phase: new Float32Array(total), dust: new Uint8Array(total), ivory: new Uint8Array(total),
    ch: new Uint8Array(total), prong: new Uint8Array(total), spacing: 0, edgeIndices: new Int32Array(0),
  };

  // Average spacing (sample px) for the requested core count.
  const sPx = Math.sqrt(m.inside.length / core);
  T.spacing = sPx / m.w;
  const nScale = 1 / (m.w * 0.16); // density-noise frequency
  const edgeBand = sPx * 2.2;

  // Spatial hash for minimum-distance rejection.
  const cellSize = Math.max(1, sPx * p.charSpacing);
  const gw = Math.ceil(m.w / cellSize) + 2, gh = Math.ceil(m.h / cellSize) + 2;
  const grid = new Map<number, number[]>();
  const tooClose = (x: number, y: number, minD: number) => {
    const gx = Math.floor(x / cellSize), gy = Math.floor(y / cellSize);
    for (let yy = gy - 1; yy <= gy + 1; yy++) for (let xx = gx - 1; xx <= gx + 1; xx++) {
      const bucket = grid.get(yy * gw + xx);
      if (!bucket) continue;
      for (const j of bucket) {
        const dx = T.x[j]! - x, dy = T.y[j]! - y;
        if (dx * dx + dy * dy < minD * minD) return true;
      }
    }
    return false;
  };
  void gh;

  const normalAt = (x: number, y: number): [number, number] => {
    const e = 1.5;
    const gx = sampleBilinear(m.alpha, m, x + e, y) - sampleBilinear(m.alpha, m, x - e, y);
    const gy = sampleBilinear(m.alpha, m, x, y + e) - sampleBilinear(m.alpha, m, x, y - e);
    const len = Math.hypot(gx, gy) || 1;
    return [-gx / len, -gy / len];
  };

  // Core characters: inside the silhouette.
  let n = 0;
  const maxAttempts = core * 30;
  for (let a = 0; a < maxAttempts && n < core; a++) {
    const idx = m.inside[Math.floor(r() * m.inside.length)]!;
    const x = (idx % m.w) + r() - 0.5, y = Math.floor(idx / m.w) + r() - 0.5;
    const d = m.dist[idx]!;
    const edge = clamp(1 - d / edgeBand);
    // Density field: dense/sparse regions, slightly denser toward edges for definition.
    const field = fbm(x * nScale, y * nScale, p.seed);
    const w = (1 - p.densityVariation) + p.densityVariation * clamp(field * 1.6 - 0.25 + edge * 0.45);
    if (r() > w) continue;
    const minD = sPx * p.charSpacing * (1.15 - 0.3 * w) * (1 - edge * 0.15);
    if (tooClose(x, y, minD)) continue;
    const [nx, ny] = normalAt(x, y);
    T.x[n] = x; T.y[n] = y; T.edge[n] = edge; T.nx[n] = nx; T.ny[n] = ny;
    T.lum[n] = sampleBilinear(m.lum, m, x, y);
    T.z[n] = clamp((fbm(x * nScale * 1.7 + 50, y * nScale * 1.7, p.seed + 9) - 0.5) * 2 * 0.8 + (r() - 0.5) * 0.4, -1, 1);
    T.size[n] = (0.8 + r() * 0.34 + (1 - w) * 0.12) * (r() < 0.06 ? 1.45 : 1);
    T.alpha[n] = 0.7 + r() * 0.3;
    T.phase[n] = r() * Math.PI * 2;
    T.ivory[n] = r() < 0.07 ? 1 : 0;
    T.ch[n] = r() < 0.5 ? 0 : 1;
    const key = Math.floor(y / cellSize) * gw + Math.floor(x / cellSize);
    const bucket = grid.get(key);
    if (bucket) bucket.push(n); else grid.set(key, [n]);
    n++;
  }
  const coreN = n;

  // Dispersed characters: drifting away from the edges, fainter and smaller.
  const edgePool: number[] = [];
  for (let i = 0; i < coreN; i++) if (T.edge[i]! > 0.6) edgePool.push(i);
  for (let k = 0; k < dustCount && edgePool.length; k++) {
    const src = edgePool[Math.floor(r() * edgePool.length)]!;
    const away = sPx * (0.8 + r() ** 2.2 * 16 * (0.4 + p.dispersion));
    const tang = (r() - 0.5) * sPx * 3;
    const nx = T.nx[src]!, ny = T.ny[src]!;
    T.x[n] = T.x[src]! + nx * away - ny * tang;
    T.y[n] = T.y[src]! + ny * away + nx * tang;
    T.nx[n] = nx; T.ny[n] = ny; T.edge[n] = 1;
    T.lum[n] = T.lum[src]! * (0.6 + r() * 0.3);
    T.z[n] = (r() - 0.5) * 2;
    T.size[n] = 0.5 + r() * 0.5;
    T.alpha[n] = 0.25 + r() * 0.45 * (1 - away / (sPx * 18));
    T.phase[n] = r() * Math.PI * 2;
    T.dust[n] = 1;
    T.ch[n] = r() < 0.5 ? 0 : 1;
    n++;
  }

  // Normalize to the mark box and classify prongs (for staggered assembly).
  const edges: number[] = [];
  for (let i = 0; i < n; i++) {
    T.x[i] = T.x[i]! / m.w;
    T.y[i] = T.y[i]! / m.h;
    const x = T.x[i]!;
    T.prong[i] = x < 0.36 ? 0 : x > 0.64 ? 2 : 1;
    if (!T.dust[i] && T.edge[i]! > 0.55) edges.push(i);
  }
  T.count = n;
  T.edgeIndices = Int32Array.from(edges);
  return T;
}
