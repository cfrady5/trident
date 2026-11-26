"use client";

/**
 * Full-bleed hero background (canvas):
 *  - faint binary code columns falling across the whole hero
 *  - the supplied Trident mark rendered in binary digits, with a soft glow
 *  - a binary staff from the mark down to a moving field of gold dots
 *  - a gold line that periodically rises across the full width, lighting the
 *    code, staff and dots as it passes
 *
 * Brand notes (BRAND.md → Owner decisions, Nov 26, 2026; homepage hero only):
 * the mark is the supplied artwork (digits are clipped to its own alpha, never
 * redrawn); binary texture, glow and staff are owner-approved exceptions.
 * Performance/accessibility: 30 fps cap, DPR capped at 1.5, paused off-screen,
 * a static frame under prefers-reduced-motion, plain mark without JavaScript.
 */
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const MARK = "/brand/mark-gold.png";
const MARK_RATIO = 370 / 453; // width / height of the supplied artwork
const CYCLE_MS = 9000;
const RISE_MS = 2800;
const START_DELAY_MS = 1000;

const GOLD_LIGHT = "#FBD474";
const GOLD = "#E6A73B";
const GOLD_DEEP = "#C5851B";
const BRONZE = "#996304";
const HIGHLIGHT = "#FFF3CC";

interface Column { x: number; y: number; speed: number; length: number; digits: string[] }
interface Layout {
  desktop: boolean;
  cx: number;
  mark: { x: number; y: number; w: number; h: number };
  horizon: number;
  textZone: (x: number, y: number) => boolean; // where the copy sits; code is dimmed there
}

