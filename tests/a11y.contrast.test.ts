// Contrast pin, part 1 (REQ-PD-40, 54, 55, 56; design §3). Node environment.
// Part 2 (T3.3, below): a scan of every text, border and surface utility in components/ and app/.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  composite,
  loadTokens,
  luminance,
  parseHex,
  parseTokens,
  plumBorderRatio,
  plumFillSurfaces,
  plumTextRatio,
  ratio,
  surfaces,
  tokenTextRatio,
  type Rgb,
} from "./helpers/contrast";
import { findAll, sourceFiles } from "./helpers/source-scan";

const SEED = 20261124;
const tokens = loadTokens();
const S = surfaces(tokens);
const at = (fn: (s: (typeof S)[number]) => number) => S.map(fn);
const lo = (v: number[]) => Math.min(...v);
const hi = (v: number[]) => Math.max(...v);

const BLACK: Rgb = [0, 0, 0];
const WHITE: Rgb = [255, 255, 255];

describe("token parsing", () => {
  it("reads the six colour tokens from app/globals.css", () => {
    expect(tokens).toEqual({
      pearl: parseHex("#faf7f2"),
      blush: parseHex("#f7e8e4"),
      champagne: parseHex("#f5edd8"),
      sage: parseHex("#dce8dd"),
      gold: parseHex("#c9a227"),
      plum: parseHex("#3d2c3a"),
    });
  });
  it("throws when a token is missing", () => {
    expect(() => parseTokens("@theme { --color-pearl: #ffffff; }")).toThrow(/--color-blush/);
  });
  it("rejects a non-hex value", () => {
    expect(() => parseHex("rgb(0,0,0)")).toThrow();
  });
  it("lists nine surfaces and two plum fills", () => {
    expect(S.map((s) => s.name)).toEqual([
      "pearl",
      "blush",
      "champagne",
      "sage",
      "blush/50",
      "blush/60",
      "champagne/40",
      "sage/60",
      "plum/5",
    ]);
    expect(plumFillSurfaces(tokens).map((s) => s.name)).toEqual(["plum", "plum/85"]);
  });
});

describe("the helper reproduces known WCAG values", () => {
  it("black on white is 21:1", () => {
    expect(ratio(BLACK, WHITE)).toBeCloseTo(21, 2);
  });
  it("#767676 on white is 4.54:1", () => {
    expect(Math.abs(ratio(parseHex("#767676"), WHITE) - 4.54)).toBeLessThanOrEqual(0.01);
  });
  it("luminance of black is 0 and of white is 1", () => {
    expect(luminance(BLACK)).toBe(0);
    expect(luminance(WHITE)).toBeCloseTo(1, 10);
  });
  it("alpha 0 gives the background and alpha 0.5 the midpoint", () => {
    expect(composite(BLACK, 0, WHITE)).toEqual(WHITE);
    expect(composite(BLACK, 0.5, WHITE)).toEqual([127.5, 127.5, 127.5]);
  });
});

describe("P-PD-1 contrast helper properties (REQ-PD-54)", () => {
  const arbRgb = fc.tuple(fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 })) as fc.Arbitrary<Rgb>;
  const run = (p: fc.IProperty<unknown>) => fc.assert(p, { seed: SEED, numRuns: 500 });

  it("is symmetric", () => {
    run(fc.property(arbRgb, arbRgb, (a, b) => ratio(a, b) === ratio(b, a)));
  });
  it("lies between 1 and 21", () => {
    run(
      fc.property(arbRgb, arbRgb, (a, b) => {
        const r = ratio(a, b);
        return r >= 1 && r <= 21 + 1e-9;
      }),
    );
  });
  it("is 1 for equal colours", () => {
    run(fc.property(arbRgb, (c) => ratio(c, c) === 1));
  });
  it("composite at alpha 1 returns the foreground, and at alpha 0 the background", () => {
    run(
      fc.property(arbRgb, arbRgb, (fg, bg) => {
        const one = composite(fg, 1, bg);
        const zero = composite(fg, 0, bg);
        return one.every((v, i) => v === fg[i]) && zero.every((v, i) => v === bg[i]);
      }),
    );
  });
  it("composite stays inside the channel range", () => {
    run(
      fc.property(arbRgb, arbRgb, fc.double({ min: 0, max: 1, noNaN: true }), (fg, bg, a) =>
        composite(fg, a, bg).every((v) => v >= 0 && v <= 255),
      ),
    );
  });
});

