// M1: formatInr properties (reliability REQ-REL-34). Money is an integer number of rupees formatted by one
// helper in the Indian grouping style (tech.md). Existing tests give examples; this pins the property.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { formatInr } from "../lib/matching/templates";
import { catalog } from "./helpers/matching-fixtures";

const SEED = 20261201;
const RUNS = 500;
const assert = <T extends unknown[]>(p: fc.IPropertyWithHooks<T>) => fc.assert(p, { seed: SEED, numRuns: RUNS });

const PATTERN = /^₹(\d{1,3}|\d{1,2}(,\d{2})*,\d{3})$/;
const arbRupees = fc.integer({ min: 0, max: 1_000_000_000 });
// Bias a share of runs to the group boundaries, where an off-by-one in grouping would show.
const arbBoundary = fc
  .tuple(fc.integer({ min: 1, max: 9 }), fc.constantFrom(-1, 0, 1))
  .map(([digits, d]) => Math.min(1_000_000_000, Math.max(0, 10 ** digits + d)));
const arbAmount = fc.oneof(arbRupees, arbBoundary);
const digitsOf = (s: string) => s.replace(/[^\d]/g, "");

describe("M1 formatInr", () => {
  it("matches the Indian grouping pattern for every integer in [0, 10^9]", () => {
    assert(fc.property(arbAmount, (n) => PATTERN.test(formatInr(n))));
  });

  it("removing ₹ and commas returns the integer exactly", () => {
    assert(fc.property(arbAmount, (n) => Number(digitsOf(formatInr(n))) === n && digitsOf(formatInr(n)) === String(n)));
  });

  it("never contains '.', NaN, or Infinity", () => {
    assert(fc.property(arbAmount, (n) => !/[.]|NaN|Infinity/.test(formatInr(n))));
  });

  it("is deterministic", () => {
    assert(fc.property(arbAmount, (n) => formatInr(n) === formatInr(n)));
  });

  it("digit count is monotone in the input", () => {
    assert(
      fc.property(arbAmount, arbAmount, (a, b) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        return digitsOf(formatInr(lo)).length <= digitsOf(formatInr(hi)).length;
      }),
    );
  });

  it("a negative input renders -₹ with the same digits as its absolute value", () => {
    assert(
      fc.property(fc.integer({ min: 1, max: 1_000_000_000 }), (n) => {
        const neg = formatInr(-n);
        return neg === `-${formatInr(n)}` && neg.startsWith("-₹") && digitsOf(neg) === digitsOf(formatInr(n));
      }),
    );
  });

  it("zero is ₹0 and has no sign", () => {
    expect(formatInr(0)).toBe("₹0");
    expect(formatInr(-0)).toBe("₹0");
  });

  it("the 22 catalog prices format to the pattern and round-trip", () => {
    expect(catalog.products).toHaveLength(22);
    for (const p of catalog.products) {
      const s = formatInr(p.price_inr);
      expect(s, p.sku).toMatch(PATTERN);
      expect(Number(digitsOf(s)), p.sku).toBe(p.price_inr);
    }
  });
});
