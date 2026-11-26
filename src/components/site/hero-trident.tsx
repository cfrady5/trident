"use client";

/**
 * Hero visual: the supplied Trident mark rendered as a field of binary digits,
 * with faint falling code columns behind it and a gold line that periodically
 * rises from the award baseline (A) to the market (B), lighting the code as it
 * passes.
 *
 * Brand notes (BRAND.md → Owner decisions):
 * - The trident is the supplied artwork. The digit texture is clipped to the
 *   mark's own alpha channel; the shape is never redrawn.
 * - Binary texture is an owner-approved exception (Nov 26, 2026) to the guide's
 *   imagery "don't" list (p.26). Colors stay within the palette.
 * - Motion: 30 fps cap, paused off-screen, static frame under
 *   prefers-reduced-motion. Without JavaScript the plain mark is shown.
 */
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const MARK = "/brand/mark-gold.png";
const MARK_RATIO = 370 / 453; // width / height of the supplied artwork
const CYCLE_MS = 9000;
const RISE_MS = 2500;
const START_DELAY_MS = 1200;
const BASELINE = 0.88; // A · The award (fraction of frame height)
const TOP = 0.03; // B · The market

// Palette (BRAND.md): Gold Light, Gold, Gold Deep, Bronze, plus a warm highlight.
const GOLD_LIGHT = "#FBD474";
const GOLD = "#E6A73B";
const GOLD_DEEP = "#C5851B";
const BRONZE = "#996304";
const HIGHLIGHT = "#FFF3CC";

interface Column { x: number; y: number; speed: number; length: number; digits: string[] }

