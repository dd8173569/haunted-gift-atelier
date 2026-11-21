import { describe, expect, it } from "vitest";
import {
  AGE_OPTIONS,
  ALL_FILTERS,
  BUDGET_OPTIONS,
  CATEGORY_OPTIONS,
  METAL_OPTIONS,
  filterItems,
  filtersToQuery,
  parseBrowseFilters,
  toBrowseItems,
  type BrowseFilters,
} from "../lib/browse";
import { catalog, product } from "./helpers/matching-fixtures";

const items = toBrowseItems(catalog);
const f = (over: Partial<BrowseFilters>): BrowseFilters => ({ ...ALL_FILTERS, ...over });

describe("toBrowseItems", () => {
  it("22 items, the 21 in-stock first, then TNZ-1058; catalog order within each group", () => {
    expect(items).toHaveLength(22);
    expect(items.slice(0, 21).every((i) => i.availability === "In Stock")).toBe(true);
    expect(items[21].sku).toBe("TNZ-1058");
    expect(items[21].availability).toBe("Out of Stock");
    const inStockCatalogOrder = catalog.products.filter((p) => p.availability === "In Stock").map((p) => p.sku);
    expect(items.slice(0, 21).map((i) => i.sku)).toEqual(inStockCatalogOrder);
  });
  it("copies catalog facts verbatim", () => {
    for (const i of items) {
      const p = product(i.sku);
      expect(i).toEqual({
        sku: p.sku,
        name: p.name,
        price_inr: p.price_inr,
        url: p.url,
        imageSrc: `/catalog/${p.image_file}`,
        category: p.category,
        metal: p.metal,
        price_band: p.price_band,
        age_groups: p.age_groups,
        availability: p.availability,
        rating: p.rating,
      });
    }
  });
});

describe("option labels reuse the template labels", () => {
  it("labels", () => {
    expect(AGE_OPTIONS.map((o) => o.label)).toEqual(["All", "Infants 0–3 years", "Kids 3–12 years", "Teens 12–19 years", "Mom"]);
    expect(CATEGORY_OPTIONS.map((o) => o.label)).toEqual(["All", "Pendant", "Bracelet", "Earrings", "Set", "Tabeez"]);
    expect(METAL_OPTIONS.map((o) => o.label)).toEqual(["All", "18KT gold", "925 silver"]);
    expect(BUDGET_OPTIONS.map((o) => o.label)).toEqual([
      "All", "Under ₹2,500", "₹2,500–₹15,000", "₹15,000–₹25,000", "₹25,000+",
    ]);
    expect(BUDGET_OPTIONS.map((o) => o.value)).toEqual(["all", "under-2500", "2500-15000", "15000-25000", "25000-plus"]);
  });
});

describe("parseBrowseFilters boundaries", () => {
  it("empty, undefined, null, and non-object input give all", () => {
    expect(parseBrowseFilters({})).toEqual(ALL_FILTERS);
    expect(parseBrowseFilters(undefined)).toEqual(ALL_FILTERS);
    expect(parseBrowseFilters(null)).toEqual(ALL_FILTERS);
    expect(parseBrowseFilters("x" as never)).toEqual(ALL_FILTERS);
  });
  it("valid values pass through", () => {
    expect(parseBrowseFilters({ age: "teens", category: "set", metal: "gold", budget: "25000-plus" })).toEqual({
      age: "teens",
      category: "set",
      metal: "gold",
      budget: "25000-plus",
    });
  });
  it("unknown, repeated, wrong-case, empty and prototype-ish values become all", () => {
    expect(parseBrowseFilters({ metal: "junk" }).metal).toBe("all");
    expect(parseBrowseFilters({ metal: ["gold", "silver"] }).metal).toBe("all");
    expect(parseBrowseFilters({ metal: ["gold"] }).metal).toBe("all");
    expect(parseBrowseFilters({ metal: "GOLD" }).metal).toBe("all");
    expect(parseBrowseFilters({ metal: "" }).metal).toBe("all");
    expect(parseBrowseFilters({ category: "toString" }).category).toBe("all");
    expect(parseBrowseFilters({ budget: "all" }).budget).toBe("all");
    expect(parseBrowseFilters({ age: undefined, extra: "1" } as never).age).toBe("all");
  });
  it("one bad value does not disturb the others", () => {
    expect(parseBrowseFilters({ metal: "junk", category: "pendant" })).toEqual(f({ category: "pendant" }));
  });
});

describe("filterItems", () => {
  it("no filter returns every item, including TNZ-1058", () => {
    expect(filterItems(items, ALL_FILTERS)).toEqual(items);
  });
  it("age Infants", () => {
    const got = filterItems(items, f({ age: "infants" })).map((i) => i.sku);
    const want = items.filter((i) => i.age_groups.includes("Infants 0-3 years")).map((i) => i.sku);
    expect(got).toEqual(want);
    expect(got.length).toBeGreaterThan(0);
  });
  it("Mom filter finds the two earrings", () => {
    expect(filterItems(items, f({ age: "mom" })).map((i) => i.sku).sort()).toEqual(["THP-1001", "THP-1017"]);
  });
  it("Pendant + 18KT gold + ₹15,000–₹25,000 equals the independent computation", () => {
    const got = filterItems(items, f({ category: "pendant", metal: "gold", budget: "15000-25000" })).map((i) => i.sku);
    const want = catalog.products
      .filter((p) => p.category === "Pendant" && p.metal === "gold" && p.price_inr >= 15000 && p.price_inr < 25000)
      .map((p) => p.sku);
    expect(new Set(got)).toEqual(new Set(want));
  });
  it("every price band filter agrees with the price in rupees", () => {
    const bounds: Record<string, [number, number]> = {
      "under-2500": [0, 2500],
      "2500-15000": [2500, 15000],
      "15000-25000": [15000, 25000],
      "25000-plus": [25000, Infinity],
    };
    for (const [band, [lo, hi]] of Object.entries(bounds)) {
      const got = filterItems(items, f({ budget: band as BrowseFilters["budget"] }));
      expect(got.every((i) => i.price_inr >= lo && i.price_inr < hi), band).toBe(true);
    }
  });
  it("an impossible combination is empty", () => {
    expect(filterItems(items, f({ age: "mom", category: "pendant" }))).toEqual([]);
  });
  it("TNZ-1058 is returned when it passes the filters", () => {
    const oos = items.find((i) => i.availability === "Out of Stock")!;
    const got = filterItems(
      items,
      f({ category: oos.category.toLowerCase() as BrowseFilters["category"], metal: oos.metal }),
    );
    expect(got.map((i) => i.sku)).toContain("TNZ-1058");
  });
});

describe("filtersToQuery", () => {
  it("empty for all", () => expect(filtersToQuery(ALL_FILTERS)).toBe(""));
  it("fixed order age, category, metal, budget", () => {
    expect(filtersToQuery({ budget: "under-2500", metal: "silver", category: "pendant", age: "kids" })).toBe(
      "age=kids&category=pendant&metal=silver&budget=under-2500",
    );
    expect(filtersToQuery(f({ metal: "silver" }))).toBe("metal=silver");
  });
});
