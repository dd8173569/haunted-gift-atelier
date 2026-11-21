// Page titles and descriptions (polish-deploy design §6, REQ-PD-33 to 36). Pure string building:
// every fact comes from the catalog product passed in. No price, rating, or claim appears here.
import type { Product } from "./catalog";
import { AGE_GROUP_LABEL, METAL_LABEL } from "./matching/templates";

export const SITE_TITLE = "Haunted Gift Atelier — Tiny Tiaraa";
/** Next.js `title.template`: `%s` is the child route's title. */
export const TITLE_TEMPLATE = "%s | Haunted Gift Atelier";

export const ROUTE_TITLES = {
  find: "Find a gift",
  picks: "Your picks",
  atelier: "The atelier",
  pieceNotFound: "Piece not found",
} as const;

/** The catalog name verbatim, plus " (out of stock)" when the listing says so. */
export function pieceTitle(product: Pick<Product, "name" | "availability">): string {
  return product.availability === "Out of Stock" ? `${product.name} (out of stock)` : product.name;
}

/** One sentence from catalog fields only. The name is verbatim and no price or rating is included. */
export function pieceDescription(
  product: Pick<Product, "name" | "category" | "metal" | "age_groups">,
): string {
  const parts: string[] = [product.category, METAL_LABEL[product.metal]];
  if (product.age_groups.length > 0) {
    parts.push(`listed for ${product.age_groups.map((g) => AGE_GROUP_LABEL[g]).join(", ")}`);
  }
  return `${product.name}: ${parts.join(", ")}. See the fit check, a size view you calibrate, and a gift wrap.`;
}
