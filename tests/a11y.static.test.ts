// Static source rules for accessibility and motion (REQ-PD-41, REQ-PD-27, P-PD-9). Node environment.
// Reads components/ and app/ as text, with comments stripped. The numeric contrast of each colour
// role lives in tests/a11y.contrast.test.ts; this file checks the class rules around it.
import { describe, expect, it } from "vitest";
import { CARD_FADE_MS, WRAP_REVEAL_MS } from "../lib/gift-message";
import { enclosingTag, findAll, readText, sourceFiles, stripComments } from "./helpers/source-scan";

const files = sourceFiles();
const where = (ms: { file: string; text: string }[]) => ms.map((m) => `${m.file}: ${m.text}`);
const css = stripComments(readText("app/globals.css"));
// A utility may carry variant prefixes (`sm:`, `hover:`); the lookbehind stops a match inside a longer name.
const U = (body: string) => new RegExp(String.raw`(?<![\w-])(?:[a-z0-9-]+:)*${body}(?![\w-])`, "g");

describe("the scan sees the source", () => {
  it("reads components/ and app/ (the routes, the layout and the components)", () => {
    const paths = files.map((f) => f.path);
    for (const p of ["app/layout.tsx", "app/page.tsx", "app/find/page.tsx", "components/ActionButton.tsx", "components/GiftWrap.tsx"]) {
      expect(paths).toContain(p);
    }
    expect(files.length).toBeGreaterThanOrEqual(30);
  });
});

describe("text and border colour classes (REQ-PD-02, REQ-PD-26)", () => {
  it("no text-gold anywhere", () => {
    expect(where(findAll(files, U("text-gold(?:/\\d+)?")))).toEqual([]);
  });
  it("no text alpha below 75 (text-plum/N and text-pearl/N)", () => {
    const low = findAll(files, U("text-(?:plum|pearl)/(\\d+)")).filter((m) => Number(m.text.split("/").pop()) < 75);
    expect(where(low)).toEqual([]);
  });
  it("no text-plum/50, /55, /60, /65 or /70 (the retired muted roles)", () => {
    expect(where(findAll(files, U("text-plum/(?:50|55|60|65|70)")))).toEqual([]);
  });
  it("every border-plum/N is a decorative divider (10, 15) or at least 60", () => {
    const bad = findAll(files, U("border-(?:[trblxy]-)?plum/(\\d+)")).filter((m) => {
      const n = Number(m.text.split("/").pop());
      return n !== 10 && n !== 15 && n < 60;
    });
    expect(where(bad)).toEqual([]);
  });
  it("no border-plum/30 (the retired control border)", () => {
    expect(where(findAll(files, U("border-plum/30")))).toEqual([]);
  });
  it("no colour literal in a component or route: no #hex, rgb(), hsl(), oklch() or arbitrary colour value", () => {
    const hits = findAll(files, /(?<![\w&])#[0-9a-fA-F]{6}\b|(?<![\w&])#[0-9a-fA-F]{3}\b(?![\w-])|\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(|\b(?:bg|text|border|fill|stroke|shadow|ring|outline)-\[(?:#|rgb|hsl|oklch)/);
    expect(where(hits)).toEqual([]);
  });
});

describe("focus outline (REQ-PD-19)", () => {
  it("outline-none appears only on tabIndex={-1} programmatic targets", () => {
    const offenders: string[] = [];
    let seen = 0;
    for (const f of files) {
      for (const m of f.code.matchAll(U("outline-none"))) {
        seen += 1;
        const tag = enclosingTag(f.code, m.index ?? 0);
        if (tag === null) offenders.push(`${f.path}: outline-none outside a JSX tag`);
        else if (!/tabIndex=\{-1\}/.test(tag)) offenders.push(`${f.path}: ${tag.slice(0, 80).replace(/\s+/g, " ")}`);
      }
    }
    expect(seen, "the scan found the allowed targets (main, step headings, gift heading)").toBeGreaterThanOrEqual(8);
    expect(offenders).toEqual([]);
  });
  it("no outline: none and no outline-0, outline-hidden or focus:outline-none in a component", () => {
    expect(where(findAll(files, /outline-(?:0|hidden)\b|outline:\s*none|outlineStyle/))).toEqual([]);
  });
  it("the global :focus-visible rule is an outline of 2px solid plum with an offset", () => {
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline:\s*var\(--focus-ring-width\)\s+solid\s+var\(--color-plum\)/);
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline-offset:\s*var\(--focus-ring-offset\)/);
    expect(css).toMatch(/--focus-ring-width:\s*2px/);
    expect(css).toMatch(/--focus-ring-offset:\s*2px/);
  });
  it("the global CSS never removes an outline", () => {
    expect(css).not.toMatch(/outline:\s*(?:none|0)\b/);
  });
});

