import type { BrowseItem } from "../lib/browse";
import { METAL_LABEL, formatInr } from "../lib/matching/templates";
import { pieceHref } from "../lib/model-param";
import AtelierButton from "./AtelierButton";
import ProductPhoto from "./ProductPhoto";

/* One grid card (REQ-CV-39). Out-of-stock is read from `availability` only:
   the card surface and text are muted, the photo is left exactly as it is
   (no opacity, grayscale or filter), and there is no buy control (REQ-CV-38).
   The price footnote is carried once by the grid's price region.
   "See details" is on every card, out-of-stock included: a navigation link, not a buy control
   (REQ-GP-11). */
export default function BrowseCard({ item }: { item: BrowseItem }) {
  const inStock = item.availability === "In Stock";
  return (
    <article
      data-sku={item.sku}
      className={`flex flex-col gap-3 rounded-3xl p-4 ${
        inStock ? "bg-blush/50" : "bg-plum/5 text-plum/50"
      }`}
    >
      <ProductPhoto src={item.imageSrc} alt={item.name} />
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">{item.name}</h2>
        {!inStock && (
          <span className="shrink-0 rounded-full border border-plum/30 px-3 py-1 text-xs font-medium">
            Out of stock
          </span>
        )}
      </div>
      <p className="flex items-baseline justify-between gap-3">
        <span className="text-lg font-semibold">{formatInr(item.price_inr)}</span>
        {item.rating !== null && <span className="text-sm">Rated {item.rating}</span>}
      </p>
      <p className="text-sm">
        {item.category} · {METAL_LABEL[item.metal]}
      </p>
      <div className="mt-auto flex flex-col gap-2 pt-2">
        <AtelierButton href={pieceHref(item.sku)} variant="secondary">
          See details
        </AtelierButton>
        {inStock && (
          <AtelierButton href={item.url} external>
            Buy on Tiny Tiaraa ↗
          </AtelierButton>
        )}
      </div>
    </article>
  );
}
