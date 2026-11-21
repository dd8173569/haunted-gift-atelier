// C1: a catalog that fails at import time (REQ-REL-20). The raw JSON is mocked in memory with a duplicated
// SKU (the P-CD-7 fault); data/catalog.json on disk is never written. This cannot happen after a build that
// passed `prebuild` (the JSON is bundled); it covers a corrupted deployment artefact and nothing more.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import realRaw from "../data/catalog.json";

const CATALOG_PATH = join(__dirname, "..", "data", "catalog.json");
const diskBefore = readFileSync(CATALOG_PATH, "utf8");

const corrupted = () => {
  const copy = JSON.parse(JSON.stringify(realRaw)) as { products: { sku: string }[] };
  copy.products[1].sku = copy.products[0].sku;
  return { copy, dup: copy.products[0].sku };
};

afterEach(() => {
  vi.doUnmock("../data/catalog.json");
  vi.resetModules();
});

describe("catalog failure at runtime (REQ-REL-20)", () => {
  it("importing lib/catalog-store rejects with CatalogBuildError naming the duplicated SKU", async () => {
    const { copy, dup } = corrupted();
    vi.resetModules();
    vi.doMock("../data/catalog.json", () => ({ default: copy }));
    const { CatalogBuildError } = await import("../lib/catalog");
    const attempt = import("../lib/catalog-store");
    await expect(attempt).rejects.toBeInstanceOf(CatalogBuildError);
    // The SKU travels in the error's own `sku` field; the message is "duplicate sku".
    await expect(attempt).rejects.toMatchObject({ req: "REQ-CD-01", sku: dup, field: "sku", message: "duplicate sku" });
  });

  it("the four fallbacks still render in the same module registry", async () => {
    const { copy } = corrupted();
    vi.resetModules();
    vi.doMock("../data/catalog.json", () => ({ default: copy }));
    await expect(import("../lib/catalog-store")).rejects.toThrow();

    const html: Record<string, string> = {};
    const error = (await import("../app/error")).default;
    html.error = renderToStaticMarkup(createElement(error, { error: new Error("catalog broke"), retry: () => {} }));
    const globalError = (await import("../app/global-error")).default;
    html.globalError = renderToStaticMarkup(
      createElement(globalError, { error: new Error("catalog broke"), retry: () => {} }),
    );
    const notFound = (await import("../app/not-found")).default;
    html.notFound = renderToStaticMarkup(createElement(notFound));
    const loading = (await import("../app/loading")).default;
    html.loading = renderToStaticMarkup(createElement(loading));

    expect(html.error).toContain("Something went wrong with that page.");
    expect(html.globalError).toContain("The atelier couldn&#x27;t open.");
    expect(html.notFound).toContain("We couldn&#x27;t find that page.");
    expect(html.loading).toContain("Opening the atelier");
    for (const [name, h] of Object.entries(html)) {
      expect(h, name).not.toContain("catalog broke");
      expect(h, name).not.toContain("₹");
    }
  });

  it("a route that imports the store fails at import, so the boundary is what the visitor sees", async () => {
    const { copy, dup } = corrupted();
    vi.resetModules();
    vi.doMock("../data/catalog.json", () => ({ default: copy }));
    await expect(import("../app/atelier/page")).rejects.toMatchObject({ name: "CatalogBuildError", sku: dup });
  });

  it("data/catalog.json on disk is unchanged", () => {
    expect(readFileSync(CATALOG_PATH, "utf8")).toBe(diskBefore);
  });
});
