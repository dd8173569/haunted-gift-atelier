/* Snapshot footnote — required on every price display (PRD §2).
   Prices are a 21 Nov 2026 snapshot; the buy link goes to the live store. */
export default function PriceFootnote() {
  return (
    <p className="text-sm leading-relaxed text-plum/75">
      Price as listed on tinytiaraa.com on 21 Nov 2026 — check the store for
      the current price.
    </p>
  );
}
