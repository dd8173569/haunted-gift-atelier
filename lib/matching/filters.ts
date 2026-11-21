// Hard filters (design §2, REQ-MC-07..13). Pure.
import type { Category, ParsedCatalog, Product } from "../catalog";
import { RELIGIOUS, SYMBOL_CHIP_TAGS } from "../../data/product-tags";
import { AGE_LABEL } from "./age";
import type { Constraints, RecipientModel } from "./types";

const CATEGORY_BY_PREF: Record<string, Category> = {
  pendant: "Pendant",
  bracelet: "Bracelet",
  earrings: "Earrings",
  set: "Set",
  tabeez: "Tabeez",
};

/** Tags named by the model's symbolList (known chips only). */
function listTags(model: RecipientModel): Set<string> {
  const tags = new Set<string>();
  for (const chip of model.symbolList ?? []) {
    for (const t of SYMBOL_CHIP_TAGS[chip] ?? []) tags.add(t);
  }
  return tags;
}

export function initialConstraints(model: RecipientModel): Constraints {
  const base = {
    bands: (model.budgetBand === "no-limit"
      ? "any"
      : new Set([model.budgetBand])) as Constraints["bands"],
    metal: model.metal,
    category:
      model.category === "any" ? ("any" as const) : CATEGORY_BY_PREF[model.category],
  };
  if (model.symbols === "religious") {
    const tags = listTags(model);
    return tags.size > 0
      ? { ...base, symbolMode: "list", symbolTags: tags }
      : { ...base, symbolMode: "religious", symbolTags: new Set(RELIGIOUS) };
  }
  if (model.symbols === "zodiac") {
    return { ...base, symbolMode: "zodiac", symbolTags: new Set(["symbol:zodiac"]) };
  }
  if (model.symbols === "evil-eye") {
    return { ...base, symbolMode: "evil-eye", symbolTags: new Set(["symbol:evil-eye"]) };
  }
  return { ...base, symbolMode: model.symbols, symbolTags: new Set() };
}

/** Tags the user explicitly asked for (the +3 symbol signal). Empty for any / none-religious. */
export function requestedSymbolTags(model: RecipientModel): Set<string> {
  const c = initialConstraints(model);
  return c.symbolMode === "any" || c.symbolMode === "none-religious"
    ? new Set()
    : c.symbolTags;
}

export const isReligious = (p: Product): boolean =>
  p.tags.some((t) => RELIGIOUS.has(t));

function symbolPasses(p: Product, c: Constraints): boolean {
  switch (c.symbolMode) {
    case "none-religious":
      return !isReligious(p);
    case "any":
      return true;
    case "religious":
      return isReligious(p);
    default: // zodiac, evil-eye, list
      return p.tags.some((t) => c.symbolTags.has(t));
  }
}

export function passes(p: Product, c: Constraints, model: RecipientModel): boolean {
  return (
    p.availability === "In Stock" &&
    p.age_groups.includes(AGE_LABEL[model.ageBand]) &&
    (c.bands === "any" || c.bands.has(p.price_band)) &&
    (c.category === "any" || p.category === c.category) &&
    symbolPasses(p, c) &&
    (c.metal === "any" || p.metal === c.metal)
  );
}

export function eligible(
  c: Constraints,
  model: RecipientModel,
  catalog: ParsedCatalog,
): Product[] {
  return catalog.products.filter((p) => passes(p, c, model));
}
