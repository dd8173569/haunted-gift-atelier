// Soft scoring (design §4–§5, REQ-MC-14..17). Pure.
import type { ParsedCatalog, Product } from "../catalog";
import { OCCASION_MATCH } from "../../data/occasion-map";
import { initialConstraints, isReligious, requestedSymbolTags } from "./filters";
import type { Constraints, RecipientModel, ScoreBreakdown } from "./types";

/** +1 when P25 <= price <= P75 of the ORIGINAL band's in-stock prices; 0 for no-limit. */
export function centrality(
  p: Product,
  model: RecipientModel,
  catalog: ParsedCatalog,
): 0 | 1 {
  if (model.budgetBand === "no-limit") return 0;
  const q = catalog.band_quartiles[model.budgetBand];
  if (q.n === 0) return 0;
  return p.price_inr >= q.p25 && p.price_inr <= q.p75 ? 1 : 0;
}

export function scoreProduct(
  p: Product,
  model: RecipientModel,
  constraints: Constraints,
  catalog: ParsedCatalog,
): ScoreBreakdown {
  const requested = requestedSymbolTags(model);
  let symbol: 0 | 1 | 3 = 0;
  if (requested.size > 0 && p.tags.some((t) => requested.has(t))) {
    symbol = 3;
  } else if (
    // broadenSymbol ran: the original mode was a specific list, now widened to religious
    initialConstraints(model).symbolMode === "list" &&
    constraints.symbolMode === "religious" &&
    isReligious(p)
  ) {
    symbol = 1;
  }
  return {
    occasion: OCCASION_MATCH[model.occasion](p) ? 3 : 0,
    symbol,
    metal: model.metal !== "any" && p.metal === model.metal ? 2 : 0,
    rating: p.rating_value !== null && p.rating_value >= 4.5 ? 1 : 0,
    centrality: centrality(p, model, catalog),
  };
}

export const sum = (b: ScoreBreakdown): number =>
  b.occasion + b.symbol + b.metal + b.rating + b.centrality;
