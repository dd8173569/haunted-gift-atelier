// Test helper: an independent reference for the /atelier filters (reliability design §4.3; REQ-REL-33).
// Written from raw data/catalog.json fields only. It does not import lib/browse.ts or lib/catalog.ts.
// Band edges 2500, 15000, 25000 are literals on purpose: a change to them in lib/ must fail a test.
import raw from "../../data/catalog.json";

type RawProduct = {
  sku: string;
  category: string;
  materials: string;
  price_inr: number;
  age_groups: string[];
  availability: string;
};

export type RefFilters = { age: string; category: string; metal: string; budget: string };

const AGE_GROUP: Record<string, string> = {
  infants: "Infants 0-3 years",
  kids: "Kids 3-12 years",
  teens: "Teens 12-19 years",
  mom: "Mom",
};

const products = (raw as unknown as { products: RawProduct[] }).products;

const metalOf = (materials: string): string => (materials.includes("18KT Gold") ? "gold" : "silver");

const bandOf = (price: number): string =>
  price < 2500 ? "under-2500" : price < 15000 ? "2500-15000" : price < 25000 ? "15000-25000" : "25000-plus";

/** In-stock pieces in catalog order, then the rest in catalog order, filtered. Returns SKUs. */
export function referenceSkus(f: RefFilters): string[] {
  const ordered = [
    ...products.filter((p) => p.availability === "In Stock"),
    ...products.filter((p) => p.availability !== "In Stock"),
  ];
  return ordered
    .filter(
      (p) =>
        (f.age === "all" || p.age_groups.includes(AGE_GROUP[f.age])) &&
        (f.category === "all" || p.category.toLowerCase() === f.category) &&
        (f.metal === "all" || metalOf(p.materials) === f.metal) &&
        (f.budget === "all" || bandOf(p.price_inr) === f.budget),
    )
    .map((p) => p.sku);
}

export const outOfStockSkus = (): string[] =>
  products.filter((p) => p.availability !== "In Stock").map((p) => p.sku);

export const urlOfSku = (sku: string): string =>
  (raw as unknown as { products: { sku: string; url: string }[] }).products.find((p) => p.sku === sku)!.url;

export const priceOfSku = (sku: string): number => products.find((p) => p.sku === sku)!.price_inr;
