import Link from "next/link";

/* /atelier — browse grid (PRD §1, escape hatch).
   Milestone 1 shell: the grid opens in Milestone 3. */
export default function AtelierPage() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center px-6 py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">
        Haunted Gift Atelier
      </p>
      <h1 className="mt-4 font-display text-4xl font-semibold">
        The browse grid opens in Milestone 3.
      </h1>
      <p className="mt-4 max-w-md text-plum/75">
        All 21 in-stock pieces in a filterable grid — plus the one out-of-stock
        piece, shown greyed-out, because the atelier is honest about inventory.
      </p>
      <Link href="/" className="mt-8 hover:underline">
        ← Back to the atelier
      </Link>
    </div>
  );
}
