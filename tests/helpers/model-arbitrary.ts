// Test helper: a generator of valid RecipientModels (same shape rules as validateModel).
import fc from "fast-check";
import {
  BUDGET_BANDS,
  CATEGORIES,
  METALS,
  OCCASIONS,
  RELATIONSHIPS,
  SYMBOL_CHOICES,
  SYMBOL_KEYS,
} from "../../lib/conversation";
import type { RecipientModel } from "../../lib/matching/types";

const RANGE: Record<string, [number, number]> = { infants: [0, 3], kids: [3, 12], teens: [12, 19] };

export const arbModel: fc.Arbitrary<RecipientModel> = fc
  .tuple(
    fc.constantFrom("infants", "kids", "teens", "mom"),
    fc.constantFrom(...RELATIONSHIPS.filter((r) => r !== "mom")),
    fc.oneof(fc.constant(undefined), fc.double({ min: 0, max: 1, noNaN: true })),
    fc.constantFrom(...OCCASIONS),
    fc.constantFrom(...BUDGET_BANDS),
    fc.constantFrom(...METALS),
    fc.constantFrom(...SYMBOL_CHOICES),
    fc.uniqueArray(fc.constantFrom(...SYMBOL_KEYS), { maxLength: 7 }),
    fc.constantFrom(...CATEGORIES),
  )
  .map(([band, relationship, frac, occasion, budgetBand, metal, symbols, list, category]) => {
    const m: RecipientModel = {
      relationship: band === "mom" ? "mom" : relationship,
      ageBand: band as RecipientModel["ageBand"],
      occasion,
      budgetBand,
      metal,
      symbols,
      category,
    };
    if (band !== "mom" && frac !== undefined) {
      const [lo, hi] = RANGE[band];
      m.ageYears = Math.min(lo + frac * (hi - lo), hi - 0.001);
    }
    if (symbols === "religious" && list.length > 0) m.symbolList = list;
    return m;
  });
