// Static checks (gift-presentation design §9, P-GP-10). Comments are stripped before matching.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { CARD_FADE_MS, WRAP_REVEAL_MS } from "../lib/gift-message";

const ROOT = join(__dirname, "..");
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const code = (rel: string) => stripComments(readFileSync(join(ROOT, rel), "utf8"));

const LIB = ["lib/gift-message.ts", "lib/piece-view.ts"];
const NEW_UI = [
  "components/GiftWrap.tsx",
  "components/PieceFacts.tsx",
  "app/piece/[sku]/page.tsx",
  "app/piece/[sku]/not-found.tsx",
];
const LLM = /\b(openai|anthropic|@ai-sdk|langchain|bedrock|generativelanguage|cohere|@google\/genai|ollama)\b|from\s+["']ai["']/i;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? (name === "node_modules" ? [] : walk(p)) : [p];
  });
}

describe("lib/gift-message.ts and lib/piece-view.ts are pure (REQ-GP-28)", () => {
  const FORBIDDEN: [string, RegExp][] = [
    ["React import", /from\s+["'](react|react-dom|next)(\/[^"']*)?["']/],
    ["node built-in", /from\s+["'](node:[^"']+|fs|path|os|child_process|crypto)["']|\brequire\(/],
    ["network", /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource/],
    ["clock", /\bDate\b|performance\.now|setTimeout|setInterval/],
    ["randomness", /Math\.random|crypto\.getRandomValues|randomUUID/],
    ["environment", /process\.env|import\.meta/],
    ["window or storage", /\bwindow\b|\bdocument\b|localStorage|sessionStorage|navigator/],
    ["LLM client", LLM],
    ["catalog file", /catalog\.json|catalog-store/],
  ];
  for (const file of LIB) {
    describe(file, () => {
      it("exists", () => expect(existsSync(join(ROOT, file))).toBe(true));
      for (const [what, re] of FORBIDDEN) {
        it(`has no ${what}`, () => expect(code(file)).not.toMatch(re));
      }
    });
  }
});

describe("components/GiftWrap.tsx (REQ-GP-16, 19, 27, 28)", () => {
  const src = () => code("components/GiftWrap.tsx");
  it("is a client component", () => {
    expect(readFileSync(join(ROOT, "components/GiftWrap.tsx"), "utf8").trimStart()).toMatch(/^["']use client["'];?/);
  });
  it.each([
    ["fetch", /\bfetch\b/],
    ["XMLHttpRequest", /XMLHttpRequest/],
    ["localStorage", /localStorage/],
    ["sessionStorage", /sessionStorage/],
    ["a form", /<form/i],
    ["an img", /<img\b/i],
    ["next/image", /next\/image|ProductPhoto/],
    ["the catalog file or store", /catalog\.json|catalog-store/],
    ["an LLM client", LLM],
    ["a sendBeacon call", /sendBeacon/],
  ])("has no %s", (_n, re) => {
    expect(src()).not.toMatch(re);
  });
});

describe("the detail page (REQ-GP-01, 13)", () => {
  const page = () => code("app/piece/[sku]/page.tsx");
  it("never calls match() and never imports the matching entry point", () => {
    expect(page()).not.toMatch(/\bmatch\s*\(/);
    // lib/matching/templates (formatInr, labels) is allowed; the matching entry point is not.
    expect(page()).not.toMatch(/from\s+["'][^"']*lib\/matching["']/);
  });
  it("awaits params, then searchParams, and calls notFound() outside a try/catch", () => {
    const p = page();
    expect(p).toMatch(/await params/);
    expect(p).toMatch(/await searchParams/);
    expect(p.indexOf("await params")).toBeLessThan(p.indexOf("notFound()"));
    expect(p.indexOf("notFound()")).toBeLessThan(p.indexOf("await searchParams"));
    expect(p).not.toMatch(/\btry\s*\{/);
    expect(p).not.toMatch(/redirect\(/);
  });
  it("exports generateStaticParams and does not set dynamicParams", () => {
    expect(page()).toMatch(/export async function generateStaticParams/);
    expect(page()).not.toMatch(/dynamicParams/);
  });
  it("uses the catalog only through lib/catalog-store", () => {
    expect(page()).not.toMatch(/catalog\.json/);
  });
});

describe("the wrap CSS and the constants (REQ-GP-15, 16; P-GP-4)", () => {
  const css = readFileSync(join(ROOT, "app/globals.css"), "utf8");
  const ms = (v: string) => Number(v.replace("ms", ""));
  const rule = (cls: string) => {
    const m = new RegExp(`\\.${cls}\\s*\\{\\s*animation:\\s*([^;]+);`).exec(css);
    if (!m) throw new Error(`no rule for .${cls}`);
    const tokens = m[1].trim().split(/\s+/);
    const times = tokens.filter((t) => /^\d+ms$/.test(t)); // duration first, then the optional delay
    return { name: tokens[0], duration: ms(times[0]), delay: ms(times[1] ?? "0ms") };
  };

  it("the three box animations all end by WRAP_REVEAL_MS", () => {
    for (const cls of ["wrap-ribbon", "wrap-lid", "wrap-box-out"]) {
      const r = rule(cls);
      expect(r.delay + r.duration, cls).toBeLessThanOrEqual(WRAP_REVEAL_MS);
      expect(r.name).toBe(cls);
    }
    // The last one ends exactly at the reveal, so nothing runs after it.
    const ends = ["wrap-ribbon", "wrap-lid", "wrap-box-out"].map((c) => rule(c).delay + rule(c).duration);
    expect(Math.max(...ends)).toBe(WRAP_REVEAL_MS);
  });
  it("the card fade fits CARD_FADE_MS and starts at once", () => {
    const r = rule("wrap-card-in");
    expect(r.delay).toBe(0);
    expect(r.duration).toBeLessThanOrEqual(CARD_FADE_MS);
  });
  it("all four are switched off for reduced motion", () => {
    const block = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/.exec(css.slice(css.indexOf("wrap-ribbon")));
    expect(block).not.toBeNull();
    for (const cls of ["wrap-ribbon", "wrap-lid", "wrap-box-out", "wrap-card-in"]) {
      expect(block![1]).toContain(`.${cls}`);
    }
    expect(block![1]).toMatch(/animation:\s*none/);
  });
  it("the wrap keyframes touch only transform and opacity, and add no colour", () => {
    const start = css.indexOf("Gift wrap reveal");
    expect(start).toBeGreaterThan(-1);
    const added = css.slice(start);
    expect(added).not.toMatch(/#[0-9a-f]{3,8}\b|\b(rgba?|hsla?|oklch)\s*\(|\bcolor\b|background/i);
    for (const m of added.matchAll(/@keyframes wrap-[a-z-]+\s*\{([\s\S]*?)\n\}/g)) {
      const props = [...m[1].matchAll(/([a-z-]+)\s*:/g)].map((x) => x[1]);
      for (const p of props) expect(["transform", "opacity"], m[0]).toContain(p);
    }
  });
});

describe("brand and boundaries (REQ-GP-27, 29)", () => {
  it("no ad-hoc colour in components/ or app/ (css excluded)", () => {
    const files = [...walk(join(ROOT, "components")), ...walk(join(ROOT, "app"))].filter((f) => /\.(tsx?|jsx?)$/.test(f));
    expect(files.length).toBeGreaterThan(10);
    for (const f of files) {
      const c = stripComments(readFileSync(f, "utf8"));
      const name = relative(ROOT, f);
      expect(/#[0-9a-fA-F]{3,8}\b/.exec(c)?.[0], name).toBeUndefined();
      expect(/\b(rgba?|hsla?|oklch)\s*\(/.exec(c)?.[0], name).toBeUndefined();
      expect(/-\[(#|rgb|hsl)/.exec(c)?.[0], name).toBeUndefined();
    }
  });
  it("there is no app/api directory", () => {
    expect(existsSync(join(ROOT, "app/api"))).toBe(false);
  });
  it("no LLM client import in the new files", () => {
    for (const f of [...LIB, ...NEW_UI]) expect(code(f), f).not.toMatch(LLM);
  });
  it("no discount wording in the new components", () => {
    for (const f of NEW_UI) expect(code(f), f).not.toMatch(/% off|save ₹|MRP|was ₹|line-through/i);
  });
  it("the new components add no logo, watermark or image file reference", () => {
    for (const f of NEW_UI) {
      expect(code(f), f).not.toMatch(/logo|watermark|\.svg|\.png|\.jpe?g|\.webp/i);
    }
  });
});