describe("source order is visual order (REQ-PD-18)", () => {
  it("no order-*, flex-row-reverse, flex-col-reverse or grid-flow-dense", () => {
    expect(where(findAll(files, U("order-(?:\\d+|first|last|none|\\[[^\\]]*\\])")))).toEqual([]);
    expect(where(findAll(files, U("flex-(?:row|col)-reverse")))).toEqual([]);
    expect(where(findAll(files, U("grid-flow-(?:row-|col-)?dense")))).toEqual([]);
  });
  it("no positive tabIndex", () => {
    expect(where(findAll(files, /tabIndex=\{\s*[1-9]/))).toEqual([]);
    expect(where(findAll(files, /tabindex="[1-9]/i))).toEqual([]);
  });
});

describe("P-PD-9 motion is covered by the global reduce rule (REQ-PD-27)", () => {
  const reduce = (() => {
    const m = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{\s*\*,\s*\*::before,\s*\*::after\s*\{([^}]*)\}([^@]*)\}/.exec(css);
    return m ? { universal: m[1], rest: m[2] } : null;
  })();

  it("globals.css has the universal rule on *, *::before and *::after", () => {
    expect(reduce, "the universal @media (prefers-reduced-motion: reduce) block is missing").not.toBeNull();
    expect(reduce!.universal).toMatch(/animation:\s*none\s*!important/);
    expect(reduce!.universal).toMatch(/transition:\s*none\s*!important/);
    expect(reduce!.universal).toMatch(/scroll-behavior:\s*auto\s*!important/);
  });
  it("the same block hides the motes", () => {
    expect(reduce!.rest).toMatch(/\.mote\s*\{\s*display:\s*none/);
  });
  it("the only !important declarations in the stylesheet are the three in the reduce rule", () => {
    // An !important animation elsewhere would out-rank the reduce rule's neutralising of it.
    expect(css.match(/!important/g)).toHaveLength(3);
    expect(reduce!.universal.match(/!important/g)).toHaveLength(3);
  });
  it("every animation and transition in the stylesheet is a normal declaration the rule overrides", () => {
    const decls = [...css.matchAll(/(?<![\w-])(animation|transition)\s*:\s*([^;]+);/g)].map((m) => `${m[1]}: ${m[2].trim()}`);
    const nonReduce = decls.filter((d) => !/none/.test(d));
    expect(nonReduce.length).toBeGreaterThanOrEqual(5); // mote-drift and the four wrap classes
    for (const d of nonReduce) expect(d, d).not.toMatch(/!important/);
  });
  it("every transition utility and animate- utility in the source is therefore neutralised (counted, not exempted)", () => {
    // The universal rule needs no per-class edit, so the check is that it exists (above) and that the
    // utilities in use are plain CSS ones, not a JavaScript-driven animation.
    const used = findAll(files, U("(?:transition(?:-[a-z]+)?|animate-[a-z0-9-]+|duration-\\d+|ease-[a-z-]+|delay-\\d+)"));
    for (const u of used) expect(u.text, u.file).toMatch(/transition|animate-|duration-|ease-|delay-/);
    expect(used.length).toBeGreaterThan(0);
  });
  it("no inline animation or transition style (the mote stagger delay is the one allowed property)", () => {
    // app/page.tsx staggers the motes with `animationDelay`. The animation itself is the .mote class,
    // which the reduce rule neutralises (and hides). No other animation or transition property is allowed inline.
    const inline = findAll(files, /\b(?:animation(?!Delay\b)[A-Za-z]*|transition[A-Za-z]*)\s*:/);
    expect(where(inline)).toEqual([]);
    const delays = findAll(files, /\banimationDelay\b/);
    expect(delays.map((d) => d.file)).toEqual(["app/page.tsx"]);
    expect(where(findAll(files, /style=["'][^"']*(?:animation|transition)/))).toEqual([]);
  });
  it("no requestAnimationFrame, Web Animations API or smooth scrolling", () => {
    expect(where(findAll(files, /requestAnimationFrame|cancelAnimationFrame/))).toEqual([]);
    expect(where(findAll(files, /\.animate\s*\(/))).toEqual([]);
    expect(where(findAll(files, /behavior\s*:\s*["']smooth["']/))).toEqual([]);
    expect(where(findAll(files, U("scroll-smooth")))).toEqual([]);
    expect(where(findAll(files, /scroll(?:IntoView|To|By)\s*\([^)]*smooth/))).toEqual([]);
  });
  it("the wrap keyframes still end by WRAP_REVEAL_MS and the card fades in over CARD_FADE_MS", () => {
    const rule = (cls: string) => {
      const m = new RegExp(String.raw`\.${cls}\s*\{\s*animation:\s*[\w-]+\s+(\d+)ms\s+[\w-]+(?:\s+(\d+)ms)?[^;]*;`).exec(css);
      if (!m) throw new Error(`no .${cls} animation declaration`);
      return { duration: Number(m[1]), delay: Number(m[2] ?? 0) };
    };
    const box = ["wrap-ribbon", "wrap-lid", "wrap-box-out"].map(rule);
    const ends = box.map((r) => r.delay + r.duration);
    expect(Math.max(...ends)).toBe(WRAP_REVEAL_MS); // tight: the last box animation ends exactly at the reveal
    for (const e of ends) expect(e).toBeLessThanOrEqual(WRAP_REVEAL_MS);
    const card = rule("wrap-card-in");
    expect(card.delay).toBe(0);
    expect(card.duration).toBe(CARD_FADE_MS);
  });
  it("the existing wrap-specific reduce rule is still there", () => {
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{\s*\.wrap-ribbon,\s*\.wrap-lid,\s*\.wrap-box-out,\s*\.wrap-card-in\s*\{\s*animation:\s*none;/);
  });
  it("GiftWrap still reads matchMedia in the click handler (REQ-GP-15)", () => {
    expect(stripComments(readText("components/GiftWrap.tsx"))).toMatch(/matchMedia\(\s*["']\(prefers-reduced-motion:\s*reduce\)["']\s*\)/);
  });
});

describe("document basics (REQ-PD-31)", () => {
  const layout = () => readText("app/layout.tsx");
  it('the root layout sets lang="en"', () => {
    expect(layout()).toMatch(/<html\s[^>]*lang="en"/);
  });
  it("no maximum-scale and no user-scalable anywhere in app/ or components/", () => {
    expect(where(findAll(files, /maximum-scale|maximumScale|user-scalable|userScalable/))).toEqual([]);
  });
  it("no viewport export that could limit zoom", () => {
    expect(where(findAll(files, /export\s+(?:const|function)\s+(?:viewport|generateViewport)\b/))).toEqual([]);
  });
  it("the skip link is the first child of body, outside the Suspense", () => {
    expect(stripComments(layout())).toMatch(/<body[^>]*>\s*<SkipLink\s*\/>\s*(?:\{\s*\}\s*)?<Suspense/); // a JSX comment strips to {}
  });
});

describe("images and buttons (REQ-PD-06, REQ-PD-15, REQ-PD-29)", () => {
  it("no raw <img in components/ or app/", () => {
    expect(where(findAll(files, /<img\b/i))).toEqual([]);
  });
  it("every <button is ActionButton's own or a chip's", () => {
    const raw = findAll(files, /<button\b/);
    expect(raw.map((m) => m.file).sort()).toEqual(["components/ActionButton.tsx", "components/ChipGroup.tsx"]);
  });
  it("no element is made a button by role and no div or span carries a click handler", () => {
    expect(where(findAll(files, /role=["']button["']/))).toEqual([]);
    const clicks = findAll(files, /<(?:div|span|li|p|section)\b[^>]*\bonClick\b/);
    expect(where(clicks)).toEqual([]);
  });
  it("ActionButton is used by the components that had hand-copied buttons", () => {
    for (const f of ["components/GiftWrap.tsx", "components/TrueSizeViewer.tsx", "components/CalibrationSlider.tsx", "components/SizeRuler.tsx", "components/Conversation.tsx", "components/RecipientCard.tsx", "components/CatalogGrid.tsx"]) {
      expect(stripComments(readText(f)), f).toMatch(/<ActionButton\b/);
    }
  });
  it("no logo or watermark image: the wordmark is text in the header", () => {
    expect(where(findAll(files, /logo|watermark/i))).toEqual([]);
    expect(stripComments(readText("components/SiteHeader.tsx"))).toMatch(/>\s*Tiny Tiaraa\s*</);
  });
});
