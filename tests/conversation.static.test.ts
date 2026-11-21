// Grep tests (conversation design §10.2). Comments are stripped before matching.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const NEW_LIB = ["conversation", "model-param", "picks-view", "browse"].map((n) => `lib/${n}.ts`);

const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

function files(dir: string, exts: string[]): string[] {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return [];
  const out: string[] = [];
  for (const name of readdirSync(abs)) {
    const p = join(abs, name);
    if (statSync(p).isDirectory()) out.push(...files(relative(ROOT, p), exts));
    else if (exts.some((e) => name.endsWith(e))) out.push(relative(ROOT, p));
  }
  return out;
}
const code = (rel: string) => stripComments(readFileSync(join(ROOT, rel), "utf8"));

const LLM = /\b(openai|anthropic|@ai-sdk|langchain|bedrock|generativelanguage|cohere|@google\/genai|ollama)\b|from\s+["']ai["']/i;

const FORBIDDEN_IN_PURE_LIB: [string, RegExp][] = [
  ["React import", /from\s+["'](react|react-dom|next)(\/[^"']*)?["']/],
  ["react JSX/hook", /\buse(State|Effect|Reducer|Memo|Ref)\b/],
  ["node built-in or fs", /from\s+["'](node:[^"']+|fs|path|os|child_process|crypto)["']|\brequire\(/],
  ["network", /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource/],
  ["clock", /\bDate\b|performance\.now|setTimeout|setInterval/],
  ["randomness", /Math\.random|crypto\.getRandomValues|randomUUID/],
  ["environment", /process\.env|import\.meta/],
  ["window/document", /\b(window|document|localStorage|sessionStorage)\b/],
  ["LLM client", LLM],
  ["catalog file", /catalog\.json|catalog-store/],
];

describe("the four new lib/ files are pure (REQ-CV-43, 46)", () => {
  it("exist", () => {
    for (const f of NEW_LIB) expect(existsSync(join(ROOT, f)), f).toBe(true);
  });
  for (const f of NEW_LIB) {
    for (const [what, re] of FORBIDDEN_IN_PURE_LIB) {
      it(`${f}: no ${what}`, () => {
        expect(re.exec(code(f))?.[0]).toBeUndefined();
      });
    }
  }
  it("no new lib file redefines RecipientModel", () => {
    for (const f of NEW_LIB) expect(code(f)).not.toMatch(/interface\s+RecipientModel\b|type\s+RecipientModel\s*=/);
  });
});

describe("components/ and app/ (bite as later waves add files)", () => {
  const ui = [...files("components", [".ts", ".tsx"]), ...files("app", [".ts", ".tsx"])];

  it("no #hex, rgb(), hsl() or arbitrary colour value", () => {
    for (const f of ui) {
      const c = code(f);
      expect(/#[0-9a-fA-F]{3,8}\b/.exec(c)?.[0], f).toBeUndefined();
      expect(/\b(rgba?|hsla?|oklch)\s*\(/.exec(c)?.[0], f).toBeUndefined();
      expect(/-\[(#|rgb|hsl)/.exec(c)?.[0], f).toBeUndefined();
    }
  });
  it("components do not import catalog.json or catalog-store (REQ-CV-47)", () => {
    for (const f of files("components", [".ts", ".tsx"])) {
      expect(/catalog\.json|catalog-store/.exec(code(f))?.[0], f).toBeUndefined();
    }
  });
  it("no LLM client import in lib/, components/ or app/ (REQ-CV-43)", () => {
    for (const f of [...files("lib", [".ts", ".tsx"]), ...ui]) {
      expect(LLM.exec(code(f))?.[0], f).toBeUndefined();
    }
  });
  it("no app/api/ directory (REQ-CV-43)", () => {
    expect(existsSync(join(ROOT, "app/api"))).toBe(false);
  });
  it("no <img> of a logo (REQ-CV-48)", () => {
    for (const f of ui) expect(/<img[^>]*logo/i.exec(code(f))?.[0], f).toBeUndefined();
  });
});
