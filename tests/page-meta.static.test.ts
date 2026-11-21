// Purity guard for lib/page-meta.ts (REQ-PD-51), in the style of tests/conversation.static.test.ts.
// Comments are stripped before matching.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const FILE = "lib/page-meta.ts";
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const code = stripComments(readFileSync(join(__dirname, "..", FILE), "utf8"));

const LLM = /\b(openai|anthropic|@ai-sdk|langchain|bedrock|generativelanguage|cohere|@google\/genai|ollama)\b|from\s+["']ai["']/i;

const FORBIDDEN: [string, RegExp][] = [
  ["React or Next import", /from\s+["'](react|react-dom|next)(\/[^"']*)?["']/],
  ["react hook", /\buse(State|Effect|Reducer|Memo|Ref)\b/],
  ["node built-in or fs", /from\s+["'](node:[^"']+|fs|path|os|child_process|crypto)["']|\brequire\(/],
  ["network", /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource/],
  ["clock", /\bDate\b|performance\.now|setTimeout|setInterval/],
  ["randomness", /Math\.random|crypto\.getRandomValues|randomUUID/],
  ["environment", /process\.env|import\.meta/],
  ["window or document", /\b(window|document|localStorage|sessionStorage)\b/],
  ["LLM client", LLM],
  ["catalog file", /catalog\.json|catalog-store/],
];

describe("lib/page-meta.ts is pure (REQ-PD-51)", () => {
  for (const [what, re] of FORBIDDEN) {
    it(`no ${what}`, () => {
      expect(re.exec(code)?.[0]).toBeUndefined();
    });
  }
  it("imports only the catalog types and the two label maps", () => {
    const imports = [...code.matchAll(/import\s+(type\s+)?([^;]+?)\s+from\s+["']([^"']+)["']/g)].map((m) => ({
      typeOnly: Boolean(m[1]),
      names: m[2].replace(/[{}]/g, "").split(",").map((s) => s.trim()).filter(Boolean),
      from: m[3],
    }));
    expect(imports).toEqual([
      { typeOnly: true, names: ["Product"], from: "./catalog" },
      { typeOnly: false, names: ["AGE_GROUP_LABEL", "METAL_LABEL"], from: "./matching/templates" },
    ]);
  });
  it("contains no price or colour literal", () => {
    expect(/₹|#[0-9a-fA-F]{3,8}\b/.exec(code)?.[0]).toBeUndefined();
  });
});
