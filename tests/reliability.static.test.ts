// S1: static reliability rules (reliability design §6.3; REQ-REL-23 to 25, 35, 49).
// Source is read as text and comments are stripped, so a comment that explains a rule never trips it.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { ROOT, sourceFiles, stripComments, type SourceFile } from "./helpers/source-scan";

const FALLBACKS = ["app/error.tsx", "app/global-error.tsx", "app/not-found.tsx", "app/loading.tsx"] as const;

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? (name === "node_modules" ? [] : walk(p)) : [p];
  });
}

function filesUnder(dirs: string[]): SourceFile[] {
  return dirs
    .flatMap((d) => walk(join(ROOT, d)))
    .filter((p) => /\.(ts|tsx|mjs|js)$/.test(p))
    .sort()
    .map((p) => {
      const raw = readFileSync(p, "utf8");
      return { path: relative(ROOT, p), raw, code: stripComments(raw) };
    });
}

const appAndComponents = sourceFiles();
const codeOf = (rel: string) => {
  const f = appAndComponents.find((x) => x.path === rel);
  if (!f) throw new Error(`missing file ${rel}`);
  return f;
};

/* ---------- brace matching ---------- */

type Region = { kind: string; start: number; end: number };

function matchClose(code: string, open: number, o: string, c: string): number {
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    if (code[i] === o) depth++;
    else if (code[i] === c && --depth === 0) return i;
  }
  return code.length;
}

