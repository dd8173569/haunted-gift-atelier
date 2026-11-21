// Copy alignment (REQ-SV-29): the site never says a piece "is safe" or that the atelier "proves" it.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");

function walk(dir: string, test: (name: string) => boolean): string[] {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return [];
  const out: string[] = [];
  for (const name of readdirSync(abs)) {
    const p = join(abs, name);
    if (statSync(p).isDirectory()) out.push(...walk(relative(ROOT, p), test));
    else if (test(name)) out.push(relative(ROOT, p));
  }
  return out;
}

const SCANNED = [
  ...walk("app", (n) => n.endsWith(".tsx")),
  ...walk("components", (n) => n.endsWith(".tsx")),
  ...walk("lib", (n) => /^safety.*\.ts$/.test(n)),
  "README.md",
];

describe("landing and card copy (REQ-SV-29)", () => {
  it("scans the expected files", () => {
    expect(SCANNED).toEqual(expect.arrayContaining([
      "app/page.tsx",
      "app/layout.tsx",
      "components/SafetyVerdict.tsx",
      "lib/safety.ts",
      "README.md",
    ]));
  });

  for (const f of SCANNED) {
    it(`${f}: no "safe"/"unsafe" and no "prove it"/"proves it"`, () => {
      const src = readFileSync(join(ROOT, f), "utf8");
      expect(/\b(un)?safe\b/i.exec(src)?.[0]).toBeUndefined();
      expect(/prove it|proves it/i.exec(src)?.[0]).toBeUndefined();
    });
  }

  it("the landing page keeps the trust-strip sentence and uses the fit-check framing", () => {
    const page = readFileSync(join(ROOT, "app/page.tsx"), "utf8");
    expect(page).toContain("Safety notes are fit checks, not certifications.");
    expect(page).toContain("plain-language fit check");
  });
});
