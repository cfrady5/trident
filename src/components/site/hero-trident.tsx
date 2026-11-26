/**
 * Hero visual: the supplied Trident mark with a gold horizontal line that
 * periodically rises from the award baseline (A) to the market (B), lighting
 * the mark only while it passes through.
 *
 * Brand notes (BRAND.md): the mark is the supplied artwork, never redrawn; the
 * light sweep is clipped to the mark's own alpha (CSS mask) and is transient,
 * so the logo itself carries no permanent glow, shadow or texture. Motion stops
 * under prefers-reduced-motion. PROPOSAL: animated logo treatment awaits brand
 * owner approval.
 */
import Image from "next/image";

const MARK = "/brand/mark-gold.png";

export function HeroTrident({ className }: { className?: string }) {
  const grid = Array.from({ length: 9 }, (_, i) => `${(i + 1) * 10}%`);
  return (
    <div className={`relative aspect-[4/5] w-full ${className ?? ""}`} role="img" aria-label="The Trident mark, with a gold line rising from the award to the market">
      {/* Technical frame: hairline grid + baseline (decorative) */}
      <div aria-hidden className="absolute inset-0 overflow-hidden">
        {grid.map((p) => <span key={`v${p}`} className="absolute top-0 bottom-0 w-px bg-line" style={{ left: p }} />)}
        {grid.map((p) => <span key={`h${p}`} className="absolute left-0 right-0 h-px bg-line" style={{ top: p }} />)}
        <span className="absolute left-0 right-0 h-px bg-ivory-50" style={{ top: "88%" }} />
        <span className="label absolute left-0 text-[10px] text-ivory-70" style={{ top: "90%" }}>A · The award</span>
        <span className="label absolute right-0 top-[3%] text-[10px] text-gold-light">B · The market</span>

        {/* Rising line across the whole frame */}
        <div className="trident-rise absolute inset-x-0" style={{ top: "88%", height: "86%" }}>
          <span className="absolute inset-x-0 top-0 h-px bg-gold-light/70" />
          <span className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-gold/[0.07] to-transparent" />
        </div>
      </div>

      {/* The mark */}
      <div className="absolute inset-x-[16%] top-[14%] bottom-[14%]">
        <Image src={MARK} alt="" fill priority sizes="(min-width: 1024px) 340px, 60vw" className="object-contain" />
        {/* Light sweep clipped to the mark's own shape */}
        <div aria-hidden className="absolute inset-0 overflow-hidden"
          style={{ WebkitMaskImage: `url(${MARK})`, maskImage: `url(${MARK})`, WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskPosition: "center", maskPosition: "center" }}>
          <div className="trident-rise-mark absolute inset-x-0 top-full h-full">
            <span className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-[#FFF3CC]/70 via-[#FFF3CC]/20 to-transparent" />
            <span className="absolute inset-x-0 top-0 h-[3px] bg-[#FFF6DD]" />
          </div>
        </div>
      </div>
    </div>
  );
}
