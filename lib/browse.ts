// Browse logic for /atelier (conversation design §6). Pure; labels reuse the matching templates.
import type { AgeGroup, Category, Metal, ParsedCatalog, PriceBand } from "./catalog";
import { AGE_LABEL } from "./matching/age";
import { AGE_GROUP_LABEL, BAND_LABEL, CATEGORY_LABEL, METAL_LABEL } from "./matching/templates";

export type AgeFilter = "all" | "infants" | "kids" | "teens" | "mom";
export type CategoryFilter = "all" | "pendant" | "bracelet" | "earrings" | "set" | "tabeez";
export type MetalFilter = "all" | Metal;
export type BudgetFilter = "all" | PriceBand;

export interface BrowseFilters {
  age: AgeFilter;
  category: CategoryFilter;
  metal: MetalFilter;
  budget: BudgetFilter;
}

export interface BrowseItem {
  sku: string;
  name: string;
  price_inr: number;
  url: string;
  imageSrc: string;
  category: Category;
  metal: Metal;
  price_band: PriceBand;
  age_groups: AgeGroup[];
  availability: "In Stock" | "Out of Stock";
  rating: string | null;
}

export const ALL_FILTERS: BrowseFilters = { age: "all", category: "all", metal: "all", budget: "all" };

export interface FilterOption<V extends string> {
  value: V | "all";
  label: string;
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const ALL = { value: "all", label: "All" } as const;

const AGE_VALUES = ["infants", "kids", "teens", "mom"] as const;
const CATEGORY_VALUES = ["pendant", "bracelet", "earrings", "set", "tabeez"] as const;
const METAL_VALUES = ["gold", "silver"] as const;
const BUDGET_VALUES = ["under-2500", "2500-15000", "15000-25000", "25000-plus"] as const;

export const AGE_OPTIONS: readonly FilterOption<Exclude<AgeFilter, "all">>[] = [
  ALL,
  ...AGE_VALUES.map((v) => ({ value: v, label: cap(AGE_GROUP_LABEL[AGE_LABEL[v]]) })),
];
export const CATEGORY_OPTIONS: readonly FilterOption<Exclude<CategoryFilter, "all">>[] = [
  ALL,
  ...CATEGORY_VALUES.map((v) => ({ value: v, label: cap(CATEGORY_LABEL[cap(v)]) })),
];
export const METAL_OPTIONS: readonly FilterOption<Metal>[] = [
  ALL,
  ...METAL_VALUES.map((v) => ({ value: v, label: METAL_LABEL[v] })),
];
export const BUDGET_OPTIONS: readonly FilterOption<PriceBand>[] = [
  ALL,
  ...BUDGET_VALUES.map((v) => ({ value: v, label: cap(BAND_LABEL[v]) })),
];

/** One item per product: in-stock first, then out-of-stock, each in catalog order. */
export function toBrowseItems(catalog: ParsedCatalog): BrowseItem[] {
  const items: BrowseItem[] = catalog.products.map((p) => ({
    sku: p.sku,
    name: p.name,
    price_inr: p.price_inr,
    url: p.url,
    imageSrc: `/catalog/${p.image_file}`,
    category: p.category,
    metal: p.metal,
    price_band: p.price_band,
    age_groups: [...p.age_groups],
    availability: p.availability,
    rating: p.rating,
  }));
  return [
    ...items.filter((i) => i.availability === "In Stock"),
    ...items.filter((i) => i.availability !== "In Stock"),
  ];
}

type SearchParams = { [key: string]: string | string[] | undefined };

function pick<V extends string>(sp: SearchParams, key: string, allowed: readonly V[]): V | "all" {
  const raw = sp[key];
  return typeof raw === "string" && (allowed as readonly string[]).includes(raw) ? (raw as V) : "all";
}

/** Unknown, repeated, or missing values become "all". Never throws. */
export function parseBrowseFilters(sp: SearchParams | null | undefined): BrowseFilters {
  if (typeof sp !== "object" || sp === null) return { ...ALL_FILTERS };
  return {
    age: pick(sp, "age", AGE_VALUES),
    category: pick(sp, "category", CATEGORY_VALUES),
    metal: pick(sp, "metal", METAL_VALUES),
    budget: pick(sp, "budget", BUDGET_VALUES),
  };
}

export function filterItems(items: readonly BrowseItem[], f: BrowseFilters): BrowseItem[] {
  return items.filter(
    (i) =>
      (f.age === "all" || i.age_groups.includes(AGE_LABEL[f.age])) &&
      (f.category === "all" || i.category.toLowerCase() === f.category) &&
      (f.metal === "all" || i.metal === f.metal) &&
      (f.budget === "all" || i.price_band === f.budget),
  );
}

/** Query string (no leading "?") of the non-"all" filters, in the order age, category, metal, budget. */
export function filtersToQuery(f: BrowseFilters): string {
  const q = new URLSearchParams();
  if (f.age !== "all") q.set("age", f.age);
  if (f.category !== "all") q.set("category", f.category);
  if (f.metal !== "all") q.set("metal", f.metal);
  if (f.budget !== "all") q.set("budget", f.budget);
  return q.toString();
}
