import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AtelierButton from "../../../components/AtelierButton";
import GiftWrap from "../../../components/GiftWrap";
import PieceFacts from "../../../components/PieceFacts";
import PriceFootnote from "../../../components/PriceFootnote";
import ProductPhoto from "../../../components/ProductPhoto";
import SafetyVerdict from "../../../components/SafetyVerdict";
import SiteHeader from "../../../components/SiteHeader";
import TrueSizeViewer from "../../../components/TrueSizeViewer";
import { catalog } from "../../../lib/catalog-store";
import { draftMessage, giftContext, presentationFor } from "../../../lib/gift-message";
import { formatInr } from "../../../lib/matching/templates";
import { modelHref, parseModelParam } from "../../../lib/model-param";
import { pieceDescription, pieceTitle, ROUTE_TITLES } from "../../../lib/page-meta";
import { toPieceView } from "../../../lib/piece-view";
import { computeVerdict } from "../../../lib/safety";
import { buildSizeSpec } from "../../../lib/size-spec";

/* Dev-only "instant" validation off for this page (polish-deploy design §8, decision (a), REQ-PD-47).
   The page reads `params` and the recipient context `m` from the URL by design. The build is unaffected; the route still prerenders its shell and streams the body. */
export const instant = false;

/* /piece/[sku] — the piece detail page (PRD §1 steps 5 to 7). Wiring only: it looks the piece
   up, reads the recipient context from `m`, and hands plain data to the components. It does no
   matching (match() is called only from /picks). */
export async function generateStaticParams() {
  return catalog.products.map((p) => ({ sku: p.sku }));
}

/* Title and description come from the catalog product only (REQ-PD-34, 35). An unknown SKU gets
   a plain title and no description; the page itself then calls notFound(). */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ sku: string }>;
}): Promise<Metadata> {
  const { sku } = await params;
  const product = catalog.products.find((p) => p.sku === sku);
  return product
    ? { title: pieceTitle(product), description: pieceDescription(product) }
    : { title: ROUTE_TITLES.pieceNotFound };
}

export default async function PiecePage({
  params,
  searchParams,
}: {
  params: Promise<{ sku: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { sku } = await params;
  const product = catalog.products.find((p) => p.sku === sku);
  if (!product) notFound(); // throws by design; not inside any try/catch

  const sp = await searchParams;
  // 'missing' and 'invalid' both mean: no recipient. No redirect, no error.
  const parsed = parseModelParam(sp.m);
  const model = parsed.status === "ok" ? parsed.model : null;

  const view = toPieceView(product);
  const verdict = computeVerdict(product, catalog, model ? model.ageBand : null);
  const spec = buildSizeSpec(product);
  const ctx = giftContext(model);

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader links={[{ href: "/atelier", label: "Browse the atelier" }]} />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8 outline-none sm:px-10"
      >
        <p className="print:hidden">
          {model ? (
            <Link href={modelHref("/picks", model)} className="inline-flex min-h-11 items-center text-sm underline">
              Back to your picks
            </Link>
          ) : (
            <Link href="/atelier" className="inline-flex min-h-11 items-center text-sm underline">
              Back to the atelier
            </Link>
          )}
        </p>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="flex flex-col gap-6 print:hidden">
            <div data-price-region className="flex flex-col gap-2">
              <div className="flex flex-wrap items-start gap-3">
                <h1 className="font-display text-3xl font-semibold">{view.name}</h1>
                {!view.inStock && (
                  <span className="shrink-0 rounded-full border border-plum/60 px-3 py-1 text-xs font-medium">
                    Out of stock
                  </span>
                )}
              </div>
              <p className="flex items-baseline gap-4">
                <span className="text-2xl font-semibold">{formatInr(view.price_inr)}</span>
                {view.rating !== null && <span className="text-sm text-plum/75">Rated {view.rating}</span>}
              </p>
              <PriceFootnote />
            </div>
            <div>
              <ProductPhoto src={view.imageSrc} alt={view.name} priority />
              <p className="mt-2 text-sm text-plum/75">Photo as listed — shown enlarged, not to scale.</p>
            </div>
            <PieceFacts facts={view.facts} />
          </div>
          <div className="flex flex-col gap-6">
            <div className="print:hidden">
              <SafetyVerdict verdict={verdict} />
            </div>
            <TrueSizeViewer spec={spec} />
            <div className="print:hidden">
              {view.inStock ? (
                <GiftWrap
                  name={view.name}
                  url={view.url}
                  initialMessage={draftMessage(ctx, view.name)}
                  presentation={presentationFor(ctx)}
                />
              ) : (
                <div className="flex flex-col gap-3 rounded-2xl bg-plum/5 p-6">
                  <p>This piece is out of stock on the listing.</p>
                  <div className="max-w-xs">
                    <AtelierButton href="/atelier" variant="secondary">
                      Browse the atelier
                    </AtelierButton>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
