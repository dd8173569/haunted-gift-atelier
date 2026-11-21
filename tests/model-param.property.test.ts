// P-GP-6: pieceHref round trip (gift-presentation design §9.1). Seeded.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { catalog } from "../lib/catalog-store";
import { parseModelParam, pieceHref } from "../lib/model-param";
import { arbModel } from "./helpers/model-arbitrary";

describe("P-GP-6 pieceHref round trip", () => {
  it("the path decodes to the SKU and m parses back to the model", () => {
    fc.assert(
      fc.property(fc.constantFrom(...catalog.products.map((p) => p.sku)), arbModel, (sku, model) => {
        const href = pieceHref(sku, model);
        const [path, query] = href.split("?");
        expect(decodeURIComponent(path.replace("/piece/", ""))).toBe(sku);
        const m = new URLSearchParams(query).get("m") ?? undefined;
        const parsed = parseModelParam(m);
        expect(parsed.status).toBe("ok");
        if (parsed.status === "ok") expect(parsed.model).toEqual(model);
      }),
      { seed: 20261124, numRuns: 300 },
    );
  });
  it("without a model there is no query, for all 22 SKUs", () => {
    for (const p of catalog.products) {
      const href = pieceHref(p.sku);
      expect(href).toBe(`/piece/${p.sku}`);
      expect(href).not.toContain("?");
    }
  });
});
