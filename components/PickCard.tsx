import type { PickView } from "../lib/picks-view";
import { formatInr } from "../lib/matching/templates";
import AtelierButton from "./AtelierButton";
import PriceFootnote from "./PriceFootnote";
import ProductPhoto from "./ProductPhoto";

/* One pick: a price region (REQ-CV-28). Receives a PickView, never reads the catalog.
   "See details" is a navigation link to /piece/[sku], passed in by /picks (REQ-GP-10, which
   supersedes the M2 ban of REQ-CV-33). It is optional so a card can render without it. */
export default function PickCard({ view, detailHref }: { view: PickView; detailHref?: string }) {
  return (
    <article data-price-region className="flex flex-col gap-3 rounded-3xl bg-blush/50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
        Pick {view.rank} · {view.category}
      </p>
      <ProductPhoto src={view.imageSrc} alt={view.name} />
      <h2 className="font-display text-xl font-semibold">{view.name}</h2>
      <p className="flex items-baseline justify-between gap-3">
        <span className="text-lg font-semibold">{formatInr(view.price_inr)}</span>
        {view.rating !== null && <span className="text-sm text-plum/75">Rated {view.rating}</span>}
      </p>
      <PriceFootnote />
      {view.markerLabels.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {view.markerLabels.map((label) => (
            <li key={label} className="rounded-full bg-champagne px-3 py-1 text-xs font-medium">
              {label}
            </li>
          ))}
        </ul>
      )}
      {view.relaxationNote !== undefined && <p className="text-sm">{view.relaxationNote}</p>}
      <h3 className="text-sm font-semibold">Why this one</h3>
      <ul className="list-disc space-y-1 pl-5 text-sm text-plum/85">
        {view.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <div className="mt-auto flex flex-col gap-2 pt-2">
        {detailHref !== undefined && (
          <AtelierButton href={detailHref} variant="secondary">
            See details
          </AtelierButton>
        )}
        <AtelierButton href={view.url} external>
          Buy on Tiny Tiaraa ↗
        </AtelierButton>
      </div>
    </article>
  );
}
