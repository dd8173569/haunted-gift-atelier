import Link from "next/link";
import { redirect } from "next/navigation";
import AtelierButton from "../../components/AtelierButton";
import DisclosureNote from "../../components/DisclosureNote";
import PickCard from "../../components/PickCard";
import { describeModel, momSkipNote } from "../../lib/conversation";
import { catalog } from "../../lib/catalog-store";
import { match } from "../../lib/matching";
import { modelHref, parseModelParam } from "../../lib/model-param";
import { toPickViews } from "../../lib/picks-view";

/* /picks — the picks for the confirmed model (PRD §1 step 4).
   The only match() call in the app. Missing/invalid `m` redirects (REQ-CV-20);
   redirect() throws by design, so both calls sit outside any try/catch. */
export default async function PicksPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const parsed = parseModelParam(sp.m);
  if (parsed.status === "missing") redirect("/find");
  if (parsed.status === "invalid") redirect("/find?notice=incomplete");

  const model = parsed.model;
  const result = match(model, catalog);
  const views = toPickViews(result, catalog);
  const { headline } = describeModel(model, momSkipNote(catalog));

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
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8 sm:px-10">
        <div>
          <h1 className="font-display text-3xl font-semibold">Your picks</h1>
          <p className="mt-2 text-plum/80">{headline}</p>
        </div>
        <DisclosureNote sentences={result.disclosures} />
        {views.length > 0 && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {views.map((v) => (
              <PickCard key={v.sku} view={v} />
            ))}
          </div>
        )}
        {result.shortfallNote !== undefined && <p className="text-plum/85">{result.shortfallNote}</p>}
        {result.showBrowseLink && (
          <div className="max-w-xs">
            <AtelierButton href="/atelier" variant="secondary">
              Browse the full atelier
            </AtelierButton>
          </div>
        )}
        <p>
          <Link href={modelHref("/find", model)} className="underline">
            Change my answers
          </Link>
        </p>
      </main>
    </div>
  );
}
