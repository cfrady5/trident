/**
 * Binary Trident engine: simulation (animation.ts concerns) + Canvas 2D
 * rendering. Framework-free so it can be driven by the React component, the
 * dev lab and tests alike.
 *
 * Timeline (ms, divided by formationSpeed):
 *   A    0– 800  dispersed characters drift in
 *   B  800–2200  staggered convergence by prong (centre, left, right)
 *   C 2200–3200  formation completes; one restrained illumination pass
 *   D    3200+   ambient: switching, regional brightness, edge dispersion,
 *                horizontal streams, risers, illumination waves, dimension
 *
 * Everything is a function of (seed, elapsed time) plus the cursor spring, so
 * a given seed and time always produce the same frame.
 */
import { CELL_H, CELL_W, FONT_PX, GLOW_PAD, TIER, type Atlas } from "./atlas";
import type { TridentParams } from "./config";
import { MARK_ASPECT, type Targets } from "./geometry";
import { clamp, easeInOutCubic, easeOutCubic, noise2, rng } from "./random";

export interface Box { x: number; y: number; w: number; h: number }
export interface Layout {
  width: number; height: number; // CSS px of the canvas
  mark: Box; // where the mark sits (CSS px)
  landTop: number; landBottom: number; // landscape band (CSS px)
  landFadeFrom: number; landFadeTo: number; // x range over which the landscape fades in (left side stays clean)
  compact: boolean; // phones: fewer, larger characters
}

const T_A = 800, T_B = 2200, T_C = 3200;

function hashI(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}
const smoothstep = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

export class TridentEngine {
  private ctx: CanvasRenderingContext2D;
  private T: Targets;
  private p: TridentParams;
  private atlas: Atlas;
  private layout!: Layout;
  private dpr = 1;
  // Per-particle animation state.
  private sx!: Float32Array; private sy!: Float32Array; // dispersed start (mark units)
  private cx!: Float32Array; private cy!: Float32Array; // bezier control
  private delay!: Float32Array; private dur!: Float32Array;
  private dispX!: Float32Array; private dispY!: Float32Array; private dispVX!: Float32Array; private dispVY!: Float32Array; // cursor spring
  private fromLand!: Uint8Array;
  // Cursor (CSS px; NaN when absent) and smoothed parallax.
  private pointer = { x: NaN, y: NaN, active: false };
  private par = { x: 0, y: 0 };
  private light = 0;
  /** Elapsed animation time (ms). */
  time = 0;

  constructor(canvas: HTMLCanvasElement, targets: Targets, params: TridentParams, atlas: Atlas) {
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    this.T = targets; this.p = params; this.atlas = atlas;
    this.initState();
  }

  setTargets(t: Targets) { this.T = t; this.initState(); }
  setParams(p: TridentParams) { const modeChanged = p.formationMode !== this.p.formationMode; this.p = p; if (modeChanged) this.initState(); }
  setAtlas(a: Atlas) { this.atlas = a; }
  setLayout(l: Layout, dpr: number) { this.layout = l; this.dpr = dpr; }
  setPointer(x: number, y: number, active: boolean) { this.pointer.x = x; this.pointer.y = y; this.pointer.active = active; }
  replay() { this.time = 0; this.dispX.fill(0); this.dispY.fill(0); this.dispVX.fill(0); this.dispVY.fill(0); }

  /** Mark aspect in mark units (height = 1). */
  private get aw() { return MARK_ASPECT; }

