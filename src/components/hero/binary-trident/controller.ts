/**
 * Responsive behaviour and lifecycle: loads the mark mask and font, sizes the
 * canvas (DPR capped), lays the mark into its slot, pauses offscreen or when
 * the tab is hidden, honours reduced motion, tracks a fine pointer, and cleans
 * everything up on destroy.
 */
import { buildAtlas, type Atlas } from "./atlas";
import { deviceScale, GEOMETRY_KEYS, type TridentParams } from "./config";
import { TridentEngine, type Layout } from "./engine";
import { buildMask, generateTargets, MARK_ASPECT, MARK_SRC, type MaskData } from "./geometry";

export interface ControllerOptions {
  canvas: HTMLCanvasElement;
  /** Element the canvas covers (pointer events are read here). */
  host: HTMLElement;
  /** Element whose box the mark fills. */
  slot: HTMLElement;
  params: TridentParams;
  /** Called when the canvas is ready, or when it cannot run (show the static fallback). */
  onStatus?: (s: "ready" | "failed") => void;
  /** Disable the clock (static formed frame). Defaults to prefers-reduced-motion. */
  reducedMotion?: boolean;
}

const maskCache = new Map<string, Promise<MaskData>>();
function loadMask(src: string): Promise<MaskData> {
  let m = maskCache.get(src);
  if (!m) {
    m = new Promise<MaskData>((resolve, reject) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => { try { resolve(buildMask(img)); } catch (e) { reject(e); } };
      img.onerror = () => reject(new Error("mark artwork failed to load"));
      img.src = src;
    });
    maskCache.set(src, m);
  }
  return m;
}

export class TridentController {
  private o: ControllerOptions;
  private engine: TridentEngine | null = null;
  private mask: MaskData | null = null;
  private atlas: Atlas | null = null;
  private params: TridentParams;
  private raf = 0;
  private last = 0;
  private visible = true;
  private onscreen = true;
  private destroyed = false;
  private reduced: boolean;
  private fine: boolean;
  private countScale = 1;
  private cleanup: (() => void)[] = [];

  constructor(o: ControllerOptions) {
    this.o = o;
    this.params = { ...o.params };
    this.reduced = o.reducedMotion ?? matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
    void this.init();
  }

  private async init() {
    const ctx = this.o.canvas.getContext("2d");
    if (!ctx) { this.o.onStatus?.("failed"); return; }
    try {
      const [mask] = await Promise.all([
        loadMask(MARK_SRC),
        document.fonts?.load('500 48px "IBM Plex Mono"').catch(() => undefined),
      ]);
      if (this.destroyed) return;
      this.mask = mask;
    } catch {
      this.o.onStatus?.("failed");
      return;
    }
    const { particles, dprCap } = deviceScale(window.innerWidth);
    this.countScale = particles;
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    this.atlas = buildAtlas(dpr);
    this.engine = new TridentEngine(this.o.canvas, generateTargets(this.mask, this.params, particles), this.params, this.atlas);
    this.resize();

    const ro = new ResizeObserver(() => this.resize());
    ro.observe(this.o.host);
    this.cleanup.push(() => ro.disconnect());

    const io = new IntersectionObserver(([e]) => { this.onscreen = !!e?.isIntersecting; this.kick(); }, { threshold: 0 });
    io.observe(this.o.host);
    this.cleanup.push(() => io.disconnect());

    const vis = () => { this.visible = document.visibilityState === "visible"; this.kick(); };
    document.addEventListener("visibilitychange", vis);
    this.cleanup.push(() => document.removeEventListener("visibilitychange", vis));

    if (this.fine && !this.reduced) {
      const host = this.o.host;
      const move = (e: PointerEvent) => {
        if (e.pointerType !== "mouse") return;
        const r = this.o.canvas.getBoundingClientRect();
        this.engine?.setPointer(e.clientX - r.left, e.clientY - r.top, true);
      };
      const leave = () => this.engine?.setPointer(NaN, NaN, false);
      host.addEventListener("pointermove", move, { passive: true });
      host.addEventListener("pointerleave", leave);
      this.cleanup.push(() => { host.removeEventListener("pointermove", move); host.removeEventListener("pointerleave", leave); });
    }

    this.o.onStatus?.("ready");
    if (this.reduced) this.engine.drawAt(9000);
    else this.kick();
  }

  private layout(): Layout {
    const c = this.o.canvas.getBoundingClientRect();
    const s = this.o.slot.getBoundingClientRect();
    const width = c.width, height = c.height;
    const compact = width < 1024;
    const scale = this.params.tridentScale;
    const sx = s.left - c.left, sy = s.top - c.top;
    let h = Math.min(s.height * (compact ? 0.92 : 0.96), (s.width * (compact ? 0.86 : 0.86)) / MARK_ASPECT) * scale;
    h = Math.max(120, h);
    const w = h * MARK_ASPECT;
    const x = sx + (s.width - w) / 2;
    const landH = Math.max(110, height * (compact ? 0.16 : 0.19));
    // Desktop: the base of the mark rests on the landscape; phones: centred in its slot.
    const y = compact ? sy + (s.height - h) * 0.5 : Math.max(sy, Math.min(sy + (s.height - h) * 0.5, height - landH * 0.82 - h));
    // Phones: a short band directly under the mark, ending above the content that follows.
    const landTop = compact ? y + h * 0.88 : height - landH;
    const landBottom = compact ? Math.min(height, sy + s.height + 64) : height;
    return {
      width, height, mark: { x, y, w, h }, landTop, landBottom, compact,
      landFadeFrom: compact ? -1 : width * 0.3, landFadeTo: compact ? 0 : width * 0.58,
    };
  }

  private resize() {
    if (!this.engine) return;
    const c = this.o.canvas;
    const r = c.getBoundingClientRect();
    const { dprCap } = deviceScale(window.innerWidth);
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    const W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr));
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    this.engine.setLayout(this.layout(), dpr);
    if (this.reduced || !this.raf) this.engine.drawAt(this.reduced ? 9000 : this.engine.time);
  }

  private kick() {
    if (this.reduced || this.destroyed || !this.engine) return;
    const run = this.visible && this.onscreen;
    if (run && !this.raf) {
      this.last = performance.now();
      const loop = (now: number) => {
        // Clamp dt so returning from a pause continues smoothly instead of jumping.
        const dt = Math.min(now - this.last, 48);
        this.last = now;
        this.engine!.frame(dt);
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    } else if (!run && this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  /** Live parameter updates (dev tuning). Geometry keys rebuild the particles. */
  setParams(next: TridentParams) {
    const prev = this.params;
    this.params = { ...next };
    if (!this.engine || !this.mask) return;
    const rebuild = GEOMETRY_KEYS.some((k) => prev[k] !== next[k]);
    if (rebuild) this.engine.setTargets(generateTargets(this.mask, this.params, this.countScale));
    this.engine.setParams(this.params);
    this.engine.setLayout(this.layout(), Math.min(window.devicePixelRatio || 1, deviceScale(window.innerWidth).dprCap));
    if (rebuild && !this.reduced) this.engine.replay();
    if (this.reduced || !this.raf) this.engine.drawAt(this.reduced ? 9000 : this.engine.time);
  }

  replay() { this.engine?.replay(); if (this.reduced) this.engine?.drawAt(9000); }

  /** QA: jump the clock to a given time (ms). */
  seek(ms: number) { if (this.engine) { this.engine.time = ms; if (!this.raf) this.engine.drawAt(ms); } }

  destroy() {
    this.destroyed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.cleanup.forEach((f) => f());
    this.cleanup = [];
    this.engine = null;
  }
}
