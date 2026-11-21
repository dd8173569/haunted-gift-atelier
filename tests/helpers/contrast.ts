// Test helper: WCAG contrast computed from the real token values (REQ-PD-40).
// Reads app/globals.css with fs (a test may; lib/ may not). Alpha is composited over the
// surface, never estimated: CSS blends each sRGB channel linearly with the alpha.
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Rgb = readonly [number, number, number];

export const TOKEN_NAMES = ["pearl", "blush", "champagne", "sage", "gold", "plum"] as const;
export type TokenName = (typeof TOKEN_NAMES)[number];
export type Tokens = Record<TokenName, Rgb>;

export function parseHex(hex: string): Rgb {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`not a 6-digit hex colour: ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Extracts the six `--color-<name>: #xxxxxx` declarations from the stylesheet text. */
export function parseTokens(css: string): Tokens {
  const out: Partial<Record<TokenName, Rgb>> = {};
  for (const name of TOKEN_NAMES) {
    const m = new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(css);
    if (!m) throw new Error(`token --color-${name} not found in the stylesheet`);
    out[name] = parseHex(m[1]);
  }
  return out as Tokens;
}

export function loadTokens(root: string = process.cwd()): Tokens {
  return parseTokens(readFileSync(join(root, "app", "globals.css"), "utf8"));
}

/** `fg` at opacity `alpha` (0 to 1) over the opaque colour `bg`. */
export function composite(fg: Rgb, alpha: number, bg: Rgb): Rgb {
  return [0, 1, 2].map((i) => fg[i] * alpha + bg[i] * (1 - alpha)) as unknown as Rgb;
}

/** WCAG 2.2 relative luminance (threshold 0.03928 as written in the Recommendation). */
export function luminance(c: Rgb): number {
  const lin = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

export function ratio(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export type Surface = { name: string; color: Rgb };

/**
 * The nine surfaces dark text and borders can sit on (design §3): the four pastel tokens, and
 * `blush/50`, `blush/60`, `champagne/40`, `sage/60`, `plum/5` composited over pearl.
 * `plum` is not listed: it is a surface only for `text-pearl` (see PLUM_FILL_SURFACES).
 */
export function surfaces(t: Tokens): Surface[] {
  const over = (name: TokenName, pct: number): Surface => ({
    name: `${name}/${pct}`,
    color: composite(t[name], pct / 100, t.pearl),
  });
  return [
    { name: "pearl", color: t.pearl },
    { name: "blush", color: t.blush },
    { name: "champagne", color: t.champagne },
    { name: "sage", color: t.sage },
    over("blush", 50),
    over("blush", 60),
    over("champagne", 40),
    over("sage", 60),
    over("plum", 5),
  ];
}

/** Filled plum surfaces for `text-pearl`: `bg-plum` and its hover `bg-plum/85` over pearl. */
export function plumFillSurfaces(t: Tokens): Surface[] {
  return [
    { name: "plum", color: t.plum },
    { name: "plum/85", color: composite(t.plum, 0.85, t.pearl) },
  ];
}

/** Ratio of `text-plum/<pct>` on a surface. */
export function plumTextRatio(t: Tokens, pct: number, surface: Surface): number {
  return ratio(composite(t.plum, pct / 100, surface.color), surface.color);
}

/** Ratio of `border-plum/<pct>` against the surface behind it. */
export function plumBorderRatio(t: Tokens, pct: number, surface: Surface): number {
  return ratio(composite(t.plum, pct / 100, surface.color), surface.color);
}

/** Ratio of an opaque token (e.g. gold) used as text on a surface. */
export function tokenTextRatio(t: Tokens, name: TokenName, surface: Surface): number {
  return ratio(t[name], surface.color);
}

export const worst = (values: number[]) => Math.min(...values);
export const best = (values: number[]) => Math.max(...values);
