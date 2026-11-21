// P-PD-4 and P-PD-5 (REQ-PD-57, 58). Node environment, seeded.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { AgeGroup, Category, Product } from "../lib/catalog";
import { AGE_GROUP_LABEL, METAL_LABEL } from "../lib/matching/templates";
import { ROUTE_TITLES, SITE_TITLE, TITLE_TEMPLATE, pieceDescription, pieceTitle } from "../lib/page-meta";
import { catalog } from "./helpers/matching-fixtures";

const SEED = 20261124;
const RUNS = 300;

/** What a title or description must never contain outside the product name. */
const BANNED = /₹|\d,\d{3}|%|\bsave\b|\boff\b|\bMRP\b|certif|hypoallergenic|\bsafe\b|\bunsafe\b|true[- ]size/i;

type Input = Pick<Product, "name" | "category" | "metal" | "age_groups" | "availability">;
const CATEGORIES: Category[] = ["Pendant", "Bracelet", "Earrings", "Set", "Tabeez"];
const AGES = Object.keys(AGE_GROUP_LABEL) as AgeGroup[];

const arbInput: fc.Arbitrary<Input> = fc.record({
  // Names with letters, digits, spaces, and the punctuation the catalog uses. Never the phrase "out of stock".
  name: fc
    .stringMatching(/^[A-Za-z0-9][A-Za-z0-9 .,'–-]{0,60}$/)
    .filter((n) => !/out of stock/i.test(n) && n === n.trim()),
  category: fc.constantFrom(...CATEGORIES),
  metal: fc.constantFrom("gold" as const, "silver" as const),
  age_groups: fc.uniqueArray(fc.constantFrom(...AGES), { minLength: 1, maxLength: 4 }),
  availability: fc.constantFrom("In Stock" as const, "Out of Stock" as const),
});

const countOf = (haystack: string, needle: string) => haystack.split(needle).length - 1;
/** The text after the leading name. Both strings start with the name, so this is the part the code adds. */
const afterName = (text: string, name: string) => text.slice(name.length);
const digits = (s: string) => new Set(s.match(/\d/g) ?? []);

/**
 * Digits a description may contain: those of the name, the age-group labels, and the metal label
 * ("18KT gold", "925 silver"). REQ-PD-57 names only the name and the age label; the metal label is
 * part of the pinned sentence (REQ-PD-35), so its digits are allowed too. Recorded as a spec question.
 */
function allowedDigits(p: Input): Set<string> {
  const labels = p.age_groups.map((g) => AGE_GROUP_LABEL[g]).join(" ");
  return digits(`${p.name} ${labels} ${METAL_LABEL[p.metal]}`);
}

/**
 * The name is verbatim at the start of both strings. "Exactly once" is only meaningful for names that
 * do not occur in the fixed text (a generated name such as "a" does), so it is asserted on the
 * catalog's real names in `checkCatalogOne`, and by position here.
 */
function checkOne(p: Input) {
  const t = pieceTitle(p);
  const d = pieceDescription(p);
  expect(t.startsWith(p.name), `title starts with the name: ${t}`).toBe(true);
  expect(d.startsWith(`${p.name}: `), `description starts with the name: ${d}`).toBe(true);
  expect(afterName(t, p.name) === " (out of stock)").toBe(p.availability === "Out of Stock");
  expect(afterName(t, p.name) === "" || afterName(t, p.name) === " (out of stock)").toBe(true);
  expect(/out of stock/i.test(afterName(d, p.name))).toBe(false);
  expect(BANNED.test(afterName(t, p.name)), `title: ${t}`).toBe(false);
  expect(BANNED.test(afterName(d, p.name)), `description: ${d}`).toBe(false);
  for (const ch of digits(afterName(d, p.name))) {
    expect(allowedDigits(p).has(ch), `digit ${ch} in: ${d}`).toBe(true);
  }
  expect(pieceTitle(p)).toBe(t);
  expect(pieceDescription(p)).toBe(d);
}

describe("P-PD-4 titles and descriptions are grounded (REQ-PD-57)", () => {
  it("holds for all 22 catalog products, and the real name occurs exactly once in each", () => {
    expect(catalog.products).toHaveLength(22);
    for (const p of catalog.products) {
      checkOne(p);
      expect(countOf(pieceTitle(p), p.name), p.sku).toBe(1);
      expect(countOf(pieceDescription(p), p.name), p.sku).toBe(1);
      expect(/out of stock/i.test(pieceTitle(p)), p.sku).toBe(p.availability === "Out of Stock");
    }
  });
  it("holds for generated products", () => {
    fc.assert(
      fc.property(arbInput, (p) => {
        checkOne(p);
        return true;
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
  it("the title differs from the name only by the out-of-stock suffix", () => {
    fc.assert(
      fc.property(arbInput, (p) => {
        const t = pieceTitle(p);
        return p.availability === "Out of Stock" ? t === `${p.name} (out of stock)` : t === p.name;
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
  it("does not change its input", () => {
    fc.assert(
      fc.property(arbInput, (p) => {
        const before = JSON.stringify(p);
        pieceTitle(p);
        pieceDescription(p);
        return JSON.stringify(p) === before;
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
});

describe("P-PD-5 routes have distinct titles (REQ-PD-58)", () => {
  /** The `<title>` the browser shows: the template applied to every child route, the default for the landing. */
  const rendered = (t: string) => TITLE_TEMPLATE.replace("%s", t);

  it("landing, /find, /picks, /atelier and the 22 pieces are pairwise distinct and non-empty", () => {
    const titles = [
      SITE_TITLE,
      rendered(ROUTE_TITLES.find),
      rendered(ROUTE_TITLES.picks),
      rendered(ROUTE_TITLES.atelier),
      ...catalog.products.map((p) => rendered(pieceTitle(p))),
    ];
    expect(titles).toHaveLength(26);
    expect(titles.every((t) => t.trim().length > 0)).toBe(true);
    expect(new Set(titles).size).toBe(titles.length);
  });
  it("the out-of-stock variant of every piece is also distinct from the in-stock set", () => {
    const names = catalog.products.map((p) => p.name);
    const variants = catalog.products.map((p) => pieceTitle({ name: p.name, availability: "Out of Stock" }));
    expect(new Set([...names, ...variants, ...Object.values(ROUTE_TITLES), SITE_TITLE]).size).toBe(
      names.length + variants.length + Object.values(ROUTE_TITLES).length + 1,
    );
  });
  it("the landing title is not suffixed twice: it does not contain the template suffix pattern", () => {
    expect(SITE_TITLE.includes("|")).toBe(false);
  });
});
