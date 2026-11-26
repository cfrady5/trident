"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Arrow } from "@/components/ui/button";
import { pillars } from "@/content/site";
import { DEFAULT_PRESET, presetParams, type PresetKey, type TridentParams } from "./config";
import { TridentController } from "./controller";
import { TuningPanel } from "./TuningPanel";

/**
 * Homepage hero: the official Trident mark built entirely from binary
 * characters (canvas), with the copy rendered as ordinary HTML so it is
 * visible immediately and never waits on the animation.
 *
 * The canvas is decorative (aria-hidden, pointer-events: none). If it cannot
 * run, a static fallback of the official mark is shown in its place.
 */
export function BinaryTridentHero({ preset = DEFAULT_PRESET, tuning = false }: { preset?: PresetKey; tuning?: boolean }) {
  const hostRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const ctrlRef = useRef<TridentController | null>(null);
  const [params, setParams] = useState<TridentParams>(() => presetParams(preset));
  const [paramsFor, setParamsFor] = useState(preset);
  const [failed, setFailed] = useState(false);

  // A new preset resets the parameters (derived during render, no effect needed).
  if (paramsFor !== preset) { setParamsFor(preset); setParams(presetParams(preset)); }

  useEffect(() => {
    const canvas = canvasRef.current, host = hostRef.current, slot = slotRef.current;
    if (!canvas || !host || !slot) return;
    const ctrl = new TridentController({ canvas, host, slot, params: presetParams(preset), onStatus: (s) => setFailed(s === "failed") });
    ctrlRef.current = ctrl;
    if (process.env.NODE_ENV !== "production") (window as unknown as { __trident?: TridentController }).__trident = ctrl;
    return () => { ctrl.destroy(); ctrlRef.current = null; };
    // The controller is created once; parameter changes are applied live below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { ctrlRef.current?.setParams(params); }, [params]);
  useEffect(() => { ctrlRef.current?.replay(); }, [preset]);

  return (
    <section ref={hostRef} className="relative isolate overflow-hidden bg-black" aria-labelledby="hero-title" data-testid="binary-trident-hero">
      <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute inset-0 -z-10 h-full w-full" />
      {/* Legibility shading where the copy sits (mobile: top; desktop: left). */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-black/60 via-transparent to-transparent to-30% lg:bg-gradient-to-r lg:from-black/70 lg:via-black/25 lg:via-35% lg:to-transparent lg:to-50%" />

      <div className="mx-auto grid max-w-[1440px] grid-cols-1 px-5 pt-14 sm:px-8 md:pt-20 lg:min-h-[calc(100svh-72px)] lg:grid-cols-[45fr_55fr] lg:grid-rows-[1fr_auto] lg:gap-x-6 lg:px-12 lg:pb-[17vh] lg:pt-10">
        <div className="lg:col-start-1 lg:row-start-1 lg:self-end">
          <p className="flex items-center gap-3 text-[0.8rem] font-medium uppercase tracking-[0.18em] text-ivory sm:text-[0.9rem]">
            <span aria-hidden className="h-px w-7 bg-gold" />Technology commercialization &amp; creative agency
          </p>
          <h1 id="hero-title" className="mt-7 font-display text-[3.4rem] font-semibold leading-[0.96] tracking-[-0.03em] sm:text-[5rem] lg:text-[clamp(5rem,7vw,7rem)]">
            Beyond<br />the <span className="bg-gradient-to-br from-gold-light via-gold to-gold-deep bg-clip-text text-transparent">Award.</span>
          </h1>
          <p className="mt-7 max-w-[34rem] text-body-l text-ivory md:text-[1.3rem] md:leading-[1.5]">
            Your technology has earned validation. Now build the positioning, presence and demand it needs to compete in the market.
          </p>
          <div className="mt-9 flex flex-col gap-4 sm:flex-row">
            <Link href="/assessment" className="inline-flex h-14 items-center justify-center gap-3 whitespace-nowrap rounded-md bg-gradient-to-br from-gold-light via-gold to-gold-deep px-5 text-[15px] font-semibold text-black transition-[filter] hover:brightness-110 sm:px-7 sm:text-base">
              Assess Your Commercial Readiness <Arrow />
            </Link>
            <Link href="/marketplace" className="inline-flex h-14 items-center justify-center whitespace-nowrap rounded-md border border-ivory/30 px-5 text-[15px] font-semibold text-ivory transition-colors hover:border-gold-light hover:text-gold-light sm:px-7 sm:text-base">
              Explore Our Capabilities
            </Link>
          </div>
        </div>

        {/* The mark's layout slot: the canvas places the binary mark inside this box. */}
        <div ref={slotRef} aria-hidden className="relative h-[min(104vw,520px)] sm:h-[560px] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:h-auto lg:min-h-[520px]">
          {failed && (
            // Static fallback: the official mark, unaltered.
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/brand/mark-gold.png" alt="" className="absolute left-1/2 top-1/2 h-[78%] w-auto -translate-x-1/2 -translate-y-1/2 opacity-90" />
          )}
        </div>

        <ul className="mt-20 grid max-w-2xl grid-cols-1 gap-6 pb-16 sm:grid-cols-3 lg:col-start-1 lg:row-start-2 lg:mt-14 lg:pb-0" aria-label="The method">
          {pillars.map((p) => (
            <li key={p.key} className="border-l border-gold pl-5">
              <Link href={`/services/${p.key}`} className="font-display text-[1.25rem] font-semibold hover:text-gold-light">{p.name}</Link>
              <p className="mt-1 text-body text-ivory-70">{p.line}</p>
            </li>
          ))}
        </ul>
      </div>

      {tuning && <TuningPanel params={params} onChange={setParams} onReplay={() => ctrlRef.current?.replay()} />}
    </section>
  );
}
