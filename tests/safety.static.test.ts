// Static purity checks (P-SV-11; REQ-SV-06, 25, 26, 30). Comments are stripped before matching.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const code = (rel: string) => stripComments(readFileSync(join(ROOT, rel), "utf8"));

function files(dir: string, test: (name: string) => boolean): string[] {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return [];
  const out: string[] = [];
  for (const name of readdirSync(abs)) {
    const p = join(abs, name);
    if (statSync(p).isDirectory()) out.push(...files(relative(ROOT, p), test));
    else if (test(name)) out.push(relative(ROOT, p));
  }
  return out;
}

const SAFETY_LIB = ["safety", "safety-rules", "safety-materials", "safety-weight"].map((n) => `lib/${n}.ts`);
const LLM = /\b(openai|anthropic|@ai-sdk|langchain|bedrock|generativelanguage|cohere|@google\/genai|ollama)\b|from\s+["']ai["']/i;

const FORBIDDEN: [string, RegExp][] = [
  ["React import", /from\s+["'](react|react-dom|next)(\/[^"']*)?["']/],
  ["node built-in or fs", /from\s+["'](node:[^"']+|fs|path|os|child_process|crypto)["']|\brequire\(/],
  ["network", /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource/],
  ["clock", /\bDate\b|performance\.now|setTimeout|setInterval/],
  ["randomness", /Math\.random|crypto\.getRandomValues|randomUUID/],
  ["environment", /process\.env|import\.meta/],
  ["LLM client", LLM],
  ["catalog file", /catalog\.json|catalog-store/],
];

describe("lib/safety*.ts are pure (REQ-SV-30)", () => {
  it("the four files exist and no other lib/safety*.ts is unchecked", () => {
    for (const f of SAFETY_LIB) expect(existsSync(join(ROOT, f)), f).toBe(true);
    expect(files("lib", (n) => /^safety.*\.ts$/.test(n)).sort()).toEqual([...SAFETY_LIB].sort());
  });
  for (const f of SAFETY_LIB) {
    for (const [what, re] of FORBIDDEN) {
      it(`${f}: no ${what}`, () => {
        expect(re.exec(code(f))?.[0]).toBeUndefined();
      });
    }
  }
});

describe("matching never reads the verdict (REQ-SV-06)", () => {
  const matching = ["lib/matching.ts", ...files("lib/matching", (n) => n.endsWith(".ts"))];
  it("finds the matching files", () => {
    expect(matching.length).toBeGreaterThan(5);
  });
  for (const f of matching) {
    it(`${f} does not import lib/safety*`, () => {
      expect(/from\s+["'][^"']*safety[^"']*["']/.exec(code(f))?.[0]).toBeUndefined();
    });
  }
});

// The component lands in Wave 4 (T4.1); until then these checks are skipped, not weakened.
describe.skipIf(!existsSync(join(ROOT, "components/SafetyVerdict.tsx")))("components/SafetyVerdict.tsx (REQ-SV-25, 26)", () => {
  const f = "components/SafetyVerdict.tsx";
  it("imports no catalog.json and no computeVerdict, reads no catalog", () => {
    const src = code(f);
    expect(src).not.toMatch(/catalog\.json|catalog-store|computeVerdict|lib\/catalog["']/);
  });
  it("has no ad-hoc colour: no #hex, rgb(, or [# arbitrary value", () => {
    const src = code(f);
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(src).not.toMatch(/\brgba?\(/);
    expect(src).not.toMatch(/\[#/);
  });
  it("has no image or icon", () => {
    expect(code(f)).not.toMatch(/<img|<Image|<svg|next\/image/);
  });
});