/** The body of every `try {}`, `catch {}` / `catch (e) {}`, `finally {}`, and `.then(…)` / `.catch(…)` call. */
export function guardedRegions(code: string): Region[] {
  const out: Region[] = [];
  for (const m of code.matchAll(/\b(try|catch|finally)\s*(?:\([^)]*\))?\s*\{/g)) {
    const open = (m.index ?? 0) + m[0].length - 1;
    out.push({ kind: m[1], start: open, end: matchClose(code, open, "{", "}") });
  }
  for (const m of code.matchAll(/\.(then|catch)\s*\(/g)) {
    const open = (m.index ?? 0) + m[0].length - 1;
    out.push({ kind: `.${m[1]}(`, start: open, end: matchClose(code, open, "(", ")") });
  }
  return out;
}

const SIGNAL = /\b(redirect|permanentRedirect|notFound|forbidden|unauthorized)\s*\(/g;

function signalSites(code: string) {
  const regions = guardedRegions(code);
  return [...code.matchAll(SIGNAL)].map((m) => {
    const index = m.index ?? 0;
    return { name: m[1], index, inside: regions.filter((r) => index > r.start && index < r.end).map((r) => r.kind) };
  });
}

describe("S1 brace matcher (the rule below is only as good as this)", () => {
  it("flags a signal inside try, catch, and .then, and not outside", () => {
    expect(signalSites("try { redirect('/x'); } catch (e) {}")[0].inside).toEqual(["try"]);
    expect(signalSites("try { a(); } catch (e) { notFound(); }")[0].inside).toEqual(["catch"]);
    expect(signalSites("p.then(() => { redirect('/x'); })")[0].inside).toEqual([".then("]);
    expect(signalSites("function f() { if (x) { notFound(); } }")[0].inside).toEqual([]);
    expect(signalSites("try { a(); } catch {} \n redirect('/x');")[0].inside).toEqual([]);
    expect(signalSites("try { if (a) { b(); } } finally { unauthorized(); }")[0].inside).toEqual(["finally"]);
  });
});

/* ---------- boundary files ---------- */

describe("S1 boundary files exist with their directives and exports (REQ-REL-01, 05, 06, 10)", () => {
  it("all four files exist", () => {
    for (const f of FALLBACKS) expect(existsSync(join(ROOT, f)), f).toBe(true);
  });

  it("error.tsx is a Client Component whose default export takes retry", () => {
    const { raw, code } = codeOf("app/error.tsx");
    expect(raw.trimStart().startsWith('"use client"') || raw.trimStart().startsWith("'use client'")).toBe(true);
    expect(code).toMatch(/export default function \w+\s*\(\s*\{[^}]*\bretry\b[^}]*\}/);
    expect(code).not.toMatch(/\breset\b/);
  });

  it("global-error.tsx is a Client Component with its own html and body", () => {
    const { raw, code } = codeOf("app/global-error.tsx");
    expect(raw.trimStart().startsWith('"use client"') || raw.trimStart().startsWith("'use client'")).toBe(true);
    expect(code).toMatch(/export default function/);
    expect(code).toContain('<html lang="en"');
    expect(code).toContain("<body");
  });

  it("not-found.tsx has a default export", () => {
    expect(codeOf("app/not-found.tsx").code).toMatch(/export default (async )?function/);
  });

  it("loading.tsx is a status line marked busy", () => {
    const { code } = codeOf("app/loading.tsx");
    expect(code).toMatch(/export default function/);
    expect(code).toContain('role="status"');
    expect(code).toContain('aria-busy="true"');
  });
});

describe("S1 fallbacks are data-free (REQ-REL-02)", () => {
  const BAD_SPECIFIER = /catalog|data\/|matching|picks-view|piece-view|model-param/;
  it.each(FALLBACKS)("%s imports no catalog module and reads no request or stored data", (rel) => {
    const { code } = codeOf(rel);
    const specifiers = [...code.matchAll(/(?:from|import)\s*["']([^"']+)["']/g)].map((m) => m[1]);
    for (const s of specifiers) expect(s, `${rel} imports ${s}`).not.toMatch(BAD_SPECIFIER);
    expect(code).not.toMatch(/\bsearchParams\b/);
    expect(code).not.toMatch(/\bparams\b/);
    expect(code).not.toMatch(/\blocalStorage\b/);
    expect(code).not.toContain("₹");
    expect(code).not.toMatch(/<img\b|<Image\b/);
  });
});

/* ---------- framework signals, promises, swallowed errors ---------- */

describe("S1 no framework signal inside try, catch, finally, or .then (REQ-REL-23)", () => {
  it("every redirect, notFound, forbidden, unauthorized call in app/ and components/ sits outside", () => {
    for (const f of appAndComponents) {
      for (const s of signalSites(f.code)) {
        expect(s.inside, `${f.path}: ${s.name}() inside ${s.inside.join(", ")}`).toEqual([]);
      }
    }
  });

  it("the two real call sites exist, outside any guard", () => {
    const picks = signalSites(codeOf("app/picks/page.tsx").code).filter((s) => s.name === "redirect");
    expect(picks.length).toBeGreaterThan(0);
    const piece = signalSites(codeOf("app/piece/[sku]/page.tsx").code).filter((s) => s.name === "notFound");
    expect(piece).toHaveLength(1);
    const all = appAndComponents.flatMap((f) => signalSites(f.code).map((s) => `${f.path}:${s.name}`));
    expect([...new Set(all)].sort()).toEqual(["app/picks/page.tsx:redirect", "app/piece/[sku]/page.tsx:notFound"]);
  });
});

describe("S1 no swallowed error (REQ-REL-25)", () => {
  const EMPTY_CATCH = /\bcatch\s*(\([^)]*\))?\s*\{\s*\}/;

  it("no catch block in app/ or components/ has an empty body, comments included", () => {
    for (const f of appAndComponents) expect(f.raw, f.path).not.toMatch(EMPTY_CATCH);
  });

  it("a catch whose only content is a comment is reviewed, and its fallback state is set before the try", () => {
    // M5 T2.2 finding: useCalibration.ts write() has `catch { /* keep the in-memory value ... */ }`. Once
    // comments are stripped the body is empty, but the fallback (`memory = raw`) is assigned before the try,
    // so the UI state is defined and the storage failure is deliberately not shown (REQ-REL-22).
    const commentOnly = appAndComponents.filter((f) => EMPTY_CATCH.test(f.code)).map((f) => f.path);
    expect(commentOnly).toEqual(["components/useCalibration.ts"]);
    const src = codeOf("components/useCalibration.ts").raw;
    const w = /function write\([^)]*\)[^{]*\{/.exec(src)!;
    const body = src.slice(w.index, matchClose(src, w.index + w[0].length - 1, "{", "}"));
    expect(body.indexOf("memory = raw")).toBeGreaterThan(-1);
    expect(body.indexOf("memory = raw")).toBeLessThan(body.indexOf("try"));
    expect(body).toMatch(/catch\s*\{\s*\/\*[^*]+\*\/\s*\}/);
  });

  it("the catch blocks in lib/ are the reviewed ones that return a typed result", () => {
    const sites = filesUnder(["lib"]).flatMap((f) =>
      [...f.code.matchAll(/\bcatch\b/g)].map(() => f.path),
    );
    // Reviewed in M5 T0.2. A new catch in lib/ is a conscious decision: add it here with its reason.
    expect(sites.sort()).toEqual([
      "lib/catalog.ts", // wraps a bad raw field into CatalogBuildError and rethrows
      "lib/model-param.ts", // parseModelParam: undecodable value returns { status: "invalid" }
      "lib/true-size.ts", // parseCalibration: unparsable stored value returns "no calibration"
    ]);
  });

  it("lib/catalog.ts rethrows from its catch", () => {
    const code = filesUnder(["lib"]).find((f) => f.path === "lib/catalog.ts")!.code;
    const m = /\bcatch\s*\([^)]*\)\s*\{/.exec(code)!;
    const body = code.slice(m.index, matchClose(code, m.index + m[0].length - 1, "{", "}"));
    expect(body).toMatch(/\bthrow\b/);
  });
});

describe("S1 promises are handled (REQ-REL-24)", () => {
  it("no .then( or .catch( chain in app/ or components/", () => {
    for (const f of appAndComponents) expect(f.code, f.path).not.toMatch(/\.(then|catch)\s*\(/);
  });

  it("async functions are the reviewed ones: page functions and GiftWrap copyMessage", () => {
    const found = appAndComponents.flatMap((f) =>
      [
        ...f.code.matchAll(/\basync\s+function\s+(\w+)/g),
        ...f.code.matchAll(/\b(?:const|let)\s+(\w+)\s*=\s*async\b/g),
      ].map((m) => `${f.path} ${m[1]}`),
    );
    expect(found.sort()).toEqual(
      [
        "app/atelier/page.tsx AtelierPage",
        "app/find/page.tsx FindPage",
        "app/picks/page.tsx PicksPage",
        "app/piece/[sku]/page.tsx PiecePage",
        "app/piece/[sku]/page.tsx generateMetadata",
        "app/piece/[sku]/page.tsx generateStaticParams",
        "components/GiftWrap.tsx copyMessage",
      ].sort(),
    );
    // No anonymous async arrow either.
    for (const f of appAndComponents) expect(f.code, f.path).not.toMatch(/[(,=]\s*async\s*(\(|\w+\s*=>)/);
  });

  it("every await in components/ sits inside a try with a catch", () => {
    for (const f of appAndComponents.filter((x) => x.path.startsWith("components/"))) {
      const regions = guardedRegions(f.code).filter((r) => r.kind === "try");
      for (const m of f.code.matchAll(/\bawait\b/g)) {
        const i = m.index ?? 0;
        expect(
          regions.some((r) => i > r.start && i < r.end),
          `${f.path}: await outside try`,
        ).toBe(true);
      }
      if (/\bawait\b/.test(f.code)) expect(f.code).toMatch(/\bcatch\b/);
    }
  });
});

/* ---------- no LLM, no network, no env (REQ-REL-49) ---------- */

describe("S1 no LLM code, key, or network call (REQ-REL-49)", () => {
  const scanned = filesUnder(["app", "components", "lib", "data", "scripts"]);

  it("there is no app/api/ and no app/__fault", () => {
    expect(existsSync(join(ROOT, "app", "api"))).toBe(false);
    expect(existsSync(join(ROOT, "app", "__fault"))).toBe(false);
  });

  it("scans a non-trivial set of files", () => {
    expect(scanned.length).toBeGreaterThan(40);
  });

  it("no import names an LLM client", () => {
    const LLM = /openai|anthropic|@google\/(generative-ai|genai)|gemini|langchain|cohere|mistral|^ai$|^ai\//i;
    for (const f of scanned) {
      for (const m of f.code.matchAll(/(?:from|import|require\()\s*["']([^"']+)["']/g)) {
        expect(m[1], `${f.path} imports ${m[1]}`).not.toMatch(LLM);
      }
    }
  });

  it("package.json lists no LLM dependency", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    const names = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(names.filter((n) => /openai|anthropic|generative|gemini|langchain|cohere|mistral|^ai$/i.test(n))).toEqual([]);
  });

  it("no process.env", () => {
    for (const f of scanned) expect(f.code, f.path).not.toMatch(/\bprocess\.env\b/);
  });

  it("no fetch, XMLHttpRequest, WebSocket, or sendBeacon", () => {
    for (const f of scanned) {
      expect(f.code, f.path).not.toMatch(/\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\bsendBeacon\b/);
    }
  });
});

/* ---------- config ---------- */

describe("S1 config (REQ-REL-19, 24, 38)", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { scripts: Record<string, string> };

  it("package.json runs the catalog validator before every build", () => {
    expect(pkg.scripts.prebuild).toBe("npm run validate-catalog");
    expect(pkg.scripts["validate-catalog"]).toBe("tsx scripts/validate-catalog.ts");
  });

  it("package.json has a coverage script that runs Vitest with coverage (REQ-REL-38)", () => {
    expect(pkg.scripts.coverage).toBe("vitest run --coverage");
  });

  it("npm test does not collect coverage", () => {
    expect(pkg.scripts.test).not.toMatch(/coverage/);
  });

  it("vitest.config.ts does not ignore unhandled errors", () => {
    expect(readFileSync(join(ROOT, "vitest.config.ts"), "utf8")).not.toMatch(/dangerouslyIgnoreUnhandledErrors/);
  });
});
