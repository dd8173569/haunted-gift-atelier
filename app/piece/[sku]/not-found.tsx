import AtelierButton from "../../../components/AtelierButton";
import SiteHeader from "../../../components/SiteHeader";

/* Shown when /piece/[sku] gets a SKU that is not in the catalog (REQ-GP-02). No dead end. */
export default function PieceNotFound() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader links={[{ href: "/atelier", label: "Browse the atelier" }]} />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-6 py-12 outline-none sm:px-10"
      >
        <h1 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">We couldn&apos;t find that piece.</h1>
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
