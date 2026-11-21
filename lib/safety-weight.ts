// Check 3: weight context (REQ-SV-13 to REQ-SV-15). Pure; integer hundredths of a gram.
import type { ParsedCatalog, Product } from "./catalog";
import { AGE_LABEL } from "./matching/age";
import type { AgeBand } from "./matching/types";

export const WEIGHT_FLAG_RATIO = 1.5; // more than 50% above the median
export const MIN_POOL = 3;

const BAND_ORDER: readonly AgeBand[] = ["infants", "kids", "teens", "mom"];

export interface WeightContext {
  band: AgeBand;
  median_g: number;
  n: number;
  threshold_g: number;
}

const toHundredths = (g: number) => Math.round(g * 100);
const trim = (x: number, digits: number) => String(Number(x.toFixed(digits)));

/** The recipient band, else the youngest band the product lists. */
export function referenceBand(product: Product, band: AgeBand | null): AgeBand | null {
  if (band) return band;
  const youngest = BAND_ORDER.find((b) => product.age_groups.includes(AGE_LABEL[b]));
  if (!youngest) throw new Error(`product ${product.sku} lists no age group`);
  return youngest;
}

/** Ascending weight_g of in-stock products that list the band and have a weight. */
export function weightPool(catalog: ParsedCatalog, band: AgeBand): number[] {
  return catalog.products
    .filter(
      (p) =>
        p.availability === "In Stock" &&
        p.weight_g !== null &&
        p.age_groups.includes(AGE_LABEL[band]),
    )
    .map((p) => p.weight_g as number)
    .sort((a, b) => a - b);
}

/** Twice the median in hundredths: an integer even for even-sized pools. */
function median2(sortedAsc: readonly number[]): number {
  const h = sortedAsc.map(toHundredths);
  const n = h.length;
  if (n === 0) throw new Error("median of empty list");
  return n % 2 === 1 ? 2 * h[(n - 1) / 2] : h[n / 2 - 1] + h[n / 2];
}

/** Middle value of an ascending list; mean of the two middles when even. */
export function median(sortedAsc: readonly number[]): number {
  return median2(sortedAsc) / 200;
}

/** `sufficient` is false when the pool is under MIN_POOL; then `flag` is always false. */
export function weightContext(
  weightG: number,
  pool: readonly number[],
  band: AgeBand,
): WeightContext & { flag: boolean; sufficient: boolean } {
  const n = pool.length;
  if (n === 0) {
    return { band, median_g: NaN, n, threshold_g: NaN, flag: false, sufficient: false };
  }
  const m2 = median2(pool);
  const sufficient = n >= MIN_POOL;
  // w > 1.5 × median  ⇔  4·W > 3·median2 (W and median2 in hundredths)
  const flag = sufficient && 4 * toHundredths(weightG) > 3 * m2;
  return {
    band,
    median_g: Number(trim(m2 / 200, 3)),
    n,
    threshold_g: Number(trim((m2 * 3) / 400, 4)),
    flag,
    sufficient,
  };
}

/** Prints weight_g without trailing zeros: 6 → "6", 4.05 → "4.05". */
export const formatGrams = (g: number) => trim(g, 3);
