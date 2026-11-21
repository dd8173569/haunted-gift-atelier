import { describe, expect, it } from "vitest";
import { eligible, initialConstraints, requestedSymbolTags } from "../lib/matching/filters";
import { RELIGIOUS_SKUS, catalog, model } from "./helpers/matching-fixtures";

const skus = (m: ReturnType<typeof model>) =>
  eligible(initialConstraints(m), m, catalog)
    .map((p) => p.sku)
    .sort();

describe("initialConstraints", () => {
  it("starts with only the original band", () => {
    const c = initialConstraints(model({ budgetBand: "2500-15000" }));
    expect(c.bands).toEqual(new Set(["2500-15000"]));
  });
  it("no-limit has no band restriction", () => {
    expect(initialConstraints(model()).bands).toBe("any");
  });
  it("religious with a list is list mode with chip tags (tabeez -> two tags)", () => {
    const c = initialConstraints(model({ symbols: "religious", symbolList: ["tabeez", "om"] }));
    expect(c.symbolMode).toBe("list");
    expect([...c.symbolTags].sort()).toEqual(["symbol:om", "symbol:swastik", "symbol:third-eye"]);
  });
  it("religious with an empty or unknown list is religious mode", () => {
    expect(initialConstraints(model({ symbols: "religious", symbolList: [] })).symbolMode).toBe("religious");
    expect(initialConstraints(model({ symbols: "religious", symbolList: ["nope"] })).symbolMode).toBe("religious");
  });
  it("symbolList is ignored unless symbols is religious", () => {
    expect(initialConstraints(model({ symbols: "any", symbolList: ["om"] })).symbolMode).toBe("any");
  });
  it("requestedSymbolTags is empty for any / none-religious", () => {
    expect(requestedSymbolTags(model({ symbols: "any" })).size).toBe(0);
    expect(requestedSymbolTags(model({ symbols: "none-religious" })).size).toBe(0);
    expect([...requestedSymbolTags(model({ symbols: "zodiac" }))]).toEqual(["symbol:zodiac"]);
  });
});

describe("eligible", () => {
  it("TNZ-1058 (out of stock) is never eligible, even for exactly its own profile", () => {
    const m = model({ ageBand: "infants", budgetBand: "2500-15000", metal: "silver", category: "bracelet", symbols: "evil-eye" });
    expect(skus(m)).not.toContain("TNZ-1058");
    expect(skus(model({ ageBand: "infants" }))).not.toContain("TNZ-1058");
  });
  it("age filter uses the catalog age group", () => {
    expect(skus(model({ ageBand: "mom" }))).toEqual(["THP-1001", "THP-1017"]);
    expect(skus(model({ ageBand: "teens" })).every((s) => !["TBZ-1013", "TNZ-1056"].includes(s))).toBe(true);
  });
  it("budget filter keeps only the original band", () => {
    expect(skus(model({ ageBand: "infants", budgetBand: "under-2500" }))).toEqual([
      "TBZ-1013", "TBZ-1017", "THP-1027", "TNZ-1056", "TOB-1008", "TPN-1433",
    ]);
  });
  it("category filter is case-insensitive in effect (lowercase model value)", () => {
    expect(skus(model({ ageBand: "kids", category: "set" }))).toEqual(["TPN-1199", "TPN-1206"]);
  });
  it("metal filter", () => {
    const silver = eligible(initialConstraints(model({ metal: "silver" })), model({ metal: "silver" }), catalog);
    expect(silver.length).toBeGreaterThan(0);
    expect(silver.every((p) => p.metal === "silver")).toBe(true);
  });
  it("none-religious excludes all 8 religious SKUs for every age band", () => {
    for (const ageBand of ["infants", "kids", "teens", "mom"] as const) {
      const m = model({ ageBand, symbols: "none-religious" });
      const got = skus(m);
      for (const r of RELIGIOUS_SKUS) expect(got).not.toContain(r);
    }
  });
  it("any symbols lets religious pieces through (explicit opt-in)", () => {
    const got = skus(model({ ageBand: "kids", symbols: "any" }));
    for (const r of RELIGIOUS_SKUS) expect(got).toContain(r);
  });
  it("religious (no list) returns exactly the religious pieces", () => {
    const got = skus(model({ ageBand: "kids", symbols: "religious" }));
    expect(got).toEqual([...RELIGIOUS_SKUS].sort());
  });
  it("list mode matches only the listed symbols", () => {
    expect(skus(model({ ageBand: "kids", symbols: "religious", symbolList: ["om", "jain"] }))).toEqual([
      "TPN-1144", "TPN-1149",
    ]);
    expect(skus(model({ ageBand: "kids", symbols: "religious", symbolList: ["tabeez"] }))).toEqual([
      "TBZ-1013", "TBZ-1017",
    ]);
  });
  it("zodiac and evil-eye restrict to that tag", () => {
    expect(skus(model({ ageBand: "infants", symbols: "zodiac" }))).toEqual(["TPN-1433", "TPN-1459"]);
    expect(skus(model({ ageBand: "infants", symbols: "evil-eye" }))).toEqual(["TNZ-1056"]);
  });
});