describe("the token table of design §3 (0.01 tolerance)", () => {
  // [alpha, worst ratio, best ratio]. Worst is on sage, best on pearl, for every row.
  const TEXT: [number, number, number][] = [
    [100, 10.27, 12.13],
    [90, 7.84, 8.99],
    [85, 6.81, 7.7],
    [80, 5.92, 6.6],
    [75, 5.15, 5.67],
    [70, 4.5, 4.89],
    [65, 3.94, 4.23],
    [60, 3.46, 3.69],
    [50, 2.71, 2.84],
  ];
  it.each(TEXT)("text-plum/%i: worst %f, best %f", (alpha, worst, best) => {
    const r = at((s) => plumTextRatio(tokens, alpha, s));
    expect(Math.abs(lo(r) - worst)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(hi(r) - best)).toBeLessThanOrEqual(0.01);
    expect(r.indexOf(lo(r))).toBe(3); // sage
    expect(r.indexOf(hi(r))).toBe(0); // pearl
  });

  it("text-gold: 1.92 on sage to 2.26 on pearl", () => {
    const r = at((s) => tokenTextRatio(tokens, "gold", s));
    expect(Math.abs(lo(r) - 1.92)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(hi(r) - 2.26)).toBeLessThanOrEqual(0.01);
  });
  it("text-pearl on bg-plum is 12.13 and on bg-plum/85 is 7.70", () => {
    const [plum, plum85] = plumFillSurfaces(tokens);
    expect(Math.abs(ratio(tokens.pearl, plum.color) - 12.13)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(ratio(tokens.pearl, plum85.color) - 7.7)).toBeLessThanOrEqual(0.01);
  });
  it("text-plum on bg-gold is 5.36", () => {
    expect(Math.abs(ratio(tokens.plum, tokens.gold) - 5.36)).toBeLessThanOrEqual(0.01);
  });
  it("pearl against blush is 1.12 (a decorative step, not information)", () => {
    expect(Math.abs(ratio(tokens.pearl, tokens.blush) - 1.12)).toBeLessThanOrEqual(0.01);
  });

  // Border rows the design gives as a range or a single figure. Measured against the nine surfaces.
  it("border-plum/60 measures 3.46 to 3.69", () => {
    const r = at((s) => plumBorderRatio(tokens, 60, s));
    expect(Math.abs(lo(r) - 3.46)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(hi(r) - 3.69)).toBeLessThanOrEqual(0.01);
  });
  it("border-plum/30 measures 1.74 to 1.78 (design §3 quotes 1.76) and /15 measures 1.30 to 1.31", () => {
    const r30 = at((s) => plumBorderRatio(tokens, 30, s));
    expect(Math.abs(lo(r30) - 1.74)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(hi(r30) - 1.78)).toBeLessThanOrEqual(0.01);
    const r15 = at((s) => plumBorderRatio(tokens, 15, s));
    expect(Math.abs(lo(r15) - 1.3)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(hi(r15) - 1.31)).toBeLessThanOrEqual(0.01);
  });
  it("border-plum/70 measures 4.50 to 4.89", () => {
    const r = at((s) => plumBorderRatio(tokens, 70, s));
    expect(Math.abs(lo(r) - 4.5)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(hi(r) - 4.89)).toBeLessThanOrEqual(0.01);
  });
});

