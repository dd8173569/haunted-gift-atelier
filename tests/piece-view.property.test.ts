// P-GP-5: every fact traces to the catalog field named in `source` (gift-presentation design §9.1).
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { catalog } from "../lib/catalog-store";
import { AGE_GROUP_LABEL, METAL_LABEL } from "../lib/matching/templates";
import { toPieceView } from "../lib/piece-view";

const arbProduct = fc.constantFrom(...catalog.products);

describe("P-GP-5 facts trace to the catalog", () => {
  it("every row equals its source field through the documented maps", () => {
    fc.assert(
      fc.property(arbProduct, (p) => {
        const v = toPieceView(p);
        const by = (label: string) => v.facts.find((f) => f.label === label);
        expect(by("Category")?.value).toBe(p.category);
        expect(by("Metal")?.value).toBe(METAL_LABEL[p.metal]);
        expect(by("Materials")?.value).toBe(p.materials);
        expect(by("Weight")?.value).toBe(p.weight);
        expect(by("Dimensions")?.value).toBe(p.dimensions);
        expect(by("SKU")?.value).toBe(p.sku);
        expect(by("Availability")?.value).toBe(p.availability === "In Stock" ? "In stock" : "Out of stock");
        expect(by("Age groups")?.value.toLowerCase()).toBe(
          p.age_groups.map((g) => AGE_GROUP_LABEL[g]).join(", ").toLowerCase(),
        );
        // Chain and Rating rows exist exactly when the field is non-null.
        expect(by("Chain") !== undefined).toBe(p.chain !== null);
        expect(by("Rating") !== undefined).toBe(p.rating !== null);
        if (p.chain !== null) expect(by("Chain")?.value).toBe(p.chain);
        if (p.rating !== null) expect(by("Rating")?.value).toBe(p.rating);
        // Nothing but the ten documented labels, each at most once.
        const labels = v.facts.map((f) => f.label);
        expect(new Set(labels).size).toBe(labels.length);
        const text = JSON.stringify(v.facts);
        if (p.design_application_no) expect(text).not.toContain(p.design_application_no);
        expect(v.url).toBe(p.url);
        expect(v.inStock).toBe(p.availability === "In Stock");
      }),
      { seed: 20261124, numRuns: 300 },
    );
  });
});
