import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AtelierButton from "../../components/AtelierButton";
import DisclosureNote from "../../components/DisclosureNote";
import PickCard from "../../components/PickCard";
import SiteHeader from "../../components/SiteHeader";
import { describeModel, momSkipNote } from "../../lib/conversation";
import { catalog } from "../../lib/catalog-store";
import { match } from "../../lib/matching";
import { modelHref, parseModelParam, pieceHref } from "../../lib/model-param";
import { ROUTE_TITLES } from "../../lib/page-meta";
import { toPickViews } from "../../lib/picks-view";

export const metadata: Metadata = { title: ROUTE_TITLES.picks };

/* Dev-only "instant" validation off for this page (polish-deploy design §8, decision (a), REQ-PD-47).
   The recipient model lives in the URL (`m`), so the picks depend on request data by design. The build is unaffected; the route still prerenders its shell and streams the body. */
export const instant = false;

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
      <SiteHeader links={[{ href: "/atelier", label: "Browse the atelier" }]} />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8 outline-none sm:px-10"
      >
        <div>
          <h1 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">Your picks</h1>
          <p className="mt-2 text-plum/80">{headline}</p>
        </div>
        <DisclosureNote sentences={result.disclosures} />
        {views.length > 0 && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {views.map((v) => (
              <PickCard key={v.sku} view={v} detailHref={pieceHref(v.sku, model)} />
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
          <Link
            href={modelHref("/find", model)}
            className="inline-flex min-h-11 items-center underline"
          >
            Change my answers
          </Link>
        </p>
      </main>
    </div>
  );
}
