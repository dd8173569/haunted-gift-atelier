// Static purity and brand checks (true-size-viewer design §9). Comments are stripped before matching.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const code = (rel: string) => stripComments(readFileSync(join(ROOT, rel), "utf8"));

const LIB = ["lib/true-size.ts", "lib/size-spec.ts"];
const COMPONENTS = [
  "components/useCalibration.ts",
  "components/CalibrationSlider.tsx",
  "components/SizeOutlines.tsx",
  "components/SizeRuler.tsx",
  "components/TrueSizeViewer.tsx",
];
const LLM = /\b(openai|anthropic|@ai-sdk|langchain|bedrock|generativelanguage|cohere|@google\/genai|ollama)\b|from\s+["']ai["']/i;

const LIB_FORBIDDEN: [string, RegExp][] = [
  ["React import", /from\s+["'](react|react-dom|next)(\/[^"']*)?["']/],
  ["node built-in or fs", /from\s+["'](node:[^"']+|fs|path|os|child_process|crypto)["']|\brequire\(/],
  ["network", /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource/],
  ["clock", /\bDate\b|performance\.now|setTimeout|setInterval/],
  ["randomness", /Math\.random|crypto\.getRandomValues|randomUUID/],
  ["environment", /process\.env|import\.meta/],
  ["window or storage", /\bwindow\b|\bdocument\b|localStorage/],
  ["LLM client", LLM],
  ["catalog file", /catalog\.json|catalog-store/],
];

describe("lib/true-size.ts and lib/size-spec.ts are pure (REQ-TS-31)", () => {
  for (const file of LIB) {
    describe(file, () => {
      it("exists", () => expect(existsSync(join(ROOT, file))).toBe(true));
      for (const [what, re] of LIB_FORBIDDEN) {
        it(`has no ${what}`, () => expect(code(file)).not.toMatch(re));
      }
    });
  }

  it("size-spec reads Product only as a type (no runtime import of lib/catalog)", () => {
    const src = code("lib/size-spec.ts");
    const imports = [...src.matchAll(/^import\s.*from\s+["']([^"']+)["']/gm)].map((m) => m[1]);
    expect(imports.sort()).toEqual(["./catalog", "./true-size"]);
    expect(src).toMatch(/import type \{ Product \} from "\.\/catalog"/);
  });
});

describe("the viewer components (REQ-TS-26, 27, 28)", () => {
  for (const file of COMPONENTS) {
    describe(file, () => {
      const src = () => code(file);
      it("exists and starts with 'use client'", () => {
        expect(existsSync(join(ROOT, file))).toBe(true);
        expect(readFileSync(join(ROOT, file), "utf8").trimStart()).toMatch(/^["']use client["'];?/);
      });
      it("does not import the catalog file or the catalog store", () => {
        expect(src()).not.toMatch(/catalog\.json|catalog-store|from\s+["'][^"']*\/data\//);
      });
      it("makes no network request and imports no LLM client or server-only module", () => {
        expect(src()).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon/);
        expect(src()).not.toMatch(LLM);
        expect(src()).not.toMatch(/server-only|from\s+["']node:|from\s+["'](fs|path)["']/);
      });
      it("has no ad-hoc colour: no #hex, rgb(, hsl(, or arbitrary [#…] / [rgb…] utility", () => {
        expect(src()).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
        expect(src()).not.toMatch(/\b(rgba?|hsla?|oklch)\s*\(/);
        expect(src()).not.toMatch(/\[#|\[(rgb|hsl)/);
      });
      it("never scales, zooms or transforms a drawing", () => {
        expect(src()).not.toMatch(/transform|\bzoom\s*:|\bzoom-|\bscale-|\bscale\(|\bscale\s*:/i);
      });
      it("has no raw <img> (photos go through next/image), no logo, no watermark", () => {
        expect(src()).not.toMatch(/<img\b/);
        expect(src()).not.toMatch(/logo|watermark/i);
      });
      it("has no setState inside an effect (no effect hooks at all)", () => {
        expect(src()).not.toMatch(/\buse(Layout)?Effect\b/);
      });
      it("uses localStorage only in the calibration store", () => {
        if (file === "components/useCalibration.ts") expect(src()).toMatch(/localStorage/);
        else expect(src()).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie/);
      });
    });
  }

  it("photos use next/image with object-contain, never cover or fill-crop", () => {
    const src = code("components/SizeOutlines.tsx");
    expect(src).toMatch(/from "next\/image"/);
    expect(src).toMatch(/object-contain/);
    expect(src).not.toMatch(/object-(cover|fill|none|scale-down)/);
  });

  it("the viewer touches only one storage key", () => {
    expect(code("components/useCalibration.ts")).toMatch(/STORAGE_KEY/);
    expect(code("lib/true-size.ts")).toMatch(/"hga\.trueSize\.v1"/);
  });

  it("the page-level 'true size' wording stays in one place: the viewer's approximate label", () => {
    // Before calibration the only literal 'true size' in the components is the exact label.
    const hits = COMPONENTS.flatMap((f) =>
      [...code(f).matchAll(/"[^"\n]*true size[^"\n]*"/gi)].map((m) => `${f}: ${m[0]}`),
    );
    expect(hits).toEqual([
      'components/TrueSizeViewer.tsx: "Approximate size — calibrate with a card for true size."',
    ]);
  });
});