describe("P-PD-2 text alpha policy (REQ-PD-55)", () => {
  it.each([75, 80, 85, 90, 95, 100])("text-plum/%i reaches 4.5:1 on every surface", (alpha) => {
    for (const s of S) expect(plumTextRatio(tokens, alpha, s), `${alpha} on ${s.name}`).toBeGreaterThanOrEqual(4.5);
  });
  it.each([60, 65, 70])("text-plum/%i is below 4.55 on at least one surface, so the floor is not arbitrary", (alpha) => {
    expect(lo(at((s) => plumTextRatio(tokens, alpha, s)))).toBeLessThan(4.55);
  });
  it("text-plum/60 fails 4.5 on every surface and text-plum/75 passes on every surface", () => {
    expect(at((s) => plumTextRatio(tokens, 60, s)).every((r) => r < 4.5)).toBe(true);
    expect(at((s) => plumTextRatio(tokens, 75, s)).every((r) => r >= 4.5)).toBe(true);
  });
  it("text-plum/50 and text-gold fail on every surface", () => {
    expect(hi(at((s) => plumTextRatio(tokens, 50, s)))).toBeLessThan(3);
    expect(hi(at((s) => tokenTextRatio(tokens, "gold", s)))).toBeLessThan(3);
  });
  it("the muted text of the out-of-stock card (text-plum/75 on plum/5) is at least 4.5:1", () => {
    const plum5 = S.find((s) => s.name === "plum/5")!;
    expect(plumTextRatio(tokens, 75, plum5)).toBeGreaterThanOrEqual(4.5);
  });
  it("text-pearl on bg-plum and bg-plum/85 reaches 7:1", () => {
    for (const f of plumFillSurfaces(tokens)) expect(ratio(tokens.pearl, f.color), f.name).toBeGreaterThanOrEqual(7);
  });
  it("the focus outline (solid plum) reaches 3:1 on every surface, at least 10:1 in fact", () => {
    for (const s of S) expect(ratio(tokens.plum, s.color), s.name).toBeGreaterThanOrEqual(10);
  });
});

describe("P-PD-3 border alpha policy (REQ-PD-56)", () => {
  it.each([60, 70, 80, 90, 100])("border-plum/%i reaches 3:1 on every surface", (alpha) => {
    for (const s of S) expect(plumBorderRatio(tokens, alpha, s), `${alpha} on ${s.name}`).toBeGreaterThanOrEqual(3);
  });
  it.each([15, 30, 40, 50])("border-plum/%i is below 3:1 on every surface", (alpha) => {
    for (const s of S) expect(plumBorderRatio(tokens, alpha, s), `${alpha} on ${s.name}`).toBeLessThan(3);
  });
});

/* ------------------------------------------------------------------------------------------------
   Part 2 (REQ-PD-25, REQ-PD-26, REQ-PD-40): every text, border and surface utility the source uses.
   The scan does not know which surface a given text sits on, so each role is checked against all
   nine surfaces: a role that passes everywhere can be used anywhere. Colour is computed from the
   token values in app/globals.css with alpha composited over the surface, never estimated.
   ------------------------------------------------------------------------------------------------ */

const files = sourceFiles();
// A utility may carry variant prefixes (`hover:`, `focus:`, `sm:`); the lookbehind stops a match inside
// a longer name (`border-plum` inside `bg-border-plum`) and the lookahead stops `text-plum` inside `text-plum-x`.
const util = (prefix: string, names: string) =>
  new RegExp(String.raw`(?<![\w-])(?:[a-z0-9-]+:)*${prefix}-(${names})(?:/(\d+))?(?![\w/-])`, "g");

const roles = (prefix: string, names: string) =>
  findAll(files, util(prefix, names)).map((m) => {
    const r = /-(plum|pearl|gold|blush|champagne|sage)(?:\/(\d+))?$/.exec(m.text)!;
    return { ...m, token: r[1] as "plum" | "pearl" | "gold" | "blush" | "champagne" | "sage", alpha: r[2] === undefined ? 100 : Number(r[2]) };
  });

const TOKENS = "plum|pearl|gold|blush|champagne|sage";
const textRoles = roles("text", TOKENS);
const borderRoles = roles("border", TOKENS);
const bgRoles = roles("bg", TOKENS);

describe("source scan finds the roles it is meant to check", () => {
  it("sees text, border and surface utilities in the source", () => {
    expect(files.length).toBeGreaterThan(20);
    expect(textRoles.length).toBeGreaterThan(30);
    expect(borderRoles.length).toBeGreaterThan(10);
    expect(bgRoles.length).toBeGreaterThan(10);
  });
  it("reads the real utilities (text-plum, text-plum/75, text-pearl, border-plum/60)", () => {
    const seen = new Set(textRoles.map((r) => `${r.token}/${r.alpha}`));
    for (const k of ["plum/100", "plum/75", "plum/80", "pearl/100"]) expect(seen.has(k), k).toBe(true);
    expect(borderRoles.some((r) => r.token === "plum" && r.alpha === 60)).toBe(true);
  });
});