  private initState() {
    const T = this.T, n = T.count, p = this.p;
    const r = rng(p.seed * 31 + 7);
    this.sx = new Float32Array(n); this.sy = new Float32Array(n);
    this.cx = new Float32Array(n); this.cy = new Float32Array(n);
    this.delay = new Float32Array(n); this.dur = new Float32Array(n);
    this.dispX = new Float32Array(n); this.dispY = new Float32Array(n);
    this.dispVX = new Float32Array(n); this.dispVY = new Float32Array(n);
    this.fromLand = new Uint8Array(n);
    const aw = this.aw;
    const gauss = () => (r() + r() + r() - 1.5) / 1.5;
    const prongOff = [150, 0, 260];
    for (let i = 0; i < n; i++) {
      const tx = T.x[i]! * aw, ty = T.y[i]!;
      if (p.formationMode === "streams") {
        // Characters travel along horizontal lines (one line per row band) from the side they are nearest.
        const band = Math.round(ty / (T.spacing * 2.2));
        const side = band % 2 === 0 ? -1 : 1;
        // Left-side streams start just outside the mark so they never cross the copy.
        this.sx[i] = side < 0 ? -aw * (0.3 + r() * 0.35) : aw * (1.3 + r() * 0.9);
        this.sy[i] = ty + (r() - 0.5) * 0.01;
        this.cx[i] = (this.sx[i]! + tx) / 2; this.cy[i] = this.sy[i]!;
        this.delay[i] = T_A - 200 + Math.abs(this.sx[i]! - tx) * 260 + (hashI(band, p.seed) * 500) + r() * 120;
        this.dur[i] = 900 + r() * 300;
      } else {
        const land = r() < 0.22;
        this.fromLand[i] = land ? 1 : 0;
        if (land) {
          // Rise out of the landscape below the mark.
          this.sx[i] = tx + gauss() * 0.25;
          this.sy[i] = 1.12 + r() * 0.18;
        } else {
          const gx = gauss() * aw * 1.05;
          // Keep the dispersed cloud off the copy column: reflect far-left starts to the right.
          this.sx[i] = aw / 2 + (gx < -aw * 0.85 ? -gx : gx);
          this.sy[i] = 0.5 + gauss() * 0.62;
        }
        // Curved approach: control point offset perpendicular to the path.
        const mx = (this.sx[i]! + tx) / 2, my = (this.sy[i]! + ty) / 2;
        const dx = tx - this.sx[i]!, dy = ty - this.sy[i]!;
        const bend = (r() - 0.5) * 0.5;
        this.cx[i] = mx - dy * bend; this.cy[i] = my + dx * bend;
        this.delay[i] = T_A + prongOff[T.prong[i]!]! + (1 - Math.min(1, ty)) * 380 + r() * 330 + (T.dust[i] ? 200 : 0);
        this.dur[i] = 820 + r() * 380;
      }
    }
  }

  /** Advance the clock and draw a frame. dt in ms. */
  frame(dt: number) {
    this.time += dt;
    this.stepCursor(dt);
    this.draw();
  }

  /** Draw at an absolute time without advancing springs (reduced motion, captures). */
  drawAt(time: number) { this.time = time; this.draw(); }

  private stepCursor(dt: number) {
    const p = this.p, L = this.layout, T = this.T, n = T.count;
    const k = Math.min(dt, 50) / 16.67;
    const active = this.pointer.active && p.cursorInfluence > 0;
    // Parallax target from cursor position relative to the mark centre.
    const tx = active ? clamp((this.pointer.x - (L.mark.x + L.mark.w / 2)) / (L.width * 0.5), -1, 1) : 0;
    const ty = active ? clamp((this.pointer.y - (L.mark.y + L.mark.h / 2)) / (L.height * 0.5), -1, 1) : 0;
    this.par.x += (tx - this.par.x) * 0.06 * k;
    this.par.y += (ty - this.par.y) * 0.06 * k;
    this.light += ((active ? 1 : 0) - this.light) * 0.08 * k;
    const unit = L.mark.h;
    const R = 0.14 * unit;
    const px = this.pointer.x, py = this.pointer.y;
    const push = 0.022 * p.cursorInfluence * unit;
    const aw = this.aw;
    for (let i = 0; i < n; i++) {
      let fx = 0, fy = 0;
      if (active) {
        const x = L.mark.x + T.x[i]! * aw * unit, y = L.mark.y + T.y[i]! * unit;
        const dx = x - px, dy = y - py;
        const d2 = dx * dx + dy * dy;
        if (d2 < R * R) {
          // Gentle radial push with a slight swirl, scaled per character so the field stays organic.
          const d = Math.sqrt(d2) || 1, f = (1 - d / R) ** 2 * (0.55 + 0.9 * hashI(i, 11));
          fx = ((dx - dy * 0.35) / d) * f * push; fy = ((dy + dx * 0.35) / d) * f * push;
        }
      }
      // Spring toward the pushed offset, then back to rest: smooth displacement and return.
      const ax = (fx - this.dispX[i]!) * 0.09 - this.dispVX[i]! * 0.28;
      const ay = (fy - this.dispY[i]!) * 0.09 - this.dispVY[i]! * 0.28;
      this.dispVX[i] = this.dispVX[i]! + ax * k; this.dispVY[i] = this.dispVY[i]! + ay * k;
      this.dispX[i] = this.dispX[i]! + this.dispVX[i]! * k; this.dispY[i] = this.dispY[i]! + this.dispVY[i]! * k;
    }
  }

