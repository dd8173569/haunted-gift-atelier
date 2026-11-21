import Link from "next/link";
import AtelierButton from "../../../components/AtelierButton";

/* Shown when /piece/[sku] gets a SKU that is not in the catalog (REQ-GP-02). No dead end. */
export default function PieceNotFound() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <Link href="/" className="font-display text-2xl font-semibold tracking-wide">
          Tiny Tiaraa
        </Link>
        <Link href="/atelier" className="text-sm hover:underline">
          Browse the atelier
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-6 py-12 sm:px-10">
        <h1 className="font-display text-3xl font-semibold">We couldn&apos;t find that piece.</h1>
        <div className="flex max-w-xs flex-col gap-3">
          <AtelierButton href="/atelier">Browse the atelier</AtelierButton>
          <AtelierButton href="/find" variant="secondary">
            Find a gift
          </AtelierButton>
        </div>
      </main>
    </div>
  );
}
