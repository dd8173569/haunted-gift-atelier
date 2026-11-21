// Age mapping (REQ-MC-02, REQ-MC-03). Half-open intervals.
import type { AgeGroup } from "../catalog";
import type { AgeBand } from "./types";

export const AGE_LABEL: Record<AgeBand, AgeGroup> = {
  infants: "Infants 0-3 years",
  kids: "Kids 3-12 years",
  teens: "Teens 12-19 years",
  mom: "Mom",
};

/** [0,3) infants, [3,12) kids, [12,19) teens, >= 19 adult. Invalid input throws. */
export function ageYearsToBand(years: number): Exclude<AgeBand, "mom"> | "adult" {
  if (typeof years !== "number" || !Number.isFinite(years) || years < 0) {
    throw new RangeError(`invalid age: ${String(years)}`);
  }
  if (years < 3) return "infants";
  if (years < 12) return "kids";
  if (years < 19) return "teens";
  return "adult";
}