  private draw() {
    const ctx = this.ctx, L = this.layout, p = this.p, T = this.T, A = this.atlas;
    if (!L) return;
    const dpr = this.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, L.width, L.height);

    const t = this.time * p.formationSpeed; // formation clock
    const ta = this.time; // ambient clock (real time)
    const amb = p.ambientMovement;
    const unit = L.mark.h, aw = this.aw;
    const ox = L.mark.x, oy = L.mark.y;
    const ambientOn = clamp((t - T_C) / 1200); // ambient effects ease in after formation

    this.drawLandscape(ta, t);

    // Dimensional movement: slow yaw around the vertical axis + cursor parallax.
    const yaw = Math.sin(ta * 0.00013) * 0.1 * p.perspective * amb * ambientOn;
    const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
    const depthU = 0.07 * p.depthRange;
    const parX = this.par.x * 10, parY = this.par.y * 6;

    // Cursor illumination.
    const lightR = 0.16 * unit;
    const plx = this.pointer.x, ply = this.pointer.y, lightAmt = this.light * p.cursorInfluence;

    // Illumination waves: formation pass (2200–3400) and ambient passes every 7 s.
    const waves: { front: number; amt: number }[] = [];
    if (t > T_B - 200 && t < T_C + 600) waves.push({ front: 1.15 - ((t - (T_B - 200)) / 1600) * 1.45, amt: 0.55 });
    if (ta > 5000) {
      const per = 7000, k = Math.floor((ta - 5000) / per), u = (ta - 5000 - k * per) / 2100;
      if (u < 1) waves.push({ front: 1.15 - u * 1.45, amt: 0.4 * (0.6 + 0.4 * amb) });
    }

    // Edge dispersion events: a cluster of edge characters lifts off and returns.
    const events: { x: number; y: number; nx: number; ny: number; env: number; r: number }[] = [];
    if (T.edgeIndices.length && amb > 0) {
      const period = 2600 / Math.max(0.3, amb), evDur = 2400, t0 = T_C + 600;
      if (ta > t0) {
        const kNow = Math.floor((ta - t0) / period);
        for (let k = Math.max(0, kNow - 1); k <= kNow; k++) {
          const u = (ta - t0 - k * period) / evDur;
          if (u < 0 || u > 1) continue;
          const er = rng(p.seed * 977 + k);
          const ei = T.edgeIndices[Math.floor(er() * T.edgeIndices.length)]!;
          const env = u < 0.32 ? easeOutCubic(u / 0.32) : 1 - easeInOutCubic((u - 0.32) / 0.68);
          events.push({ x: T.x[ei]! * aw, y: T.y[ei]!, nx: T.nx[ei]!, ny: T.ny[ei]!, env: env * ambientOn, r: 0.05 + er() * 0.05 });
        }
      }
    }

    // Horizontal data streams through the mark (ambient).
    const streams = this.streamState(ta, ambientOn);

