// The one matching entry point (design §1). Pure: the catalog is passed in.
// filter -> ladder -> score -> rank -> diversity -> explain.
import type { ParsedCatalog, Product } from "./catalog";
import { RELIGIOUS } from "../data/product-tags";
import { AGE_LABEL } from "./matching/age";
import { explain } from "./matching/explain";
import { initialConstraints } from "./matching/filters";
import { applyDiversity, rank, type Scored } from "./matching/rank";
import { BAND_ORDER, finalDisclosures, relax } from "./matching/relax";
import { scoreProduct, sum } from "./matching/scoring";
import { SYMBOL_TAG_LABEL, markerSentence, shortfallNote } from "./matching/templates";
import type { LadderStepName, MatchResult, Pick, RecipientModel, Relaxation } from "./matching/types";

export type { MatchResult, Pick, RecipientModel } from "./matching/types";

/** Markers: how a pick differs from the ORIGINAL model (REQ-MC-25). */
function markers(p: Product, model: RecipientModel): Relaxation[] {
  const out: Relaxation[] = [];
  if (model.budgetBand !== "no-limit" && p.price_band !== model.budgetBand) {
    out.push(
      BAND_ORDER.indexOf(p.price_band) < BAND_ORDER.indexOf(model.budgetBand)
        ? "budget-below"
        : "budget-above",
    );
  }
  const original = initialConstraints(model);
  if (
    original.symbolMode === "list" &&
    p.tags.some((t) => RELIGIOUS.has(t)) &&
    !p.tags.some((t) => original.symbolTags.has(t))
  ) {
    out.push("symbol-broadened");
  }
  if (model.metal !== "any" && p.metal !== model.metal) out.push("metal-dropped");
  if (original.category !== "any" && p.category !== original.category) {
    out.push("category-dropped");
  }
  return out;
}

const STEP_OF: Record<Relaxation, LadderStepName> = {
  "budget-below": "widenBelow",
  "budget-above": "widenAbove",
  "symbol-broadened": "broadenSymbol",
  "metal-dropped": "dropMetal",
  "category-dropped": "dropCategory",
};

const usedSteps = (picks: Pick[]): Set<LadderStepName> =>
  new Set(picks.flatMap((p) => p.relaxations.map((r) => STEP_OF[r])));

export function match(model: RecipientModel, catalog: ParsedCatalog): MatchResult {
  const relaxed = relax(model, catalog);
  const scored: Scored[] = relaxed.eligible.map((product) => {
    const breakdown = scoreProduct(product, model, relaxed.constraints, catalog);
    return { product, breakdown, score: sum(breakdown) };
  });
  const top = applyDiversity(rank(scored, model));

  const picks: Pick[] = top.map(({ product: p, breakdown, score }) => {
    const relaxations = markers(p, model);
    const pick: Pick = {
      sku: p.sku,
      score,
      breakdown,
      reasons: explain(p, breakdown, model),
      relaxations,
    };
    const dir = relaxations.includes("budget-below")
      ? "below"
      : relaxations.includes("budget-above")
        ? "above"
        : null;
    if (dir) {
      const tag = p.tags.find((t) => t in SYMBOL_TAG_LABEL);
      pick.relaxationNote = markerSentence(
        tag ? SYMBOL_TAG_LABEL[tag] : undefined,
        p.category,
        dir,
        p.price_inr,
      );
    }
    return pick;
  });

  const result: MatchResult = {
    picks,
    disclosures: finalDisclosures(model, relaxed, usedSteps(picks)),
    showBrowseLink: picks.length < 3,
    trace: relaxed.trace,
  };
  if (picks.length < 3) {
    const ageGroup = AGE_LABEL[model.ageBand];
    const listed = catalog.products.filter(
      (p) => p.availability === "In Stock" && p.age_groups.includes(ageGroup),
    ).length;
    result.shortfallNote = shortfallNote(listed, picks.length, ageGroup);
  }
  return result;
}

