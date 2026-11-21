import Link from "next/link";
import CatalogGrid from "../../components/CatalogGrid";
import { parseBrowseFilters, toBrowseItems } from "../../lib/browse";
import { catalog } from "../../lib/catalog-store";

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
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <Link href="/" className="font-display text-2xl font-semibold tracking-wide">
          Tiny Tiaraa
        </Link>
        <Link href="/" className="text-sm hover:underline">
          ← Back to the atelier
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8 sm:px-10">
        <div>
          <h1 className="font-display text-3xl font-semibold">The atelier</h1>
          <p className="mt-2 text-plum/80">
            Every piece in one place. Out-of-stock pieces are shown muted, with no buy link.
          </p>
        </div>
        <CatalogGrid items={items} initialFilters={initialFilters} />
      </main>
    </div>
  );
}