    const charBase = T.spacing * aw * unit * p.charSize * (L.compact ? 1.08 : 1);
    const glyphScale = charBase / FONT_PX;
    const gw = CELL_W * glyphScale, gh = CELL_H * glyphScale;
    const as = A.scale;
    const glowCells: number[] = [];

    const bias = p.paletteBias * 0.22;
    const swF = p.switchFrequency * 0.001;
    const regAmt = 0.32 * Math.min(1, 0.4 + amb);

    for (let i = 0, n = T.count; i < n; i++) {
      const tx = T.x[i]! * aw, ty = T.y[i]!;
      const isDust = T.dust[i] === 1;
      // --- formation path
      const u = clamp((t - this.delay[i]!) / this.dur[i]!);
      let x: number, y: number, fade: number;
      if (u >= 1) { x = tx; y = ty; fade = 1; }
      else {
        // Stage A drift before departure.
        const drift = Math.min(t, this.delay[i]!) * 0.00003;
        const s0x = this.sx[i]! + Math.sin(T.phase[i]!) * drift, s0y = this.sy[i]! - (this.fromLand[i] ? drift * 2 : Math.cos(T.phase[i]!) * drift);
        const e = easeInOutCubic(u), m = 1 - e;
        x = m * m * s0x + 2 * m * e * this.cx[i]! + e * e * tx;
        y = m * m * s0y + 2 * m * e * this.cy[i]! + e * e * ty;
        const appear = clamp(t / T_A) * 0.42;
        fade = appear + (1 - appear) * easeOutCubic(u);
        if (u <= 0 && this.fromLand[i]) fade *= 0.6;
      }
      // --- ambient drift
      const ph = T.phase[i]!;
      const da = (isDust ? 0.007 : 0.0016) * amb * ambientOn;
      x += Math.sin(ta * 0.0011 + ph) * da;
      y += Math.cos(ta * 0.0009 + ph * 1.3) * da;

      // --- edge dispersion events
      let evA = 0;
      for (let e = 0; e < events.length; e++) {
        const ev = events[e]!;
        const dx = tx - ev.x, dy = ty - ev.y, d = Math.sqrt(dx * dx + dy * dy);
        if (d > ev.r) continue;
        const f = (1 - d / ev.r) ** 1.4 * ev.env * T.edge[i]!;
        const away = f * (0.05 + 0.05 * p.dispersion) * (0.6 + 0.8 * hashI(i, 3));
        x += (T.nx[i]! * 0.8 + Math.cos(ph) * 0.45) * away;
        y += (T.ny[i]! * 0.8 + Math.sin(ph) * 0.45) * away - away * 0.3;
        evA = Math.max(evA, f);
      }

      // --- depth / yaw
      const z = T.z[i]! * p.depthRange;
      const rx = (x - aw / 2) * cosY + z * depthU * sinY * 6;
      let sxp = ox + (aw / 2 + rx) * unit + z * parX + this.dispX[i]!;
      let syp = oy + y * unit + z * parY + this.dispY[i]!;
      const depthScale = 1 + z * 0.22;

      // --- brightness
      const ln = clamp((T.lum[i]! - 0.44) / 0.42) ** 1.15;
      let b = ln;
      b += (noise2(tx * 3.2 + ta * 0.00011, ty * 3.2 - ta * 0.00007, p.seed) - 0.5) * regAmt * (0.5 + 0.5 * ambientOn);
      b += z * 0.08;
      let boost = 0;
      for (let w = 0; w < waves.length; w++) {
        const wv = waves[w]!;
        const front = wv.front + (T.prong[i] === 1 ? -0.04 : 0.03);
        const d = (ty - front) / 0.075;
        boost += Math.exp(-d * d) * wv.amt;
      }
      for (let s = 0; s < streams.length; s++) {
        const st = streams[s]!;
        const dy = (ty - st.y) / 0.012, dx = (tx - st.head) / 0.06;
        if (dx > -3 && dx < 1) boost += Math.exp(-dy * dy) * (dx < 0 ? Math.exp(dx) : 1 - dx) * 0.5 * st.a;
      }
      if (lightAmt > 0.01) {
        const dx = sxp - plx, dy = syp - ply, d2 = (dx * dx + dy * dy) / (lightR * lightR);
        if (d2 < 1) boost += (1 - d2) ** 2 * 0.6 * lightAmt;
      }
      boost *= p.glowIntensity * 1.6 + 0.2;
      b += boost + bias - evA * 0.15;
      let tier: number = b < 0.22 ? TIER.BRONZE : b < 0.48 ? TIER.GOLD_DEEP : b < 0.76 ? TIER.GOLD : TIER.GOLD_LIGHT;
      if (T.ivory[i] && b > 0.82) tier = TIER.IVORY;
      if (isDust && tier > TIER.GOLD) tier = TIER.GOLD;

      // --- character (deterministic switching)
      const slot = Math.floor(ta * swF * (0.5 + hashI(i, 7)) + ph);
      const ch = swF > 0 ? (hashI(i, slot) < 0.5 ? 0 : 1) : T.ch[i]!;

      // --- opacity
      let a = T.alpha[i]! * fade * (0.4 + 0.6 * clamp(b + 0.1)) * (z < 0 ? 1 + z * 0.3 : 1) * (1 - evA * 0.35);
      if (isDust) a *= 0.85;
      a = clamp(a);
      if (a < 0.02) continue;

      const sz = T.size[i]! * depthScale;
      const w = gw * sz, h = gh * sz;
      sxp -= w / 2; syp -= h / 2;
      ctx.globalAlpha = a;
      ctx.drawImage(A.glyphs, ch * CELL_W * as, tier * CELL_H * as, CELL_W * as, CELL_H * as, sxp, syp, w, h);
      if (p.glowIntensity > 0 && (boost > 0.18 || (tier >= TIER.GOLD_LIGHT && b > 0.98))) {
        glowCells.push(sxp, syp, w, h, ch, tier, clamp((boost * 0.8 + (b - 0.9)) * p.glowIntensity) * a);
      }
    }

