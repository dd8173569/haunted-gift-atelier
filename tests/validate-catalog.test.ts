import { spawnSync } from "node:child_process";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createFixture, fixtureCatalog, type Fixture, type Json } from "./helpers/catalog-fixture";

const REPO = path.resolve(__dirname, "..");
let fx: Fixture;
beforeAll(() => {
  fx = createFixture();
});
afterAll(() => fx.cleanup());

function run(catalog: unknown, changelog?: string) {
  fx.write(catalog, changelog);
  const r = spawnSync(
    process.execPath,
    [path.join(REPO, "node_modules", "tsx", "dist", "cli.mjs"), "scripts/validate-catalog.ts", "--root", fx.root],
    { cwd: REPO, encoding: "utf8" },
  );
  return { code: r.status, out: r.stdout, err: r.stderr };
}

const mutated = (f: (c: Json & { products: Json[] }) => void) => {
  const c = fixtureCatalog();
  f(c);
  return c;
};

describe("validate-catalog CLI", () => {
  it("passes a valid fixture", () => {
    const r = run(fixtureCatalog());
    expect(r.err).toBe("");
    expect(r.code).toBe(0);
    expect(r.out).toContain("CATALOG OK: 22 products, version 1.0.0, 2 warning(s)");
  });

  const cases: [string, (c: Json & { products: Json[] }) => void, string][] = [
    ["duplicate SKU", (c) => { c.products[1].sku = c.products[0].sku; }, "REQ-CD-01"],
    ["bad URL", (c) => { c.products[0].url = "https://example.com/x"; }, "REQ-CD-04"],
    ["mrp_inr set", (c) => { c.products[0].mrp_inr = 4999; }, "REQ-CD-03"],
    ["missing image", (c) => { c.products[0].image_file = "NOPE-0000.png"; }, "REQ-CD-05"],
    ["wrong count", (c) => { c.count = 21; }, "REQ-CD-09"],
    ["missing version", (c) => { delete c.version; }, "REQ-CD-22"],
    ["non-semver version", (c) => { c.version = "1.0"; }, "REQ-CD-22"],
  ];
  for (const [name, f, req] of cases) {
    it(`fails on ${name} with ${req}`, () => {
      const r = run(mutated(f));
      expect(r.code).not.toBe(0);
      expect(r.err).toContain(`FAIL [${req}]`);
      expect(r.err).toMatch(/CATALOG VALIDATION FAILED: \d+ error\(s\)/);
      expect(r.out).not.toContain("CATALOG OK");
    });
  }

  it("fails when the changelog heading is missing", () => {
    const r = run(fixtureCatalog(), "# Catalog changelog\n\n## v0.9.0 — 2026-01-01\n");
    expect(r.code).not.toBe(0);
    expect(r.err).toContain("FAIL [REQ-CD-23]");
  });
});
