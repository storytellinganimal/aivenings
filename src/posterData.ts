// Native poster dimensions (Instagram 4:5), matching the Figma frame.
export const POSTER_W = 1080;
export const POSTER_H = 1350;

export type Word = {
  text: string;
  left: number;
  top: number;
  /** "open" uses the outlined Terminal Grotesque variant. */
  variant: "regular" | "open";
  opacity?: number;
};

// Words transcribed from Figma frame 9:143 ("Instagram post - 7").
// Positions are the raw Figma node coordinates: with the same font and
// `line-height: normal`, `top` maps 1:1 the way Figma's own dev-mode CSS does.
const w = (
  text: string,
  left: number,
  top: number,
  variant: Word["variant"] = "regular"
): Word => ({ text, left, top, variant });

export const WORDS: Word[] = [
  w("///////", 0, -42),
  w("Aivenings", 579, -32),
  w("Aivenings", -148, 197),
  w("Aivenings", -247, 309),
  w("18:30", 716, 570, "open"),
  w("Aivenings", 383, 683, "open"),
  w("Aivenings", 126, 764.66),
  w("Aivenings", 471, 878),
  w("Hamburg", 266, 1124, "open"),
  w("09.07.2026", -10, 1204),
  w("Aivenings", 941, 312),
  { ...w("Aivenings", 928, 1084), opacity: 0 },
  { ...w("Aivenings", 928, 1206), opacity: 0 },
  w("///////", 559, 188),
  w("///////", -334, 1088),
];

export const FONT_SIZE = 180;
export const fontFamilyFor = (variant: Word["variant"]) =>
  variant === "open"
    ? '"Terminal Grotesque Open", "Terminal Grotesque", monospace'
    : '"Terminal Grotesque", monospace';

export const MAX_BUBBLES = 30;

// Deterministic PRNG so a given seed always yields the same starting layout.
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const hsl = (h: number, s: number, l: number) => `hsl(${h} ${s}% ${l}%)`;
