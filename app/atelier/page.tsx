import type { Metadata } from "next";
import CatalogGrid from "../../components/CatalogGrid";
import SiteHeader from "../../components/SiteHeader";
import { parseBrowseFilters, toBrowseItems } from "../../lib/browse";
import { catalog } from "../../lib/catalog-store";
import { ROUTE_TITLES } from "../../lib/page-meta";

export const metadata: Metadata = { title: ROUTE_TITLES.atelier };

/* Dev-only "instant" validation off for this page (polish-deploy design §8, decision (a), REQ-PD-47).
   The filters live in the URL, so the grid depends on request data by design. The build is unaffected; the route still prerenders its shell and streams the body. */
export const instant = false;

/* /atelier — the browse-all escape hatch (PRD §1). Works with no query;
   unknown filter values fall back to "All" (REQ-CV-36). */
export default async function AtelierPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const initialFilters = parseBrowseFilters(await searchParams);
  const items = toBrowseItems(catalog);

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader links={[{ href: "/", label: "← Back to the atelier" }]} />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8 outline-none sm:px-10"
      >
        <div>
          <h1 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">The atelier</h1>
          <p className="mt-2 text-plum/80">
            Every piece in one place. Out-of-stock pieces are shown muted, with no buy link.
          </p>
        </div>
        <CatalogGrid items={items} initialFilters={initialFilters} />
      </main>
    </div>
  );
}