export function HeroTrident() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mark = new window.Image();
    mark.src = MARK;
    const layer = document.createElement("canvas");
    const lctx = layer.getContext("2d")!;

    let w = 0, h = 0, dpr = 1, cell = 10, rainSize = 12;
    let L: Layout;
    let grid: string[][] = [];
    let staff: string[][] = [];
    let staffCols = 4;
    let layerBox = { x: 0, y: 0, w: 0, h: 0 };
    let columns: Column[] = [];
    let raf = 0, last = 0, visible = true, stopped = false;
    const t0 = performance.now();
    const bit = () => (Math.random() < 0.5 ? "0" : "1");

    function computeLayout(): Layout {
      const desktop = w >= 1024;
      if (desktop) {
        const horizon = h * 0.8;
        const mh = Math.min(h * 0.52, (w * 0.28) / MARK_RATIO);
        const mw = mh * MARK_RATIO;
        const cx = w * 0.74;
        return { desktop, cx, horizon, mark: { x: cx - mw / 2, y: h * 0.1, w: mw, h: mh }, textZone: (x) => x < w * 0.52 };
      }
      // Matches the space the hero reserves below the copy: pb-[min(50vh,560px)].
      const region = Math.min(560, window.innerHeight * 0.5) - 8;
      const horizon = h - 56;
      const mh = region * 0.52;
      const mw = mh * MARK_RATIO;
      const cx = w / 2;
      return { desktop, cx, horizon, mark: { x: cx - mw / 2, y: h - region, w: mw, h: mh }, textZone: (_x, y) => y < h - region - 20 };
    }

    function layout() {
      const rect = wrap!.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = rect.width; h = rect.height;
      canvas!.width = Math.round(w * dpr); canvas!.height = Math.round(h * dpr);
      canvas!.style.width = `${w}px`; canvas!.style.height = `${h}px`;
      L = computeLayout();
      cell = Math.max(7, Math.round(L.mark.w / 32));
      rainSize = Math.max(11, Math.round(cell * 1.2));
      grid = Array.from({ length: Math.ceil(L.mark.h / cell) }, () => Array.from({ length: Math.ceil(L.mark.w / cell) }, bit));
      staffCols = Math.max(3, Math.round((L.mark.w * 0.16) / cell));
      const staffTop = L.mark.y + L.mark.h - cell * 0.4;
      staff = Array.from({ length: Math.max(0, Math.floor((L.horizon - staffTop) / cell)) }, () => Array.from({ length: staffCols }, bit));
      // Offscreen layer covers only the mark + staff (+ room for glow), keeping blur cheap.
      const pad = 40;
      layerBox = { x: L.mark.x - pad, y: L.mark.y - pad, w: L.mark.w + pad * 2, h: L.horizon - L.mark.y + pad * 2 };
      layer.width = Math.round(layerBox.w * dpr); layer.height = Math.round(layerBox.h * dpr);
      const count = Math.round(w / 26);
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
      return L.horizon - L.horizon * (phase / RISE_MS);
    }

    const shade = (y: number, sy: number | null, base: string, passed: string) => {
      if (sy === null) return base;
      const d = y - sy;
      if (d >= -cell && d < cell * 1.5) return HIGHLIGHT;
      if (d >= 0 && d < cell * 6) return passed;
      return base;
    };

    function drawWave(now: number, sy: number | null) {
      const rows = 26;
      const depth = h - L.horizon + 30;
      const time = reduced ? 0 : (now - t0) / 1000;
      const lit = sy !== null && sy > L.horizon - 60 ? 1 - (L.horizon - sy) / 60 : 0; // flash as the line leaves the horizon
      for (let i = 0; i < rows; i++) {
        const t = i / (rows - 1); // 0 = far (horizon), 1 = near (bottom)
        const gap = 8 + t * 9;
        const size = 1 + t * 2;
        for (let x = (i % 2) * gap * 0.5; x < w; x += gap) {
          const near = Math.exp(-(((x - L.cx) / (w * 0.16)) ** 2));
          const y = L.horizon - 8 + t ** 1.5 * depth
            + Math.sin(x * 0.012 + time * 0.7 + t * 4) * (3 + 9 * t)
            - near * (1 - t) * 26;
          if (y > h) continue;
          const a = 0.22 + 0.45 * t * (0.5 + 0.5 * near) + near * 0.55 * (1 - t) + lit * near * 0.4;
          ctx!.globalAlpha = Math.min(1, a);
          ctx!.fillStyle = near > 0.6 && i < 6 ? GOLD_LIGHT : t > 0.5 ? GOLD_DEEP : GOLD;
          ctx!.fillRect(x, y, size, size);
        }
      }
      ctx!.globalAlpha = 1;
    }

    function draw(now: number, dt: number) {
      const sy = reduced ? null : scanY(now);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, w, h);
      ctx!.textAlign = "center";
      ctx!.textBaseline = "middle";

      // 1. Glow behind the trident (warm radial light), brighter while the line passes.
      const glowR = L.mark.h * 0.95;
      const gy = L.mark.y + L.mark.h * 0.55;
      const g = ctx!.createRadialGradient(L.cx, gy, 0, L.cx, gy, glowR);
      g.addColorStop(0, `rgba(230,167,59,${sy !== null ? 0.24 : 0.16})`);
      g.addColorStop(1, "rgba(230,167,59,0)");
      ctx!.fillStyle = g;
      ctx!.fillRect(L.cx - glowR, gy - glowR, glowR * 2, glowR * 2);
      // Faint dotted orbit, as in the reference.
      ctx!.save();
      ctx!.strokeStyle = "rgba(197,133,27,0.4)";
      ctx!.setLineDash([1, 7]);
      ctx!.beginPath();
      ctx!.arc(L.cx, gy, L.mark.h * 0.78, 0, Math.PI * 2);
      ctx!.stroke();
      ctx!.restore();

      // 2. Falling code across the whole hero (dimmed behind the copy).
      ctx!.font = `500 ${rainSize}px "IBM Plex Mono", Consolas, monospace`;
      for (const col of columns) {
        if (!reduced) col.y += (col.speed * dt) / 1000;
        if (col.y - col.length * rainSize > L.horizon) { col.y = -Math.random() * h * 0.3; col.speed = 20 + Math.random() * 45; }
        if (Math.random() < 0.02) col.digits[Math.floor(Math.random() * col.digits.length)] = bit();
        for (let k = 0; k < col.length; k++) {
          const y = col.y - k * rainSize;
          if (y < 0 || y > L.horizon - 4) continue;
          const dim = L.textZone(col.x, y) ? 0.55 : 1;
          const near = sy !== null && Math.abs(y - sy) < 30;
          ctx!.globalAlpha = Math.min(1, ((k === 0 ? 0.9 : 0.55 * (1 - k / col.length)) + (near ? 0.4 : 0)) * dim);
          ctx!.fillStyle = near ? GOLD_LIGHT : k === 0 ? GOLD : k < 4 ? GOLD_DEEP : BRONZE;
          ctx!.fillText(col.digits[k % col.digits.length]!, col.x, y);
        }
      }
      ctx!.globalAlpha = 1;

      // 3. Dot field at the horizon, with a bright point where the staff lands.
      drawWave(now, sy);
      const bg = ctx!.createRadialGradient(L.cx, L.horizon, 0, L.cx, L.horizon, w * 0.14);
      bg.addColorStop(0, "rgba(251,212,116,0.45)");
      bg.addColorStop(0.25, "rgba(230,167,59,0.18)");
      bg.addColorStop(1, "rgba(230,167,59,0)");
      ctx!.fillStyle = bg;
      ctx!.fillRect(L.cx - w * 0.14, L.horizon - w * 0.14, w * 0.28, w * 0.28);

      // 4. Trident (mark digits clipped to the artwork) + staff, on an offscreen layer.
      if (mark.complete && mark.naturalWidth) {
        const ox = layerBox.x, oy = layerBox.y;
        const mx = L.mark.x - ox, my = L.mark.y - oy;
        lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        lctx.globalCompositeOperation = "source-over";
        lctx.clearRect(0, 0, layerBox.w, layerBox.h);
        lctx.globalAlpha = 0.3;
        lctx.drawImage(mark, mx, my, L.mark.w, L.mark.h);
        lctx.globalAlpha = 1;
        lctx.font = `600 ${cell * 1.02}px "IBM Plex Mono", Consolas, monospace`;
        lctx.textAlign = "center";
        lctx.textBaseline = "middle";
        for (let r = 0; r < grid.length; r++) {
          const yAbs = L.mark.y + (r + 0.5) * cell;
          const f = r / grid.length;
          lctx.fillStyle = shade(yAbs, sy, f < 0.35 ? GOLD_LIGHT : f < 0.75 ? GOLD : GOLD_DEEP, GOLD_LIGHT);
          const row = grid[r]!;
          for (let c = 0; c < row.length; c++) {
            if (!reduced && Math.random() < 0.004) row[c] = bit();
            lctx.fillText(row[c]!, mx + (c + 0.5) * cell, yAbs - oy);
          }
        }
        lctx.globalCompositeOperation = "destination-in";
        lctx.drawImage(mark, mx, my, L.mark.w, L.mark.h);
        lctx.globalCompositeOperation = "source-over";
        // Staff (outside the mask).
        const staffTop = L.mark.y + L.mark.h - cell * 0.4;
        const sx = L.cx - (staffCols * cell) / 2 - ox;
        for (let r = 0; r < staff.length; r++) {
          const yAbs = staffTop + (r + 0.5) * cell;
          const f = r / Math.max(1, staff.length);
          lctx.globalAlpha = 0.95 - f * 0.35;
          lctx.fillStyle = shade(yAbs, sy, f < 0.5 ? GOLD : GOLD_DEEP, GOLD_LIGHT);
          const row = staff[r]!;
          for (let c = 0; c < row.length; c++) {
            if (!reduced && Math.random() < 0.006) row[c] = bit();
            lctx.fillText(row[c]!, sx + (c + 0.5) * cell, yAbs - oy);
          }
        }
        lctx.globalAlpha = 1;
        // Glow pass (blurred copy) then the crisp layer.
        ctx!.save();
        ctx!.globalAlpha = sy !== null ? 1 : 0.8;
        ctx!.filter = "blur(12px)";
        ctx!.drawImage(layer, ox, oy, layerBox.w, layerBox.h);
        ctx!.restore();
        ctx!.drawImage(layer, ox, oy, layerBox.w, layerBox.h);
      }

      // 5. Rising line across the full hero width, softer behind the copy.
      if (sy !== null) {
        const line = ctx!.createLinearGradient(0, 0, w, 0);
        const left = L.desktop ? 0.25 : 0.6;
        line.addColorStop(0, `rgba(251,212,116,${0.15 * left})`);
        line.addColorStop(L.desktop ? 0.5 : 0.2, `rgba(251,212,116,${0.45 * left + 0.1})`);
        line.addColorStop(L.desktop ? 0.74 : 0.5, "rgba(251,212,116,0.9)");
        line.addColorStop(1, "rgba(251,212,116,0.25)");
        ctx!.fillStyle = line;
        ctx!.fillRect(0, sy, w, 1);
        const trail = ctx!.createLinearGradient(0, sy, 0, sy + 48);
        trail.addColorStop(0, "rgba(230,167,59,0.08)");
        trail.addColorStop(1, "rgba(230,167,59,0)");
        ctx!.fillStyle = trail;
        ctx!.fillRect(L.desktop ? w * 0.45 : 0, sy, L.desktop ? w * 0.55 : w, 48);
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
      setReady(true);
      ro.observe(wrap);
      io.observe(wrap);
      if (!reduced) raf = requestAnimationFrame(frame);
    };
    Promise.all([mark.decode().catch(() => undefined), document.fonts?.ready]).then(() => { if (!stopped) start(); });
    return () => { stopped = true; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); };
  }, []);

  return (
    <div ref={wrapRef} aria-hidden className="pointer-events-none absolute inset-0">
      {/* Static fallback before the first frame / without JavaScript. */}
      <div className={`absolute bottom-[8%] left-1/2 h-[42%] w-[60%] -translate-x-1/2 transition-opacity duration-700 lg:bottom-auto lg:left-[74%] lg:top-[10%] lg:h-[52%] lg:w-[28%] ${ready ? "opacity-0" : "opacity-100"}`}>
        <Image src={MARK} alt="" fill priority sizes="(min-width: 1024px) 400px, 60vw" className="object-contain" />
      </div>
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}
