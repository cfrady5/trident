"use client";

/**
 * Full-bleed hero background (canvas), modelled on the owner's reference:
 *  - a trident illustration built from bright binary digits with bloom:
 *    arrowhead centre prong, one-sided barbed side prongs, V-shaped base and a
 *    thick shaft that runs straight into the staff
 *  - streams of code falling around the trident
 *  - a rolling 3D field of gold dots that rises toward the staff and glows
 *    where it lands
 *  - a gold line that periodically rises across the hero, lighting the code
 *
 * Brand notes (BRAND.md → Owner decisions, Nov 26, 2026): an owner-approved
 * hero ILLUSTRATION, not the Trident logo. Homepage hero only.
 * Performance/accessibility: 30 fps cap, DPR ≤ 1.5, static glow pre-rendered,
 * bloom on a cropped layer, paused off-screen, static under reduced motion.
 */
import { useEffect, useRef } from "react";

const CYCLE_MS = 9000;
const RISE_MS = 2800;
const START_DELAY_MS = 1000;
const HEAD_ASPECT = 1.0; // head width / head height

type RGB = readonly [number, number, number];
const GOLD_LIGHT: RGB = [251, 212, 116];
const GOLD: RGB = [230, 167, 59];
const GOLD_DEEP: RGB = [197, 133, 27];
const HIGHLIGHT: RGB = [255, 244, 214];
const rgba = (c: readonly number[], a: number) => `rgba(${c[0]! | 0},${c[1]! | 0},${c[2]! | 0},${a})`;
const mix = (a: readonly number[], b: readonly number[], t: number) => a.map((v, i) => v + (b[i]! - v) * t);

type Pt = [number, number];
/** Head in unit coordinates (x, y in 0..1 of the head box), traced from the reference. */
const POLYS: Pt[][] = [
  // centre prong: arrowhead + shaft (continues into the staff)
  [[0.5, 0], [0.625, 0.29], [0.565, 0.27], [0.565, 1.0], [0.435, 1.0], [0.435, 0.27], [0.375, 0.29]],
  // left prong: one-sided barb (inner edge straight), body down to the base
  [[0.215, 0.235], [0.215, 0.8], [0.055, 0.8], [0.055, 0.43], [0.0, 0.455]],
  // right prong (mirror)
  [[0.785, 0.235], [1.0, 0.455], [0.945, 0.43], [0.945, 0.8], [0.785, 0.8]],
];

function headPaths(): Path2D[] {
  const polys = POLYS.map((poly) => {
    const p = new Path2D();
    poly.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
    p.closePath();
    return p;
  });
  // V-shaped base joining the prongs.
  const base = new Path2D();
  base.moveTo(0.055, 0.78);
  base.quadraticCurveTo(0.5, 1.2, 0.945, 0.78);
  base.lineTo(0.785, 0.7);
  base.quadraticCurveTo(0.5, 1.0, 0.215, 0.7);
  base.closePath();
  return [...polys, base];
}

interface Particle { x: number; y: number; s: number; a: number; col: number; ch: string }
interface Column { x: number; y: number; speed: number; length: number; digits: string[]; strength: number }

