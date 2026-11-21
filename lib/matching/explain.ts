// "Why this one" reasons (design §7, REQ-MC-27..30). Template-rendered only.
import type { Product } from "../catalog";
import { RELIGIOUS } from "../../data/product-tags";
import { requestedSymbolTags } from "./filters";
import { AGE_LABEL } from "./age";
import { BAND_ORDER } from "./relax";
import {
  SYMBOL_TAG_LABEL,
  reasonAge,
  reasonBudgetInside,
  reasonBudgetNoLimit,
  reasonBudgetRelaxed,
  reasonMetal,
  reasonOccasion,
  reasonRating,
  reasonSymbol,
  reasonSymbolBroadened,
  requestedSymbolLabel,
} from "./templates";
import type { Reason, RecipientModel, ScoreBreakdown } from "./types";

export function explain(
  p: Product,
  breakdown: ScoreBreakdown,
  model: RecipientModel,
): Reason[] {
  const ageGroup = AGE_LABEL[model.ageBand];
  const reasons: Reason[] = [
    { type: "age", text: reasonAge(ageGroup), source: "age_groups" },
  ];

  if (model.budgetBand === "no-limit") {
    reasons.push({ type: "budget", text: reasonBudgetNoLimit(p.price_inr), source: "price_inr" });
  } else if (p.price_band === model.budgetBand) {
    reasons.push({
      type: "budget",
      text: reasonBudgetInside(p.price_inr, model.budgetBand),
      source: "price_inr",
    });
  } else {
    const dir =
      BAND_ORDER.indexOf(p.price_band) < BAND_ORDER.indexOf(model.budgetBand)
        ? "below"
        : "above";
    reasons.push({
      type: "budget",
      text: reasonBudgetRelaxed(p.price_inr, model.budgetBand, dir),
      source: "price_inr",
    });
  }

  const extra: Reason[] = [];
  const requested = requestedSymbolTags(model);
  if (breakdown.symbol > 0) {
    // A requested symbol is the stronger statement, so it takes the slot over occasion.
    if (breakdown.symbol === 3) {
      const tag = p.tags.find((t) => requested.has(t)) as string;
      extra.push({
        type: "symbol",
        text: reasonSymbol(SYMBOL_TAG_LABEL[tag] ?? tag),
        source: `product-tags:${tag}`,
      });
    } else {
      const tag = p.tags.find((t) => RELIGIOUS.has(t)) as string;
      extra.push({
        type: "symbol",
        text: reasonSymbolBroadened(SYMBOL_TAG_LABEL[tag] ?? tag, requestedSymbolLabel(model)),
        source: `product-tags:${tag}`,
      });
    }
  } else if (breakdown.occasion > 0) {
    extra.push({
      type: "occasion",
      text: reasonOccasion(model.occasion),
      source: `occasion-map:${model.occasion}`,
    });
  }
  if (breakdown.metal > 0) {
    extra.push({
      type: "metal",
      text: reasonMetal(p.metal),
      source: "materials",
    });
  }
  if (breakdown.rating > 0 && p.rating !== null) {
    extra.push({
      type: "rating",
      text: reasonRating(p.rating.split(" ")[0]),
      source: "rating",
    });
  }
  return [...reasons, ...extra.slice(0, 2)];
}
