// Test helper: read the app source for the static accessibility checks (REQ-PD-40, REQ-PD-41).
// Files are read as text with fs (a test may; lib/ may not). Comments are stripped before matching so
// a comment that explains a rule never trips it.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export const ROOT = join(__dirname, "..", "..");

export const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? (name === "node_modules" ? [] : walk(p)) : [p];
  });
}

export type SourceFile = { path: string; raw: string; code: string };

/** Every `.ts` and `.tsx` file under `components/` and `app/`, comments stripped in `code`. */
export function sourceFiles(): SourceFile[] {
  return ["components", "app"]
    .flatMap((d) => walk(join(ROOT, d)))
    .filter((p) => /\.tsx?$/.test(p))
    .sort()
    .map((p) => {
      const raw = readFileSync(p, "utf8");
      return { path: relative(ROOT, p), raw, code: stripComments(raw) };
    });
}

export const readText = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

export type Match = { file: string; text: string; index: number };

/** All matches of `re` (global) over the comment-stripped source. */
export function findAll(files: SourceFile[], re: RegExp): Match[] {
  const out: Match[] = [];
  for (const f of files) {
    for (const m of f.code.matchAll(new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`))) {
      out.push({ file: f.path, text: m[0], index: m.index ?? 0 });
    }
  }
  return out;
}

/**
 * The opening tag that contains `index`: from the nearest preceding `<Name` to its closing `>`,
 * skipping braces and quoted strings. Returns null when no tag encloses the index.
 */
export function enclosingTag(code: string, index: number): string | null {
  const start = code.lastIndexOf("<", index);
  if (start < 0 || !/[A-Za-z]/.test(code[start + 1] ?? "")) return null;
  let depth = 0;
  let quote: string | null = null;
  for (let i = start + 1; i < code.length; i++) {
    const c = code[i];
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") quote = c;
    else if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0 && code[i - 1] !== "=") return code.slice(start, i + 1);
  }
  return null;
}
