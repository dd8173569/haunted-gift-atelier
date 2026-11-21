// Ranking and diversity (design §6, REQ-MC-18, REQ-MC-20). Pure; inputs are not mutated.
import { BAND_MIDPOINTS, type Product } from "../catalog";
import type { RecipientModel, ScoreBreakdown } from "./types";

export interface Scored {
  product: Product;
  breakdown: ScoreBreakdown;
  score: number;
}

/** Total order: score desc, rating desc (null last), distance to ORIGINAL band midpoint, SKU asc. */
export function compare(a: Scored, b: Scored, model: RecipientModel): number {
  if (a.score !== b.score) return b.score - a.score;
  const ra = a.product.rating_value ?? -1;
  const rb = b.product.rating_value ?? -1;
  if (ra !== rb) return rb - ra;
  if (model.budgetBand !== "no-limit") {
    const mid = BAND_MIDPOINTS[model.budgetBand];
    const da = Math.abs(a.product.price_inr - mid);
    const db = Math.abs(b.product.price_inr - mid);
    if (da !== db) return da - db;
  }
  return a.product.sku < b.product.sku ? -1 : a.product.sku > b.product.sku ? 1 : 0;
}

export function rank(items: readonly Scored[], model: RecipientModel): Scored[] {
  return [...items].sort((a, b) => compare(a, b, model));
}

/**
 * Takes the ranked list and returns the picks (at most 3). When the top 3 share
 * one category, the third is swapped for the best-ranked different-category item
 * scoring >= third.score - 2, if any. At most one swap.
 */
export function applyDiversity(ranked: readonly Scored[]): Scored[] {
  const top = ranked.slice(0, 3);
  if (top.length < 3) return top;
  const category = top[0].product.category;
  if (!top.every((s) => s.product.category === category)) return top;
  const floor = top[2].score - 2;
  const alt = ranked
    .slice(3)
    .find((s) => s.product.category !== category && s.score >= floor);
  if (alt) top[2] = alt;
  return top;
}