export function HeroTrident({ className }: { className?: string }) {
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

    let w = 0, h = 0, dpr = 1, cell = 10;
    let markBox = { x: 0, y: 0, w: 0, h: 0 };
    let grid: string[][] = [];
    let columns: Column[] = [];
    let raf = 0, last = 0, visible = true, stopped = false;
    const t0 = performance.now();
    const bit = () => (Math.random() < 0.5 ? "0" : "1");

    function layout() {
      const rect = wrap!.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width; h = rect.height;
      for (const c of [canvas!, layer]) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
      canvas!.style.width = `${w}px`; canvas!.style.height = `${h}px`;
      // Same box as the static fallback: inset 16% horizontally, 14%..86% vertically, object-contain.
      const bx = w * 0.16, bw = w * 0.68, by = h * 0.14, bh = h * 0.72;
      const mw = Math.min(bw, bh * MARK_RATIO), mh = mw / MARK_RATIO;
      markBox = { x: bx + (bw - mw) / 2, y: by + (bh - mh) / 2, w: mw, h: mh };
      cell = Math.max(7, Math.round(mw / 34));
      const cols = Math.ceil(mw / cell), rows = Math.ceil(mh / cell);
      grid = Array.from({ length: rows }, () => Array.from({ length: cols }, bit));
      const count = Math.round(w / 22);
      columns = Array.from({ length: count }, (_, i) => ({
        x: ((i + 0.5) / count) * w + (Math.random() - 0.5) * 8,
        y: Math.random() * h,
        speed: 18 + Math.random() * 40,
        length: 6 + Math.floor(Math.random() * 10),
        digits: Array.from({ length: 16 }, bit),
      }));
    }

    /** Scan line position (px) or null when resting. Linear rise from A to B. */
    function scanY(now: number): number | null {
      const t = now - t0 - START_DELAY_MS;
      if (t < 0) return null;
      const phase = t % CYCLE_MS;
      if (phase > RISE_MS) return null;
      return h * (BASELINE - (BASELINE - TOP) * (phase / RISE_MS));
    }

    function draw(now: number, dt: number) {
      const sy = reduced ? null : scanY(now);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, w, h);
      ctx!.textAlign = "center";
      ctx!.textBaseline = "middle";

      // 1. Falling code columns (behind, restrained).
      const rainSize = Math.max(9, cell);
      ctx!.font = `500 ${rainSize}px "IBM Plex Mono", Consolas, monospace`;
      for (const col of columns) {
        if (!reduced) col.y += (col.speed * dt) / 1000;
        if (col.y - col.length * rainSize > h) { col.y = -Math.random() * h * 0.3; col.speed = 18 + Math.random() * 40; }
        if (Math.random() < 0.02) col.digits[Math.floor(Math.random() * col.digits.length)] = bit();
        for (let k = 0; k < col.length; k++) {
          const y = col.y - k * rainSize;
          if (y < 0 || y > h * BASELINE) continue;
          const near = sy !== null && Math.abs(y - sy) < 28;
          ctx!.globalAlpha = (k === 0 ? 0.55 : 0.32 * (1 - k / col.length)) + (near ? 0.35 : 0);
          ctx!.fillStyle = k === 0 ? GOLD_DEEP : BRONZE;
          ctx!.fillText(col.digits[k % col.digits.length]!, col.x, y);
        }
      }
      ctx!.globalAlpha = 1;

      // 2. Binary texture clipped to the supplied mark's alpha.
      if (mark.complete && mark.naturalWidth) {
        lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        lctx.globalCompositeOperation = "source-over";
        lctx.clearRect(0, 0, w, h);
        // Faint copy of the artwork keeps its shading and silhouette readable.
        lctx.globalAlpha = 0.28;
        lctx.drawImage(mark, markBox.x, markBox.y, markBox.w, markBox.h);
        lctx.globalAlpha = 1;
        lctx.font = `600 ${cell * 1.02}px "IBM Plex Mono", Consolas, monospace`;
        lctx.textAlign = "center";
        lctx.textBaseline = "middle";
        for (let r = 0; r < grid.length; r++) {
          const y = markBox.y + (r + 0.5) * cell;
          const row = grid[r]!;
          // Vertical gradient through the palette, echoing the signature gradient.
          const f = r / grid.length;
          let color = f < 0.35 ? GOLD_LIGHT : f < 0.75 ? GOLD : GOLD_DEEP;
          if (sy !== null) {
            const d = y - sy; // positive = below the line (already passed)
            if (d >= -cell && d < cell * 1.5) color = HIGHLIGHT;
            else if (d >= 0 && d < cell * 6) color = GOLD_LIGHT;
          }
          lctx.fillStyle = color;
          for (let c = 0; c < row.length; c++) {
            if (!reduced && Math.random() < 0.004) row[c] = bit();
            lctx.fillText(row[c]!, markBox.x + (c + 0.5) * cell, y);
          }
        }
        lctx.globalCompositeOperation = "destination-in";
        lctx.drawImage(mark, markBox.x, markBox.y, markBox.w, markBox.h);
        lctx.globalCompositeOperation = "source-over";
        ctx!.setTransform(1, 0, 0, 1, 0, 0);
        ctx!.drawImage(layer, 0, 0);
        ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      // 3. Rising line across the frame with a short trail.
      if (sy !== null) {
        const trail = ctx!.createLinearGradient(0, sy, 0, sy + 40);
        trail.addColorStop(0, "rgba(230,167,59,0.10)");
        trail.addColorStop(1, "rgba(230,167,59,0)");
        ctx!.fillStyle = trail;
        ctx!.fillRect(0, sy, w, 40);
        ctx!.fillStyle = GOLD_LIGHT;
        ctx!.globalAlpha = 0.75;
        ctx!.fillRect(0, sy, w, 1);
        ctx!.globalAlpha = 1;
      }
    }

    function frame(now: number) {
      if (stopped) return;
      raf = requestAnimationFrame(frame);
      if (!visible || now - last < 33) return; // ~30 fps
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

  const lines = Array.from({ length: 9 }, (_, i) => `${(i + 1) * 10}%`);
  return (
    <div ref={wrapRef} className={`relative aspect-[4/5] w-full ${className ?? ""}`} role="img" aria-label="The Trident mark rendered in binary code, with a gold line rising from the award to the market">
      <div aria-hidden className="absolute inset-0">
        {lines.map((p) => <span key={`v${p}`} className="absolute top-0 bottom-0 w-px bg-line/60" style={{ left: p }} />)}
        {lines.map((p) => <span key={`h${p}`} className="absolute left-0 right-0 h-px bg-line/60" style={{ top: p }} />)}
        <span className="absolute left-0 right-0 h-px bg-ivory-50" style={{ top: `${BASELINE * 100}%` }} />
        <span className="label absolute left-0 text-[10px] text-ivory-70" style={{ top: "90%" }}>A · The award</span>
        <span className="label absolute right-0 top-[3%] text-[10px] text-gold-light">B · The market</span>
      </div>
      {/* Static fallback (no JS / before first frame). */}
      <div aria-hidden className={`absolute inset-x-[16%] top-[14%] bottom-[14%] transition-opacity duration-700 ${ready ? "opacity-0" : "opacity-100"}`}>
        <Image src={MARK} alt="" fill priority sizes="(min-width: 1024px) 340px, 60vw" className="object-contain" />
      </div>
      <canvas ref={canvasRef} aria-hidden className="absolute inset-0" />
    </div>
  );
}
