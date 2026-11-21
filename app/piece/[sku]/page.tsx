import Link from "next/link";
import { notFound } from "next/navigation";
import AtelierButton from "../../../components/AtelierButton";
import GiftWrap from "../../../components/GiftWrap";
import PieceFacts from "../../../components/PieceFacts";
import PriceFootnote from "../../../components/PriceFootnote";
import ProductPhoto from "../../../components/ProductPhoto";
import SafetyVerdict from "../../../components/SafetyVerdict";
import TrueSizeViewer from "../../../components/TrueSizeViewer";
import { catalog } from "../../../lib/catalog-store";
import { draftMessage, giftContext, presentationFor } from "../../../lib/gift-message";
import { formatInr } from "../../../lib/matching/templates";
import { modelHref, parseModelParam } from "../../../lib/model-param";
import { toPieceView } from "../../../lib/piece-view";
import { computeVerdict } from "../../../lib/safety";
import { buildSizeSpec } from "../../../lib/size-spec";

/* /piece/[sku] — the piece detail page (PRD §1 steps 5 to 7). Wiring only: it looks the piece
   up, reads the recipient context from `m`, and hands plain data to the components. It does no
   matching (match() is called only from /picks). */
export async function generateStaticParams() {
  return catalog.products.map((p) => ({ sku: p.sku }));
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
      <header className="flex items-center justify-between px-6 py-5 sm:px-10 print:hidden">
        <Link href="/" className="font-display text-2xl font-semibold tracking-wide">
          Tiny Tiaraa
        </Link>
        <Link href="/atelier" className="text-sm hover:underline">
          Browse the atelier
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8 sm:px-10">
        <p className="print:hidden">
          {model ? (
            <Link href={modelHref("/picks", model)} className="text-sm underline">
              Back to your picks
            </Link>
          ) : (
            <Link href="/atelier" className="text-sm underline">
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
                  <span className="shrink-0 rounded-full border border-plum/30 px-3 py-1 text-xs font-medium">
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
              <p className="mt-2 text-xs text-plum/60">Photo as listed — shown enlarged, not to scale.</p>
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
