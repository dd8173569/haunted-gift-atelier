// Test helper: generators for the route-totality properties (reliability design §6.2; REQ-REL-26 to 30).
// `arbParam` is a deliberate near-copy of the `arbParam` and `mutate` inside tests/conversation.property.test.ts
// (the source of the mix: valid, mutated, truncated, repeated, arbitrary JSON, arbitrary string, absent).
// That file is not edited (REQ-REL-53), so the generator is rebuilt here from `arbModel` and `encodeModelParam`.
import fc from "fast-check";
import { MAX_PARAM_LENGTH, encodeModelParam } from "../../lib/model-param";
import type { RecipientModel } from "../../lib/matching/types";
import { catalog } from "./matching-fixtures";
import { arbModel } from "./model-arbitrary";

export type SearchParams = { [key: string]: string | string[] | undefined };

// Same six mutation kinds as conversation.property: each makes a valid model invalid.
const mutate = (m: RecipientModel, kind: number): unknown => {
  const o: Record<string, unknown> = { ...m };
  switch (kind % 6) {
    case 0: delete o.metal; break;
    case 1: o.budgetBand = "cheap"; break;
    case 2: o.extra = 1; break;
    case 3: o.occasion = 7; break;
    case 4: o.symbols = "religious"; o.symbolList = ["om", "om"]; break;
    default: o.ageYears = 25; break;
  }
  return o;
};

export const arbParam: fc.Arbitrary<string | string[] | undefined> = fc.oneof(
  arbModel.map((m) => encodeModelParam(m)),
  fc.tuple(arbModel, fc.nat(100)).map(([m, k]) => JSON.stringify(mutate(m, k))),
  fc.tuple(arbModel, fc.nat(400)).map(([m, n]) => encodeModelParam(m).slice(0, n)),
  fc.tuple(arbModel, arbModel).map(([a, b]) => [encodeModelParam(a), encodeModelParam(b)]),
  fc.anything().map((x) => JSON.stringify(x) ?? "undefined"),
  fc.string({ maxLength: MAX_PARAM_LENGTH + 20 }),
  fc.constant(undefined),
);

/** A valid model parameter only (for the "every in-stock SKU with a valid m" property). */
export const arbValidParam: fc.Arbitrary<string> = arbModel.map((m) => encodeModelParam(m));

const arbValue: fc.Arbitrary<string | string[]> = fc.oneof(
  fc.string({ maxLength: 40 }),
  fc.array(fc.string({ maxLength: 20 }), { maxLength: 3 }),
);

const withDefined = (entries: [string, string | string[] | undefined][]): SearchParams =>
  // Later entries win; `undefined` entries are kept as present keys with an undefined value.
  Object.fromEntries(entries);

/** Keys `m` (arbParam) and `notice`, plus 0..3 arbitrary extra keys. `m` and `notice` win over an extra of the same name. */
export const arbSearchParams: fc.Arbitrary<SearchParams> = fc
  .tuple(
    fc.array(fc.tuple(fc.string({ maxLength: 12 }), arbValue), { maxLength: 3 }),
    arbParam,
    fc.oneof(fc.constant("incomplete"), fc.string({ maxLength: 20 }), fc.constant(undefined)),
    fc.boolean(),
    fc.boolean(),
  )
  .map(([extras, m, notice, hasM, hasNotice]) =>
    withDefined([
      ...extras,
      ...(hasM ? ([["m", m]] as [string, string | string[] | undefined][]) : []),
      ...(hasNotice ? ([["notice", notice]] as [string, string | string[] | undefined][]) : []),
    ]),
  );

const arbFilterValue = (valid: readonly string[]): fc.Arbitrary<string | string[] | undefined> =>
  fc.oneof(
    fc.constantFrom(...valid),
    fc.constantFrom(...valid.map((v) => v.toUpperCase())),
    fc.string({ maxLength: 20 }),
    fc.array(fc.constantFrom(...valid), { minLength: 1, maxLength: 2 }),
    fc.constant(undefined),
  );

/** Keys age, category, metal, budget: a valid value, an upper-cased or arbitrary string, a string[], or undefined. */
export const arbFilterParams: fc.Arbitrary<SearchParams> = fc
  .tuple(
    arbFilterValue(["infants", "kids", "teens", "mom"]),
    arbFilterValue(["pendant", "bracelet", "earrings", "set", "tabeez"]),
    arbFilterValue(["gold", "silver"]),
    arbFilterValue(["under-2500", "2500-15000", "15000-25000", "25000-plus"]),
    fc.array(fc.tuple(fc.string({ maxLength: 10 }), arbValue), { maxLength: 2 }),
  )
  .map(([age, category, metal, budget, extras]) =>
    withDefined([...extras, ["age", age], ["category", category], ["metal", metal], ["budget", budget]]),
  );

const REAL_SKUS = catalog.products.map((p) => p.sku);
const arbRealSku = fc.constantFrom(...REAL_SKUS);

/** The 22 real SKUs, and near-misses of them: lower-cased, padded, truncated, suffixed, percent-encoded; empty; arbitrary; very long. */
export const arbSku: fc.Arbitrary<string> = fc.oneof(
  arbRealSku,
  arbRealSku.map((s) => s.toLowerCase()),
  arbRealSku.map((s) => ` ${s}`),
  arbRealSku.map((s) => `${s} `),
  fc.tuple(arbRealSku, fc.nat(8)).map(([s, n]) => s.slice(0, n)),
  fc.tuple(arbRealSku, fc.string({ minLength: 1, maxLength: 2 })).map(([s, c]) => `${s}${c}`),
  arbRealSku.map((s) => encodeURIComponent(s)),
  arbRealSku.map((s) => s.replace("-", "%2D")),
  fc.constant(""),
  fc.string({ maxLength: 30 }),
  fc.string({ minLength: 200, maxLength: 600 }),
);

/** The oracle for a SKU: strict equality with a catalog SKU, as the page does. */
export const isCatalogSku = (sku: string): boolean => REAL_SKUS.includes(sku);
