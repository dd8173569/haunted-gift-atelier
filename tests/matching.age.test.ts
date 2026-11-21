import { describe, expect, it } from "vitest";
import { AGE_LABEL, ageYearsToBand } from "../lib/matching/age";

describe("ageYearsToBand (REQ-MC-02, REQ-MC-03)", () => {
  it.each([
    [0, "infants"],
    [0.5, "infants"],
    [2.999, "infants"],
    [3, "kids"],
    [11.999, "kids"],
    [12, "teens"],
    [18.999, "teens"],
    [19, "adult"],
    [40, "adult"],
  ])("%s -> %s", (years, band) => {
    expect(ageYearsToBand(years)).toBe(band);
  });

  it.each([-1, -0.001, NaN, Infinity, -Infinity, "3" as unknown as number, null as unknown as number])(
    "rejects %s",
    (bad) => {
      expect(() => ageYearsToBand(bad)).toThrow(RangeError);
    },
  );

  it("labels match the catalog age-group strings", () => {
    expect(AGE_LABEL).toEqual({
      infants: "Infants 0-3 years",
      kids: "Kids 3-12 years",
      teens: "Teens 12-19 years",
      mom: "Mom",
    });
  });
});
