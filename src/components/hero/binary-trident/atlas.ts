/**
 * Glyph atlas: "0" and "1" pre-rasterized in IBM Plex Mono in each approved
 * palette color (plus soft glow variants), so the renderer draws sprites
 * instead of shaping text thousands of times per frame.
 */

/** Palette tiers, darkest to brightest (BRAND.md colors only). */
export const TIERS = ["#996304", "#C5851B", "#E6A73B", "#FBD474", "#F7F3EA"] as const; // Bronze, Gold Deep, Gold, Gold Light, Ivory
export const TIER = { BRONZE: 0, GOLD_DEEP: 1, GOLD: 2, GOLD_LIGHT: 3, IVORY: 4 } as const;

export const FONT_PX = 48;
export const CELL_W = 36;
export const CELL_H = 52;
export const GLOW_PAD = 18;

export interface Atlas {
  glyphs: HTMLCanvasElement;
  glows: HTMLCanvasElement;
  scale: number; // device pixels per atlas unit
}

export function buildAtlas(dpr: number): Atlas {
  const scale = Math.min(2, Math.max(1, dpr));
  const glyphs = document.createElement("canvas");
  glyphs.width = Math.ceil(CELL_W * 2 * scale);
  glyphs.height = Math.ceil(CELL_H * TIERS.length * scale);
  const g = glyphs.getContext("2d")!;
  g.scale(scale, scale);
  g.font = `500 ${FONT_PX}px "IBM Plex Mono", Consolas, monospace`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  TIERS.forEach((color, t) => {
    g.fillStyle = color;
    for (let c = 0; c < 2; c++) g.fillText(String(c), c * CELL_W + CELL_W / 2, t * CELL_H + CELL_H / 2 + 2);
  });

  const gw = CELL_W + GLOW_PAD * 2, gh = CELL_H + GLOW_PAD * 2;
  const glows = document.createElement("canvas");
  glows.width = Math.ceil(gw * 2 * scale);
  glows.height = Math.ceil(gh * TIERS.length * scale);
  const gg = glows.getContext("2d")!;
  gg.scale(scale, scale);
  gg.filter = "blur(7px)";
  gg.font = `700 ${FONT_PX}px "IBM Plex Mono", Consolas, monospace`;
  gg.textAlign = "center";
  gg.textBaseline = "middle";
  TIERS.forEach((color, t) => {
    gg.fillStyle = color;
    for (let c = 0; c < 2; c++) gg.fillText(String(c), c * gw + gw / 2, t * gh + gh / 2 + 2);
  });
  return { glyphs, glows, scale };
}