export function HeroTrident() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const glow = document.createElement("canvas");
    const gctx = glow.getContext("2d")!;
    const layer = document.createElement("canvas");
    const lctx = layer.getContext("2d")!;
    const unitPaths = headPaths();

    let w = 0, h = 0, dpr = 1, cell = 12, rainSize = 12;
    let desktop = true, cx = 0, landY = 0, groundTop = 0;
    let head = { x: 0, y: 0, w: 0, h: 0 };
    let box = { x: 0, y: 0, w: 0, h: 0 }; // bloom layer bounds
    let particles: Particle[] = [];
    let columns: Column[] = [];
    let raf = 0, last = 0, visible = true, stopped = false;
    const t0 = performance.now();
    const bit = () => (Math.random() < 0.5 ? "0" : "1");

    /** Screen y of the terrain at x for depth t (0 far .. 1 near). */
    function terrainY(x: number, t: number, time: number): number {
      const u = x / w;
      const base = groundTop + (h + 240 - groundTop) * t ** 1.25;
      // Desktop: valley in the middle, hill on the left, long rise to the right.
      const rise = desktop ? 1.35 / (1 + Math.exp(-(u - 0.62) * 7)) + 0.35 * u : 0.8 * Math.exp(-(((u - 0.5) / 0.4) ** 2));
      const hillL = desktop ? 0.75 * Math.exp(-(((u - 0.17) / 0.15) ** 2)) : 0;
      const ripple = 0.14 * Math.sin(u * 8 + t * 6 + time * 0.5) + 0.08 * Math.sin(u * 21 - t * 4 + time * 0.35);
      return base - rise * 125 - hillL * (40 + 120 * t) - ripple * (15 + 70 * t);
    }

    function layout() {
      const rect = wrap!.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = rect.width; h = rect.height;
      canvas!.width = Math.round(w * dpr); canvas!.height = Math.round(h * dpr);
      canvas!.style.width = `${w}px`; canvas!.style.height = `${h}px`;
      desktop = w >= 1024;
      let hh: number, top: number;
      if (desktop) {
        groundTop = h * 0.8;
        cx = w * 0.74;
        hh = Math.min(h * 0.5, (w * 0.29) / HEAD_ASPECT);
        top = h * 0.06;
      } else {
        const region = Math.min(560, window.innerHeight * 0.5) - 8;
        groundTop = h - region * 0.22;
        cx = w / 2;
        hh = region * 0.46;
        top = h - region;
      }
      landY = terrainY(cx, desktop ? 0.32 : 0.12, 0);
      const hw = hh * HEAD_ASPECT;
      head = { x: cx - hw / 2, y: top, w: hw, h: hh };
      cell = Math.max(8, hw / 24);
      rainSize = Math.max(10, Math.round(cell * 0.95));

      // Shape paths in canvas space: head pieces + staff (same width as the shaft).
      const m = new DOMMatrix([head.w, 0, 0, head.h, head.x, head.y]);
      const paths = unitPaths.map((p) => { const q = new Path2D(); q.addPath(p, m); return q; });
      const staff = new Path2D();
      staff.rect(head.x + hw * 0.435, head.y + hh * 0.95, hw * 0.13, landY - (head.y + hh * 0.95));
      paths.push(staff);
      const inside = (x: number, y: number) => paths.some((p) => ctx!.isPointInPath(p, x, y));

      // Digits in loose rows (reference look): aligned rows, light jitter.
      ctx!.setTransform(1, 0, 0, 1, 0, 0);
      particles = [];
      const rowGap = cell * 0.98, colGap = cell * 0.66;
      for (let y = head.y + rowGap * 0.5, r = 0; y < landY; y += rowGap, r++) {
        for (let x = head.x - hw * 0.02 + (r % 2) * colGap * 0.3; x < head.x + hw * 1.02; x += colGap) {
          if (!inside(x, y)) continue;
          particles.push({ x: x + (Math.random() - 0.5) * cell * 0.12, y: y + (Math.random() - 0.5) * cell * 0.1, s: 0.88 + Math.random() * 0.24, a: 0.75 + Math.random() * 0.25, col: Math.round(x / colGap), ch: bit() });
        }
      }

      // Bloom layer bounds (trident + padding).
      const pad = 50;
      box = { x: head.x - pad, y: head.y - pad, w: hw + pad * 2, h: landY - head.y + pad * 2 };
      layer.width = Math.round(box.w * dpr); layer.height = Math.round(box.h * dpr);

      // Static glow: soft fill + bright outer edge only (no internal lines).
      glow.width = canvas!.width; glow.height = canvas!.height;
      gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      gctx.clearRect(0, 0, w, h);
      gctx.filter = "blur(26px)";
      gctx.fillStyle = rgba([240, 150, 40], 0.55);
      for (const p of paths) gctx.fill(p);
      gctx.filter = "none";
      const edge = document.createElement("canvas");
      edge.width = glow.width; edge.height = glow.height;
      const ectx = edge.getContext("2d")!;
      ectx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ectx.strokeStyle = rgba([255, 196, 90], 1);
      ectx.lineWidth = 3;
      for (const p of paths) ectx.stroke(p);
      ectx.globalCompositeOperation = "destination-out";
      for (const p of paths) ectx.fill(p);
      gctx.setTransform(1, 0, 0, 1, 0, 0);
      gctx.filter = "blur(6px)";
      gctx.drawImage(edge, 0, 0);
      gctx.filter = "none";
      gctx.globalAlpha = 0.7;
      gctx.drawImage(edge, 0, 0);
      gctx.globalAlpha = 1;

      // Code streams: concentrated around the trident, sparse elsewhere.
      const count = Math.round(w / (desktop ? 18 : 22));
      columns = Array.from({ length: count }, () => {
        const nearTrident = Math.random() < 0.75;
        const x = nearTrident ? cx + (Math.random() - 0.5) * (desktop ? w * 0.42 : w * 0.95) : Math.random() * w;
        return {
          x, y: Math.random() * h, speed: 25 + Math.random() * 50, length: 5 + Math.floor(Math.random() * 14),
          digits: Array.from({ length: 20 }, () => (Math.random() < 0.65 ? "1" : "0")),
          strength: nearTrident ? 0.6 + Math.random() * 0.4 : 0.25,
        };
      });
    }

    function scanY(now: number): number | null {
      const t = now - t0 - START_DELAY_MS;
      if (t < 0) return null;
      const phase = t % CYCLE_MS;
      if (phase > RISE_MS) return null;
      return landY - landY * (phase / RISE_MS);
    }

    function drawGround(time: number, sy: number | null) {
      const rows = desktop ? 24 : 18;
      const lit = sy !== null && sy > landY - 70 ? 1 - (landY - sy) / 70 : 0;
      for (let i = 0; i < rows; i++) {
        const t = i / (rows - 1);
        const gap = 3 + t * 6;
        const size = 1 + t * 1.8;
        for (let x = (i % 2) * gap * 0.5 - 10; x < w + 10; x += gap) {
          const y = terrainY(x, t, time);
          if (y > h + 4 || y < 0) continue;
          const dx = (x - cx) / (w * (desktop ? 0.22 : 0.4));
          const near = Math.exp(-(dx * dx) - ((t - (desktop ? 0.32 : 0.12)) / 0.45) ** 2);
          // Higher ground catches more light (crests glow, valleys fall dark).
          const u = x / w;
          const elev = desktop ? 1.35 / (1 + Math.exp(-(u - 0.62) * 7)) + 0.35 * u + 0.75 * Math.exp(-(((u - 0.17) / 0.15) ** 2)) : 0.6;
          const crest = Math.min(1, elev / 1.4);
          let a = 0.1 + 0.55 * crest * (0.55 + 0.45 * (1 - t)) + near * 0.75 + lit * near * 0.5;
          if (desktop && u < 0.42) a *= 0.8;
          ctx!.globalAlpha = Math.min(1, a);
          ctx!.fillStyle = rgba(near > 0.45 ? GOLD_LIGHT : crest > 0.5 ? GOLD : GOLD_DEEP, 1);
          ctx!.fillRect(x, y, size, size);
          // Light streaks dripping down near the landing point.
          if (near > 0.5 && i % 3 === 0 && Math.floor(x / gap) % 6 === 0) {
            ctx!.globalAlpha = near * 0.35;
            ctx!.fillRect(x + size / 2 - 0.5, y, 1, 6 + 14 * near);
          }
        }
      }
      ctx!.globalAlpha = 1;
      // Bright landing glow where the staff meets the ground.
      const r = w * (desktop ? 0.13 : 0.3);
      const g = ctx!.createRadialGradient(cx, landY, 0, cx, landY, r);
      g.addColorStop(0, rgba(HIGHLIGHT, 0.75));
      g.addColorStop(0.15, rgba(GOLD_LIGHT, 0.4));
      g.addColorStop(0.5, rgba(GOLD, 0.12));
      g.addColorStop(1, rgba(GOLD, 0));
      ctx!.fillStyle = g;
      ctx!.fillRect(cx - r, landY - r, r * 2, r * 2);
    }

    function draw(now: number, dt: number) {
      const sy = reduced ? null : scanY(now);
      const time = reduced ? 0 : (now - t0) / 1000;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, w, h);
      ctx!.textAlign = "center";
      ctx!.textBaseline = "middle";

      // 1. Large faint orbit and warm aura.
      const gy = head.y + head.h * 0.55;
      const aura = ctx!.createRadialGradient(cx, gy, 0, cx, gy, head.h * 1.1);
      aura.addColorStop(0, rgba(GOLD, sy !== null ? 0.2 : 0.14));
      aura.addColorStop(1, rgba(GOLD, 0));
      ctx!.fillStyle = aura;
      ctx!.fillRect(cx - head.h * 1.1, gy - head.h * 1.1, head.h * 2.2, head.h * 2.2);
      ctx!.save();
      ctx!.strokeStyle = rgba(GOLD_DEEP, 0.45);
      ctx!.setLineDash([1.2, 6]);
      ctx!.beginPath();
      ctx!.arc(cx, gy, head.h * 0.82, 0, Math.PI * 2);
      ctx!.stroke();
      ctx!.restore();

      // 2. Code streams.
      ctx!.font = `500 ${rainSize}px "IBM Plex Mono", Consolas, monospace`;
      for (const col of columns) {
        if (!reduced) col.y += (col.speed * dt) / 1000;
        if (col.y - col.length * rainSize > landY) { col.y = -Math.random() * h * 0.4; col.speed = 25 + Math.random() * 50; }
        if (Math.random() < 0.02) col.digits[Math.floor(Math.random() * col.digits.length)] = Math.random() < 0.65 ? "1" : "0";
        // faint vertical light trail
        ctx!.globalAlpha = 0.07 * col.strength;
        ctx!.fillStyle = rgba(GOLD, 1);
        const top = Math.max(0, col.y - col.length * rainSize);
        ctx!.fillRect(col.x - 0.5, top, 1, Math.max(0, Math.min(col.y, landY) - top));
        for (let k = 0; k < col.length; k++) {
          const y = col.y - k * rainSize;
          if (y < 0 || y > landY - 4) continue;
          const near = sy !== null && Math.abs(y - sy) < 30;
          ctx!.globalAlpha = Math.min(1, ((k === 0 ? 1 : 0.6 * (1 - k / col.length)) + (near ? 0.4 : 0)) * col.strength);
          ctx!.fillStyle = rgba(near || k === 0 ? GOLD_LIGHT : k < 4 ? GOLD : GOLD_DEEP, 1);
          ctx!.fillText(col.digits[k % col.digits.length]!, col.x, y);
        }
      }
      ctx!.globalAlpha = 1;

      // 3. Ground.
      drawGround(time, sy);

      // 4. Static glow + edge.
      ctx!.setTransform(1, 0, 0, 1, 0, 0);
      ctx!.globalAlpha = Math.min(1, (sy !== null ? 1 : 0.85) + Math.sin(time * 1.3) * 0.08);
      ctx!.drawImage(glow, 0, 0);
      ctx!.globalAlpha = 1;

      // 5. Digits on the bloom layer, then bloom + crisp onto the main canvas.
      lctx.setTransform(dpr, 0, 0, dpr, -box.x * dpr, -box.y * dpr);
      lctx.clearRect(box.x, box.y, box.w, box.h);
      lctx.textAlign = "center";
      lctx.textBaseline = "middle";
      const span = landY - head.y;
      let lastFont = "";
      for (const p of particles) {
        if (!reduced && Math.random() < 0.006) p.ch = bit();
        const f = (p.y - head.y) / span;
        let c = f < 0.25 ? mix(GOLD_LIGHT, [255, 190, 80], f / 0.25) : mix([255, 190, 80], [240, 150, 40], Math.min(1, (f - 0.25) / 0.75));
        const stream = Math.max(0, Math.sin(p.y * 0.04 - time * 3.2 + p.col * 1.9)) ** 8;
        let a = Math.min(1, p.a * (0.92 + 0.2 * stream));
        if (stream > 0.3) c = mix(c, GOLD_LIGHT, stream);
        if (sy !== null) {
          const d = p.y - sy;
          if (d >= -cell && d < cell * 1.5) { c = [...HIGHLIGHT]; a = 1; }
          else if (d >= 0 && d < cell * 7) { c = mix(c, HIGHLIGHT, 1 - d / (cell * 7)); a = 1; }
        }
        const font = `700 ${Math.round(cell * p.s)}px "IBM Plex Mono", Consolas, monospace`;
        if (font !== lastFont) { lctx.font = font; lastFont = font; }
        lctx.fillStyle = rgba(c, a);
        lctx.fillText(p.ch, p.x, p.y);
      }
      ctx!.save();
      ctx!.globalCompositeOperation = "lighter";
      ctx!.filter = "blur(9px)";
      ctx!.globalAlpha = 1;
      ctx!.drawImage(layer, box.x * dpr, box.y * dpr);
      ctx!.restore();
      ctx!.drawImage(layer, box.x * dpr, box.y * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      // 6. Rising line across the full width, softer behind the copy.
      if (sy !== null) {
        const line = ctx!.createLinearGradient(0, 0, w, 0);
        const left = desktop ? 0.25 : 0.6;
        line.addColorStop(0, rgba(GOLD_LIGHT, 0.15 * left));
        line.addColorStop(desktop ? 0.5 : 0.2, rgba(GOLD_LIGHT, 0.45 * left + 0.1));
        line.addColorStop(desktop ? 0.74 : 0.5, rgba(GOLD_LIGHT, 0.9));
        line.addColorStop(1, rgba(GOLD_LIGHT, 0.25));
        ctx!.fillStyle = line;
        ctx!.fillRect(0, sy, w, 1);
        const trail = ctx!.createLinearGradient(0, sy, 0, sy + 48);
        trail.addColorStop(0, rgba(GOLD, 0.08));
        trail.addColorStop(1, rgba(GOLD, 0));
        ctx!.fillStyle = trail;
        ctx!.fillRect(desktop ? w * 0.45 : 0, sy, desktop ? w * 0.55 : w, 48);
      }
    }

    function frame(now: number) {
      if (stopped) return;
      raf = requestAnimationFrame(frame);
      if (!visible || now - last < 33) return;
      const dt = last ? Math.min(now - last, 100) : 0;
      last = now;
      draw(now, dt);
    }

    const ro = new ResizeObserver(() => { layout(); draw(performance.now(), 0); });
    const io = new IntersectionObserver(([e]) => { visible = !!e?.isIntersecting; });
    const start = () => {
      layout();
      draw(performance.now(), 0);
      ro.observe(wrap);
      io.observe(wrap);
      if (!reduced) raf = requestAnimationFrame(frame);
    };
    (document.fonts?.ready ?? Promise.resolve()).then(() => { if (!stopped) start(); });
    return () => { stopped = true; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); };
  }, []);

  return (
    <div ref={wrapRef} aria-hidden className="pointer-events-none absolute inset-0">
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}
