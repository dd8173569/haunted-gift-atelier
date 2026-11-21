// Test helper: the real catalog, parsed once, and a model builder.
import catalogData from "../../data/catalog.json";
import { parseCatalog, type ParsedCatalog, type Product, type RawCatalog } from "../../lib/catalog";
import type { RecipientModel } from "../../lib/matching/types";

export const catalog: ParsedCatalog = parseCatalog(catalogData as unknown as RawCatalog);

export const product = (sku: string): Product => {
  const p = catalog.products.find((x) => x.sku === sku);
  if (!p) throw new Error(`no such sku ${sku}`);
  return p;
};

export const RELIGIOUS_SKUS = [
  "TPN-1149",
  "TPN-1147",
  "TPN-1145",
  "TPN-1141",
  "TPN-1143",
  "TPN-1144",
  "TBZ-1017",
  "TBZ-1013",
];

export function model(over: Partial<RecipientModel> = {}): RecipientModel {
  return {
    relationship: "other",
    ageBand: "kids",
    occasion: "just-because",
    budgetBand: "no-limit",
    metal: "any",
    symbols: "any",
    category: "any",
    ...over,
  };
}

/** Golden models (requirements §9) and the PRD §4 personas. */
export const GOLDEN1 = model({
  relationship: "niece-nephew",
  ageBand: "infants",
  ageYears: 0.5,
  occasion: "naming",
  budgetBand: "under-2500",
  metal: "silver",
});
export const GOLDEN2 = model({
  relationship: "mom",
  ageBand: "mom",
  occasion: "birthday",
  budgetBand: "25000-plus",
  metal: "gold",
});
export const GOLDEN3 = model({
  ageBand: "teens",
  occasion: "festival",
  budgetBand: "15000-25000",
  metal: "gold",
  symbols: "religious",
  symbolList: ["ganesha"],
});
