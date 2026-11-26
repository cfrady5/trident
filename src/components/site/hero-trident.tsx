"use client";

/**
 * Full-bleed hero background (canvas): a classic trident illustration built
 * from binary digits, streaming code, a glowing edge, a staff landing in an
 * animated gold dot field and a gold line that periodically rises across the
 * hero.
 *
 * Brand notes (BRAND.md → Owner decisions, Nov 26, 2026): this trident is an
 * owner-approved hero ILLUSTRATION, not the Trident logo. The logo artwork in
 * public/brand is unchanged and is still used everywhere else. Homepage hero
 * only. Performance/accessibility: 30 fps cap, DPR ≤ 1.5, glow pre-rendered,
 * paused off-screen, static frame under prefers-reduced-motion.
 */
import { useEffect, useRef } from "react";

const CYCLE_MS = 9000;
const RISE_MS = 2800;
const START_DELAY_MS = 1000;
const HEAD_ASPECT = 0.92; // head width / head height

const GOLD_LIGHT = [251, 212, 116] as const;
const GOLD = [230, 167, 59] as const;
const GOLD_DEEP = [197, 133, 27] as const;
const HIGHLIGHT = [255, 243, 204] as const;
const rgba = (c: readonly number[], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const mix = (a: readonly number[], b: readonly number[], t: number) => a.map((v, i) => v + (b[i]! - v) * t);

type Pt = [number, number];
/**
 * Trident head in unit coordinates (x 0..1 across the head, y 0..1 down the
 * head). Pieces are unioned. Shape follows the owner's reference: arrowhead
 * centre prong, flared side prongs, curved crossbar.
 */
const POLYS: Pt[][] = [
  // centre prong head + shaft
  [[0.5, 0], [0.64, 0.205], [0.56, 0.18], [0.56, 0.8], [0.44, 0.8], [0.44, 0.18], [0.36, 0.205]],
  // left prong head + shaft
  [[0.135, 0.075], [0.235, 0.28], [0.19, 0.255], [0.19, 0.62], [0.085, 0.62], [0.085, 0.27], [-0.02, 0.33]],
  // right prong head + shaft
  [[0.865, 0.075], [1.02, 0.33], [0.915, 0.27], [0.915, 0.62], [0.81, 0.62], [0.81, 0.255], [0.765, 0.28]],
];

function headPaths(): Path2D[] {
  const polys = POLYS.map((poly) => {
    const p = new Path2D();
    poly.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
    p.closePath();
    return p;
  });
  // Curved crossbar (crescent) joining the prongs.
  const bowl = new Path2D();
  bowl.moveTo(0.085, 0.55);
  bowl.quadraticCurveTo(0.5, 1.06, 0.915, 0.55);
  bowl.lineTo(0.81, 0.55);
  bowl.quadraticCurveTo(0.5, 0.86, 0.19, 0.55);
  bowl.closePath();
  return [...polys, bowl];
}

interface Particle { x: number; y: number; s: number; a: number; col: number; ch: string }
interface Column { x: number; y: number; speed: number; length: number; digits: string[] }

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
    const unitPaths = headPaths();

    let w = 0, h = 0, dpr = 1, cell = 10, rainSize = 12;
    let desktop = true, cx = 0, horizon = 0;
    let head = { x: 0, y: 0, w: 0, h: 0 };
    let staff = { x: 0, y: 0, w: 0, h: 0 };
    let particles: Particle[] = [];
    let columns: Column[] = [];
    let textZone: (x: number, y: number) => boolean = () => false;
    let raf = 0, last = 0, visible = true, stopped = false;
    const t0 = performance.now();
    const bit = () => (Math.random() < 0.5 ? "0" : "1");

    /** Paths transformed into canvas space (head pieces + staff). */
    function worldPaths(): Path2D[] {
      const m = new DOMMatrix([head.w, 0, 0, head.h, head.x, head.y]);
      const out = unitPaths.map((p) => { const q = new Path2D(); q.addPath(p, m); return q; });
      const st = new Path2D();
      st.rect(staff.x, staff.y, staff.w, staff.h);
      out.push(st);
      return out;
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
        horizon = h * 0.82;
        hh = Math.min(h * 0.5, (w * 0.3) / HEAD_ASPECT);
        top = h * 0.07;
        cx = w * 0.74;
        textZone = (x) => x < w * 0.52;
      } else {
        // Matches the space the hero reserves below the copy: pb-[min(50vh,560px)].
        const region = Math.min(560, window.innerHeight * 0.5) - 8;
        horizon = h - 56;
        hh = region * 0.5;
        top = h - region;
        cx = w / 2;
        textZone = (_x, y) => y < h - region - 20;
      }
      const hw = hh * HEAD_ASPECT;
      head = { x: cx - hw / 2, y: top, w: hw, h: hh };
      const sw = hw * 0.12;
      staff = { x: cx - sw / 2, y: top + hh * 0.76, w: sw, h: horizon - (top + hh * 0.76) };
      cell = Math.max(6.5, hw / 34);
      rainSize = Math.max(11, Math.round(cell * 1.15));

      // Sample jittered digit positions inside the shape (organic, not a grid).
      const paths = worldPaths();
      const inside = (x: number, y: number) => paths.some((p) => ctx!.isPointInPath(p, x, y));
      ctx!.setTransform(1, 0, 0, 1, 0, 0);
      particles = [];
      const x0 = head.x - hw * 0.05, x1 = head.x + hw * 1.05, y1 = horizon;
      for (let y = head.y; y < y1; y += cell * 0.8) {
        for (let x = x0; x < x1; x += cell * 0.68) {
          const jx = x + (Math.random() - 0.5) * cell * 0.45, jy = y + (Math.random() - 0.5) * cell * 0.35;
          if (!inside(jx, jy)) continue;
          particles.push({ x: jx, y: jy, s: 0.78 + Math.random() * 0.5, a: 0.6 + Math.random() * 0.4, col: Math.round((jx - x0) / cell), ch: bit() });
        }
      }

      // Pre-render the glow (blurred fill + bright edge) once per layout.
      glow.width = canvas!.width; glow.height = canvas!.height;
      gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      gctx.clearRect(0, 0, w, h);
      gctx.filter = "blur(18px)";
      gctx.fillStyle = rgba(GOLD, 0.35);
      for (const p of paths) gctx.fill(p);
      gctx.filter = "none";
      // Outer edge only: stroke every piece on a scratch canvas, then erase
      // everything inside the union so overlaps leave no internal lines.
      const edge = document.createElement("canvas");
      edge.width = glow.width; edge.height = glow.height;
      const ectx = edge.getContext("2d")!;
      ectx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ectx.strokeStyle = rgba(GOLD_LIGHT, 0.85);
      ectx.lineWidth = 2.5;
      for (const p of paths) ectx.stroke(p);
      ectx.globalCompositeOperation = "destination-out";
      for (const p of paths) ectx.fill(p);
      gctx.setTransform(1, 0, 0, 1, 0, 0);
      gctx.filter = "blur(4px)";
      gctx.drawImage(edge, 0, 0);
      gctx.filter = "none";
      gctx.drawImage(edge, 0, 0);

      const count = Math.round(w / 24);
      columns = Array.from({ length: count }, (_, i) => ({
        x: ((i + 0.5) / count) * w + (Math.random() - 0.5) * 10,
        y: Math.random() * h,
        speed: 20 + Math.random() * 45,
        length: 6 + Math.floor(Math.random() * 12),
        digits: Array.from({ length: 18 }, bit),
      }));
    }

    function scanY(now: number): number | null {
      const t = now - t0 - START_DELAY_MS;
      if (t < 0) return null;
      const phase = t % CYCLE_MS;
      if (phase > RISE_MS) return null;
      return horizon - horizon * (phase / RISE_MS);
    }

    function drawWave(time: number, sy: number | null) {
      const rows = 26;
      const depth = h - horizon + 30;
      const lit = sy !== null && sy > horizon - 60 ? 1 - (horizon - sy) / 60 : 0;
      for (let i = 0; i < rows; i++) {
        const t = i / (rows - 1);
        const gap = 8 + t * 9;
        const size = 1 + t * 2;
        for (let x = (i % 2) * gap * 0.5; x < w; x += gap) {
          const near = Math.exp(-(((x - cx) / (w * 0.16)) ** 2));
          const y = horizon - 8 + t ** 1.5 * depth + Math.sin(x * 0.012 + time * 0.7 + t * 4) * (3 + 9 * t) - near * (1 - t) * 26;
          if (y > h) continue;
          ctx!.globalAlpha = Math.min(1, 0.22 + 0.45 * t * (0.5 + 0.5 * near) + near * 0.55 * (1 - t) + lit * near * 0.4);
          ctx!.fillStyle = rgba(near > 0.6 && i < 6 ? GOLD_LIGHT : t > 0.5 ? GOLD_DEEP : GOLD, 1);
          ctx!.fillRect(x, y, size, size);
        }
      }
      ctx!.globalAlpha = 1;
    }

    function draw(now: number, dt: number) {
      const sy = reduced ? null : scanY(now);
      const time = reduced ? 0 : (now - t0) / 1000;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, w, h);
      ctx!.textAlign = "center";
      ctx!.textBaseline = "middle";

      // 1. Warm light behind the trident and a dotted orbit.
      const gy = head.y + head.h * 0.5;
      const glowR = head.h * 1.05;
      const g = ctx!.createRadialGradient(cx, gy, 0, cx, gy, glowR);
      g.addColorStop(0, rgba(GOLD, sy !== null ? 0.22 : 0.15));
      g.addColorStop(1, rgba(GOLD, 0));
      ctx!.fillStyle = g;
      ctx!.fillRect(cx - glowR, gy - glowR, glowR * 2, glowR * 2);
      ctx!.save();
      ctx!.strokeStyle = rgba(GOLD_DEEP, 0.4);
      ctx!.setLineDash([1, 7]);
      ctx!.beginPath();
      ctx!.arc(cx, gy, head.h * 0.82, 0, Math.PI * 2);
      ctx!.stroke();
      ctx!.restore();

      // 2. Falling code across the hero (dimmed behind the copy).
      ctx!.font = `500 ${rainSize}px "IBM Plex Mono", Consolas, monospace`;
      for (const col of columns) {
        if (!reduced) col.y += (col.speed * dt) / 1000;
        if (col.y - col.length * rainSize > horizon) { col.y = -Math.random() * h * 0.3; col.speed = 20 + Math.random() * 45; }
        if (Math.random() < 0.02) col.digits[Math.floor(Math.random() * col.digits.length)] = bit();
        for (let k = 0; k < col.length; k++) {
          const y = col.y - k * rainSize;
          if (y < 0 || y > horizon - 4) continue;
          const dim = textZone(col.x, y) ? 0.55 : 1;
          const near = sy !== null && Math.abs(y - sy) < 30;
          ctx!.globalAlpha = Math.min(1, ((k === 0 ? 0.9 : 0.55 * (1 - k / col.length)) + (near ? 0.4 : 0)) * dim);
          ctx!.fillStyle = rgba(near ? GOLD_LIGHT : k === 0 ? GOLD : k < 4 ? GOLD_DEEP : [153, 99, 4], 1);
          ctx!.fillText(col.digits[k % col.digits.length]!, col.x, y);
        }
      }
      ctx!.globalAlpha = 1;

      // 3. Dot field and the bright landing point of the staff.
      drawWave(time, sy);
      const bg = ctx!.createRadialGradient(cx, horizon, 0, cx, horizon, w * 0.14);
      bg.addColorStop(0, rgba(GOLD_LIGHT, 0.5));
      bg.addColorStop(0.25, rgba(GOLD, 0.18));
      bg.addColorStop(1, rgba(GOLD, 0));
      ctx!.fillStyle = bg;
      ctx!.fillRect(cx - w * 0.14, horizon - w * 0.14, w * 0.28, w * 0.28);

      // 4. Pre-rendered glow, pulsing gently and brighter while the line passes.
      ctx!.setTransform(1, 0, 0, 1, 0, 0);
      ctx!.globalAlpha = (sy !== null ? 1 : 0.75) + Math.sin(time * 1.3) * 0.08;
      ctx!.drawImage(glow, 0, 0);
      ctx!.globalAlpha = 1;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      // 5. Digits: gradient top→bottom, data streaming down columns, flicker, scan highlight.
      const span = horizon - head.y;
      for (const p of particles) {
        if (!reduced && Math.random() < 0.006) p.ch = bit();
        const f = (p.y - head.y) / span;
        let c = f < 0.25 ? mix(GOLD_LIGHT, GOLD, f / 0.25) : mix(GOLD, GOLD_DEEP, Math.min(1, (f - 0.25) / 0.75));
        const stream = Math.max(0, Math.sin(p.y * 0.045 - time * 3 + p.col * 1.7)) ** 6;
        let a = Math.min(1, p.a * (0.9 + 0.3 * stream));
        if (stream > 0.3) c = mix(c, GOLD_LIGHT, stream);
        if (sy !== null) {
          const d = p.y - sy;
          if (d >= -cell && d < cell * 1.5) { c = HIGHLIGHT as unknown as number[]; a = 1; }
          else if (d >= 0 && d < cell * 7) { c = mix(c, GOLD_LIGHT, 1 - d / (cell * 7)); a = Math.max(a, 0.9); }
        }
        ctx!.font = `600 ${(cell * p.s).toFixed(1)}px "IBM Plex Mono", Consolas, monospace`;
        ctx!.fillStyle = rgba(c, a);
        ctx!.fillText(p.ch, p.x, p.y);
      }

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
