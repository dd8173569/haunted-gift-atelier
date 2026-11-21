// Joins a MatchResult to catalog products for display (conversation design §5).
// It asserts invariants loudly and never edits a catalog fact.
import type { ParsedCatalog } from "./catalog";
import type { MatchResult, Relaxation } from "./matching/types";

export interface PickView {
  rank: 1 | 2 | 3;
  sku: string;
  name: string;
  category: string;
  price_inr: number;
  url: string;
  imageSrc: string;
  rating: string | null;
  reasons: string[];
  markerLabels: string[];
  relaxationNote?: string;
}

/** Plain words for each relaxation marker (REQ-CV-30). */
export const MARKER_LABEL: Record<Relaxation, string> = {
  "budget-below": "Just below your budget",
  "budget-above": "Just above your budget",
  "symbol-broadened": "A related symbol",
  "metal-dropped": "A different metal",
  "category-dropped": "A different kind of piece",
};

export function toPickViews(result: MatchResult, catalog: ParsedCatalog): PickView[] {
  const { picks } = result;
  if (picks.length > 3) throw new Error(`expected at most 3 picks, got ${picks.length}`);
  if (new Set(picks.map((p) => p.sku)).size !== picks.length) {
    throw new Error("duplicate SKU in picks");
  }
  return picks.map((pick, i) => {
    const product = catalog.products.find((p) => p.sku === pick.sku);
    if (!product) throw new Error(`pick ${pick.sku} not in catalog`);
    if (product.availability !== "In Stock") throw new Error(`pick ${pick.sku} is not In Stock`);
    const view: PickView = {
      rank: (i + 1) as 1 | 2 | 3,
      sku: product.sku,
      name: product.name,
      category: product.category,
      price_inr: product.price_inr,
      url: product.url,
      imageSrc: `/catalog/${product.image_file}`,
      rating: product.rating,
      reasons: pick.reasons.map((r) => r.text),
      markerLabels: pick.relaxations.map((r) => MARKER_LABEL[r]),
    };
    if (pick.relaxationNote !== undefined) view.relaxationNote = pick.relaxationNote;
    return view;
  });
}