describe("REQ-PD-25: every text role in the source reaches AA on every surface", () => {
  it("uses only text-plum and text-pearl (gold is decorative, never text)", () => {
    const bad = textRoles.filter((r) => r.token !== "plum" && r.token !== "pearl");
    expect(bad.map((r) => `${r.file}: ${r.text}`)).toEqual([]);
  });

  it("every text-plum/N reaches 4.5:1 on all nine surfaces (computed)", () => {
    const plum = textRoles.filter((r) => r.token === "plum");
    expect(plum.length).toBeGreaterThan(20);
    const failures: string[] = [];
    for (const r of plum) {
      for (const s of S) {
        const v = plumTextRatio(tokens, r.alpha, s);
        if (v < 4.5) failures.push(`${r.file}: ${r.text} on ${s.name} = ${v.toFixed(2)}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("every text-pearl sits in a file that has a plum fill, and pearl on plum and plum/85 reaches 7:1", () => {
    const pearl = textRoles.filter((r) => r.token === "pearl");
    expect(pearl.length).toBeGreaterThan(0);
    for (const r of pearl) {
      expect(r.alpha, `${r.file}: ${r.text} is not a translucent text`).toBe(100);
      const file = files.find((f) => f.path === r.file)!;
      expect(file.code, `${r.file}: text-pearl needs a bg-plum surface`).toMatch(/(?<![\w-])(?:[a-z0-9-]+:)*bg-plum(?![\w/-])|bg-plum\/85/);
    }
    for (const f of plumFillSurfaces(tokens)) expect(ratio(tokens.pearl, f.color), f.name).toBeGreaterThanOrEqual(7);
  });

  it("the lowest alpha used in the source is the policy floor of 75 or higher", () => {
    const alphas = textRoles.filter((r) => r.token === "plum").map((r) => r.alpha);
    expect(Math.min(...alphas)).toBeGreaterThanOrEqual(75);
  });
});

describe("REQ-PD-26: every border role in the source", () => {
  // Decorative dividers are exempt (REQ-PD-26): plum/10 and plum/15 only separate rows whose
  // meaning is already in text. Everything else, control or drawing, must reach 3:1.
  const DECORATIVE = new Set([10, 15]);

  it("uses only plum for borders", () => {
    expect(borderRoles.filter((r) => r.token !== "plum").map((r) => `${r.file}: ${r.text}`)).toEqual([]);
  });

  it("only decorative dividers sit below alpha 60", () => {
    const low = borderRoles.filter((r) => r.alpha < 60 && !DECORATIVE.has(r.alpha));
    expect(low.map((r) => `${r.file}: ${r.text}`)).toEqual([]);
  });

  it("every non-decorative border-plum/N reaches 3:1 on all nine surfaces (computed)", () => {
    const failures: string[] = [];
    for (const r of borderRoles.filter((x) => !DECORATIVE.has(x.alpha))) {
      for (const s of S) {
        const v = plumBorderRatio(tokens, r.alpha, s);
        if (v < 3) failures.push(`${r.file}: ${r.text} on ${s.name} = ${v.toFixed(2)}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("the decorative alphas really are below 3:1 (the exemption is not hiding a pass)", () => {
    for (const a of DECORATIVE) expect(hi(at((s) => plumBorderRatio(tokens, a, s)))).toBeLessThan(3);
  });
});

describe("surfaces the source paints are the surfaces the computation covers", () => {
  // Surfaces the text can sit on: design §3 (nine surfaces) plus the filled plum buttons.
  const TEXT_SURFACES = new Set([
    "pearl/100",
    "blush/100",
    "champagne/100",
    "sage/100",
    "blush/50",
    "blush/60",
    "champagne/40",
    "sage/60",
    "plum/5",
    "plum/100",
    "plum/85",
  ]);
  // Decorative fills carry no text: the gold rules and motes, the plum/15 bar track, and the
  // plum ruler ticks. They are exempt from the text computation.
  const DECORATIVE_FILL = (r: { token: string; alpha: number }) => r.token === "gold" || (r.token === "plum" && r.alpha === 15);

  it("every bg-<token>/N is a surface of the computation or a decorative fill", () => {
    const unknown = bgRoles
      .filter((r) => !DECORATIVE_FILL(r) && !TEXT_SURFACES.has(`${r.token}/${r.alpha}`))
      .map((r) => `${r.file}: ${r.text}`);
    expect(unknown).toEqual([]);
  });
});
