// Test helper: a throwaway repo root with a catalog, images and a changelog.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import catalogData from "../../data/catalog.json";

const REPO = path.resolve(__dirname, "..", "..");
const REAL_PNGS = ["TPN-1149.png", "TPN-1459.png"];

export type Json = Record<string, unknown>;

/** Deep clone of the real catalog with image_file renamed to <SKU>.png. */
export function fixtureCatalog(): Json & { products: Json[] } {
  const c = structuredClone(catalogData) as unknown as Json & { products: Json[] };
  c.products.forEach((p) => {
    p.image_file = `${String(p.sku)}.png`;
  });
  return c;
}

export interface Fixture {
  root: string;
  write: (catalog: unknown, changelog?: string) => void;
  cleanup: () => void;
}

/** Real PNGs are copied (hard-linked when possible) once per SKU. */
export function createFixture(): Fixture {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "catalog-fixture-"));
  fs.mkdirSync(path.join(root, "data"), { recursive: true });
  fs.mkdirSync(path.join(root, "public", "catalog"), { recursive: true });
  const base = fixtureCatalog();
  base.products.forEach((p, i) => {
    const src = path.join(REPO, "public", "catalog", REAL_PNGS[i % REAL_PNGS.length]);
    const dst = path.join(root, "public", "catalog", String(p.image_file));
    try {
      fs.linkSync(src, dst);
    } catch {
      fs.copyFileSync(src, dst);
    }
  });
  const write = (catalog: unknown, changelog?: string) => {
    fs.writeFileSync(path.join(root, "data", "catalog.json"), JSON.stringify(catalog, null, 2));
    fs.writeFileSync(
      path.join(root, "data", "catalog-changelog.md"),
      changelog ?? "# Catalog changelog\n\n## v1.0.0 — 2026-11-21\n\nInitial import.\n",
    );
  };
  write(base);
  return { root, write, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}