    // Restrained glow pass (additive).
    if (glowCells.length) {
      ctx.globalCompositeOperation = "lighter";
      const gwc = CELL_W + GLOW_PAD * 2, ghc = CELL_H + GLOW_PAD * 2;
      for (let g = 0; g < glowCells.length; g += 7) {
        const x = glowCells[g]!, y = glowCells[g + 1]!, w = glowCells[g + 2]!, h = glowCells[g + 3]!;
        const ga = glowCells[g + 6]! * 0.5;
        if (ga < 0.02) continue;
        const padX = (w / CELL_W) * GLOW_PAD, padY = (h / CELL_H) * GLOW_PAD;
        ctx.globalAlpha = ga;
        ctx.drawImage(A.glows, glowCells[g + 4]! * gwc * as, glowCells[g + 5]! * ghc * as, gwc * as, ghc * as, x - padX, y - padY, w + padX * 2, h + padY * 2);
      }
      ctx.globalCompositeOperation = "source-over";
    }

    this.drawStreams(streams, glyphScale, unit);
    this.drawRisers(ta, t, glyphScale);
    ctx.globalAlpha = 1;
  }

  /** Horizontal data streams: a few lines of characters crossing the mark. */
  private streamState(ta: number, ambientOn: number) {
    const p = this.p;
    const out: { y: number; head: number; len: number; a: number; k: number; dir: number }[] = [];
    if (p.streams <= 0 || ambientOn <= 0) return out;
    const aw = this.aw;
    const interval = 2400 / (0.4 + p.streams), life = 3200;
    const t0 = T_C - 400;
    const kNow = Math.floor((ta - t0) / interval);
    for (let k = Math.max(0, kNow - 2); k <= kNow; k++) {
      const u = (ta - t0 - k * interval) / life;
      if (u < 0 || u > 1) continue;
      const r = rng(p.seed * 131 + k * 17);
      const dir = r() < 0.5 ? 1 : -1;
      const y = 0.12 + r() * 0.8;
      const span = aw * 1.7;
      const headU = easeInOutCubic(u);
      const head = dir > 0 ? -aw * 0.35 + headU * span : aw * 1.35 - headU * span;
      out.push({ y, head, len: 0.18 + r() * 0.25, a: Math.sin(Math.PI * u) * ambientOn * p.streams, k, dir });
    }
    return out;
  }

  private drawStreams(streams: ReturnType<TridentEngine["streamState"]>, glyphScale: number, unit: number) {
    if (!streams.length) return;
    const ctx = this.ctx, L = this.layout, A = this.atlas, as = A.scale, aw = this.aw, T = this.T;
    const step = T.spacing * aw * 1.25;
    const gs = glyphScale * 0.82;
    const w = CELL_W * gs, h = CELL_H * gs;
    for (const s of streams) {
      const count = Math.floor(s.len / step);
      for (let j = 0; j < count; j++) {
        const xx = s.head - s.dir * j * step;
        const fall = 1 - j / count;
        // Streams live inside the mark's footprint; they fade out beyond it.
        const inside = smoothstep(-0.12, 0.04, xx) * smoothstep(aw + 0.12, aw - 0.04, xx);
        const a = s.a * fall * 0.75 * inside;
        if (a < 0.03) continue;
        const ch = hashI(s.k * 1000 + j, Math.floor(this.time * 0.006)) < 0.5 ? 0 : 1;
        const tier = j < 2 ? TIER.GOLD_LIGHT : j < count * 0.4 ? TIER.GOLD : TIER.GOLD_DEEP;
        ctx.globalAlpha = a;
        ctx.drawImage(A.glyphs, ch * CELL_W * as, tier * CELL_H * as, CELL_W * as, CELL_H * as, L.mark.x + xx * unit - w / 2, L.mark.y + s.y * unit - h / 2, w, h);
      }
    }
  }

  /** Characters rising from the landscape into the base of the mark. */
  private drawRisers(ta: number, t: number, glyphScale: number) {
    const p = this.p;
    if (p.riseRate <= 0) return;
    const ctx = this.ctx, L = this.layout, A = this.atlas, as = A.scale, aw = this.aw;
    const life = 2600, per = 1000 / p.riseRate;
    const kNow = Math.floor(ta / per), kMin = Math.max(0, Math.floor((ta - life) / per));
    const unit = L.mark.h;
    const gs = glyphScale * 0.8;
    const w = CELL_W * gs, h = CELL_H * gs;
    const startY = Math.max(L.landTop + (L.landBottom - L.landTop) * 0.35, L.mark.y + unit * 1.02);
    const on = clamp(t / T_A);
    for (let k = kMin; k <= kNow; k++) {
      const u = (ta - k * per) / life;
      if (u < 0 || u > 1) continue;
      const r = rng(p.seed * 53 + k);
      const xr = 0.08 + r() * 0.84;
      const x = L.mark.x + (xr * aw) * unit + Math.sin(u * 3 + k) * 4;
      const endY = L.mark.y + unit * (0.72 + r() * 0.25);
      const y = startY + (endY - startY) * easeOutCubic(u);
      const a = Math.sin(Math.PI * u) * 0.7 * on;
      const ch = hashI(k, Math.floor(u * 6)) < 0.5 ? 0 : 1;
      ctx.globalAlpha = a;
      ctx.drawImage(A.glyphs, ch * CELL_W * as, (u > 0.6 ? TIER.GOLD : TIER.GOLD_DEEP) * CELL_H * as, CELL_W * as, CELL_H * as, x - w / 2, y - h / 2, w, h);
    }
  }

  /** Binary-character landscape: a perspective plane of 0/1 rolling in slow waves. */
  private drawLandscape(ta: number, t: number) {
    const p = this.p, L = this.layout, ctx = this.ctx, A = this.atlas, as = A.scale;
    if (p.landscapeDensity <= 0) return;
    const rows = Math.max(6, Math.round(24 * p.landscapeDensity * (L.compact ? 0.7 : 1)));
    const horizon = L.landTop;
    const bandH = L.landBottom - horizon;
    const vpX = L.mark.x + L.mark.w / 2;
    const persp = 0.6 + p.perspective * 2.4;
    const pMin = 1 / (1 + persp);
    const baseSpacing = (L.compact ? 15 : 17) * (1.1 - Math.min(0.5, p.landscapeDensity * 0.3));
    const mov = p.landscapeMovement;
    const on = 0.35 + 0.65 * clamp(t / T_B);
    const charH = (L.compact ? 12 : 14);
    for (let r = rows - 1; r >= 0; r--) {
      const d = r / (rows - 1); // 0 near, 1 far
      const pr = 1 / (1 + d * persp); // perspective scale
      const yRow = horizon + bandH * ((pr - pMin) / (1 - pMin)) * 0.92 + 6;
      const spacing = baseSpacing * pr * 1.25;
      const scroll = (ta * 0.012 * mov) % spacing; // slow lateral flow
      const cMin = Math.floor((0 - vpX) / spacing) - 1, cMax = Math.ceil((L.width - vpX) / spacing) + 1;
      const rowAlpha = (0.22 + 0.5 * pr) * smoothstep(0, 0.25, 1 - d) * on;
      const gsz = (charH * (0.45 + 0.75 * pr)) / FONT_PX;
      const w = CELL_W * gsz, h = CELL_H * gsz;
      const amp = bandH * (L.compact ? 0.18 : 0.3) * (0.35 + 0.65 * pr);
      for (let c = cMin; c <= cMax; c++) {
        const x = vpX + c * spacing - scroll;
        if (x < -w || x > L.width + w) continue;
        const nx = (x - vpX) / L.width;
        const wave = noise2(nx * 6 + 40, d * 3.2 - ta * 0.00012 * mov, p.seed + 5) - 0.5
          + Math.sin(nx * 9 + d * 5 - ta * 0.0007 * mov) * 0.18;
        const y = yRow - wave * amp - Math.max(0, 0.18 - Math.abs(nx) * 0.6) * amp * 0.8;
        // Left side clean, fades to black at the outer edges and bottom.
        const fadeX = smoothstep(L.landFadeFrom, L.landFadeTo, x) * smoothstep(0, L.width * 0.04, L.width - x);
        const fadeB = smoothstep(L.landBottom + 2, L.landBottom - bandH * 0.18, y);
        const centre = 1 + Math.max(0, 0.6 - Math.abs(x - vpX) / (L.mark.w * 1.2)) * 0.9;
        const a = rowAlpha * fadeX * fadeB * (0.55 + wave * 0.9) * centre;
        if (a < 0.03) continue;
        const crest = wave > 0.2 || centre > 1.35;
        const tier = crest ? (wave > 0.32 ? TIER.GOLD : TIER.GOLD_DEEP) : (hashI(c, r) < 0.3 ? TIER.GOLD_DEEP : TIER.BRONZE);
        const ch = hashI(c * 31 + r, Math.floor(ta * 0.0005 + hashI(r, c) * 4)) < 0.5 ? 0 : 1;
        ctx.globalAlpha = clamp(a);
        ctx.drawImage(A.glyphs, ch * CELL_W * as, tier * CELL_H * as, CELL_W * as, CELL_H * as, x - w / 2, y - h / 2, w, h);
      }
    }
    // Fade the plane into black at the very bottom.
    ctx.globalAlpha = 1;
    const g = ctx.createLinearGradient(0, L.landBottom - bandH * 0.25, 0, L.landBottom);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = g;
    ctx.fillRect(0, L.landBottom - bandH * 0.25, L.width, L.height - L.landBottom + bandH * 0.25);
  }
}

