import { describe, expect, it } from "vitest";
import { toPieceView } from "../lib/piece-view";
import { catalog } from "../lib/catalog-store";

const view = (sku: string) => {
  const p = catalog.products.find((x) => x.sku === sku);
  if (!p) throw new Error(`no ${sku}`);
  return { p, v: toPieceView(p) };
};
const labels = (sku: string) => view(sku).v.facts.map((f) => f.label);

describe("toPieceView", () => {
  it("TPN-1149: Chain row present, no Rating row, in the specified order", () => {
    const { v } = view("TPN-1149");
    expect(labels("TPN-1149")).toEqual([
      "Category",
      "Metal",
      "Materials",
      "Weight",
      "Dimensions",
      "Chain",
      "Age groups",
      "SKU",
      "Availability",
    ]);
    expect(v.facts.find((f) => f.label === "Chain")?.value).toBe("13 inch / 18 inch, weight 1 gms / 2 gms");
    expect(v.rating).toBeNull();
    expect(v.inStock).toBe(true);
    expect(v.imageSrc).toBe("/catalog/TPN-1149.png");
  });

  it("TNZ-1056: no Chain row, Rating verbatim, Materials 925 Silver", () => {
    const { v } = view("TNZ-1056");
    expect(labels("TNZ-1056")).not.toContain("Chain");
    expect(v.facts.find((f) => f.label === "Rating")?.value).toBe("4.7/5 (3 reviews)");
    expect(v.facts.find((f) => f.label === "Materials")?.value).toBe("925 Silver");
    expect(v.facts.find((f) => f.label === "Metal")?.value).toBe("925 silver");
    expect(v.facts.find((f) => f.label === "Age groups")?.value).toBe("Infants 0–3 years");
  });

  it("THP-1027: neither Chain nor Rating", () => {
    expect(labels("THP-1027")).toEqual([
      "Category",
      "Metal",
      "Materials",
      "Weight",
      "Dimensions",
      "Age groups",
      "SKU",
      "Availability",
    ]);
  });

  it("TNZ-1058: Out of stock", () => {
    const { v } = view("TNZ-1058");
    expect(v.inStock).toBe(false);
    expect(v.facts.find((f) => f.label === "Availability")?.value).toBe("Out of stock");
    expect(v.facts.find((f) => f.label === "Rating")?.value).toBe("5.0/5");
  });

  it("never shows design_application_no, sku_extra, claims or an MRP", () => {
    for (const p of catalog.products) {
      const text = JSON.stringify(toPieceView(p).facts);
      if (p.design_application_no) expect(text).not.toContain(p.design_application_no);
      if (p.sku_extra) expect(text).not.toContain(p.sku_extra);
      expect(text).not.toMatch(/mrp|claims|application/i);
    }
  });

  it("does not mutate the product", () => {
    const p = catalog.products[0];
    const before = JSON.stringify(p);
    toPieceView(p);
    expect(JSON.stringify(p)).toBe(before);
  });
});
