import Image from "next/image";

/**
 * Supplied Trident artwork only (extracted unaltered from Brand Kit v1.0 via
 * the v2.1 guide). Never retype or redraw the wordmark. Raster only until vector
 * masters are supplied (brand guide p.32, open decision 02).
 *
 * Versions (guide p.17): gold on Black (primary), ivory on Carbon (reversed),
 * black on Ivory/Gold. Minimum: lockup 120px wide, mark 24px tall.
 */
type Variant = "lockup-gold" | "lockup-ivory" | "lockup-black" | "mark-gold" | "mark-black";

const SIZES: Record<Variant, [number, number]> = {
  "lockup-gold": [787, 563],
  "lockup-ivory": [787, 563],
  "lockup-black": [787, 563],
  "mark-gold": [370, 453],
  "mark-black": [370, 453],
};

export function Logo({ variant = "mark-gold", width, className, priority }: { variant?: Variant; width: number; className?: string; priority?: boolean }) {
  const [w, h] = SIZES[variant];
  const min = variant.startsWith("lockup") ? 120 : 20;
  const finalWidth = Math.max(width, min);
  return (
    <Image src={`/brand/${variant}.png`} alt="Trident" width={finalWidth} height={Math.round((finalWidth * h) / w)} className={className} priority={priority} />
  );
}
