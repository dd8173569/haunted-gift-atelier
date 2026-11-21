// The detail page's facts (gift-presentation design §2). Pure: reads catalog fields through
// the documented label maps and nothing else. Never reads mrp_inr, claims,
// design_application_no, or sku_extra.
import type { Category, Product } from "./catalog";
import { AGE_GROUP_LABEL, METAL_LABEL } from "./matching/templates";

export interface Fact {
  label: string;
  value: string;
  /** The catalog field this row comes from. */
  source: string;
}

export interface PieceView {
  sku: string;
  name: string;
  category: Category;
  price_inr: number;
  url: string;
  imageSrc: string;
  inStock: boolean;
  rating: string | null;
  facts: Fact[];
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function toPieceView(product: Product): PieceView {
  const inStock = product.availability === "In Stock";
  const facts: Fact[] = [
    { label: "Category", value: product.category, source: "category" },
    { label: "Metal", value: METAL_LABEL[product.metal], source: "materials" },
    { label: "Materials", value: product.materials, source: "materials" },
    { label: "Weight", value: product.weight, source: "weight" },
    { label: "Dimensions", value: product.dimensions, source: "dimensions" },
  ];
  if (product.chain !== null) facts.push({ label: "Chain", value: product.chain, source: "chain" });
  facts.push(
    {
      label: "Age groups",
      value: product.age_groups.map((g) => capitalise(AGE_GROUP_LABEL[g])).join(", "),
      source: "age_groups",
    },
    { label: "SKU", value: product.sku, source: "sku" },
  );
  if (product.rating !== null) facts.push({ label: "Rating", value: product.rating, source: "rating" });
  facts.push({
    label: "Availability",
    value: inStock ? "In stock" : "Out of stock",
    source: "availability",
  });
  return {
    sku: product.sku,
    name: product.name,
    category: product.category,
    price_inr: product.price_inr,
    url: product.url,
    imageSrc: `/catalog/${product.image_file}`,
    inStock,
    rating: product.rating,
    facts,
  };
}
