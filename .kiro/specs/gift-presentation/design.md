# Gift Presentation — Design

*Implements REQ-GP-01 to REQ-GP-41 (`requirements.md`). Source: PRD §1 steps 5 to 7, architecture §7–§8, steering `product.md`, `tech.md`, `structure.md`. Integrates `safety-verdict` and `true-size-viewer`; links from `conversation` cards. Nothing in `lib/matching.ts`, `lib/matching/`, `lib/catalog.ts`, `data/catalog.json`, or `data/*.ts` changes.*

## 1. Overview

```
/picks  ── PickCard "See details" ──► /piece/TBZ-1013?m=<model JSON>
/atelier ─ BrowseCard "See details" ─► /piece/TNZ-1058            (no m)

/piece/[sku]   (server component, awaits params + searchParams)
  sku ──► catalog.products.find ──► notFound() when absent
  m   ──► parseModelParam ──► model | null ──► band = model?.ageBand ?? null
  ├─ toPieceView(product)                    ─► title block, facts            (lib/piece-view.ts)
  ├─ computeVerdict(product, catalog, band)  ─► <SafetyVerdict>               (safety-verdict)
  ├─ buildSizeSpec(product)                  ─► <TrueSizeViewer>  (client)    (true-size-viewer)
  └─ draftMessage(ctx, name) + presentationFor(ctx)
                                             ─► <GiftWrap>        (client)    (lib/gift-message.ts)
                                                  idle ─ Wrap this gift ─► wrapping (2.4 s, CSS) ─► revealed
                                                  revealed: card + editable message + Buy on Tiny Tiaraa ↗ (catalog url)
```

The page does no matching and holds no user state. The recipient model arrives only as context: its age band feeds the safety card, and its relationship and occasion feed the message and the card. Nothing about the recipient is stored or sent anywhere.

### File map

| File | Contents | Pure? |
|---|---|---|
| `app/piece/[sku]/page.tsx` | the server page (route only; wiring) | route |
| `app/piece/[sku]/not-found.tsx` | the not-found UI | route |
| `lib/piece-view.ts` | `PieceView`, `Fact`, `toPieceView()` | yes |
| `lib/gift-message.ts` | `WRAP_REVEAL_MS`, `WRAP_REVEAL_MAX_MS`, `CARD_FADE_MS`, `MESSAGE_MAX_LENGTH`, `giftContext()`, `draftMessage()`, `presentationFor()` | yes |
| `lib/model-param.ts` | gains `pieceHref(sku, model?)` (existing file; new export only) | yes |
| `components/PieceFacts.tsx` | the facts `<dl>` from `PieceView.facts` | UI |
| `components/GiftWrap.tsx` | the wrap, editor, card, buy link | client |
| `components/PickCard.tsx`, `components/BrowseCard.tsx` | gain the "See details" link | UI |
| `app/globals.css` | gains the wrap keyframes and classes (no colours) | tokens file |

## 2. `lib/piece-view.ts`

```ts
export interface Fact { label: string; value: string; source: string }   // source = catalog field name
export interface PieceView {
  sku: string; name: string; category: Category;
  price_inr: number; url: string; imageSrc: string;
  inStock: boolean; rating: string | null;
  facts: Fact[];
}
export function toPieceView(product: Product): PieceView
```

Facts, in order, each from one catalog field (REQ-GP-05):

| Label | Value | `source` | Row exists |
|---|---|---|---|
| Category | `category` | `category` | always |
| Metal | `METAL_LABEL[metal]` ("18KT gold", "925 silver") | `materials` | always |
| Materials | `materials` verbatim | `materials` | always |
| Weight | `weight` verbatim | `weight` | always |
| Dimensions | `dimensions` verbatim | `dimensions` | always |
| Chain | `chain` verbatim | `chain` | `chain !== null` |
| Age groups | `age_groups` through `AGE_GROUP_LABEL`, first letter capitalised, joined ", " | `age_groups` | always |
| SKU | `sku` | `sku` | always |
| Rating | `rating` verbatim ("4.8/5 (5 reviews)") | `rating` | `rating !== null` |
| Availability | "In stock" or "Out of stock" | `availability` | always |

`toPieceView` never reads `mrp_inr`, `claims`, `design_application_no`, or `sku_extra`. The design application number is a listing-internal reference that a reader could take for a certification, and claims belong to the safety card; neither is a buyer fact the PRD asks for on this page (open question Q21). `PieceFacts` renders each row as `<dt>`/`<dd>` with `data-source`. The price is not a fact row: it sits in the title block's price region.

## 3. `lib/gift-message.ts`

```ts
export const WRAP_REVEAL_MS = 2400;       // wrapping phase length
export const CARD_FADE_MS = 400;          // fade-in of the revealed card
export const WRAP_REVEAL_MAX_MS = 3000;   // WRAP_REVEAL_MS + CARD_FADE_MS = 2800 <= 3000
export const MESSAGE_MAX_LENGTH = 500;

export interface GiftContext { relationship: Relationship | null; occasion: Occasion | null }
export function giftContext(model: RecipientModel | null): GiftContext   // null model -> both null
export function draftMessage(ctx: GiftContext, productName: string): string
export interface Presentation { heading: string; subheading: string; tone: "blush" | "champagne" | "sage" }
export function presentationFor(ctx: GiftContext): Presentation
```

`Relationship` and `Occasion` are the existing types (`lib/matching/types.ts`, `data/occasion-map.ts`); this module imports them and defines no recipient type of its own.

### 3.1 The draft

Four lines joined by `\n`:

```
{salutation}
{occasion line}
I chose “{productName}” for you.
With love,
```

| Relationship | Salutation |
|---|---|
| niece-nephew | "To my little niece or nephew," |
| grandchild | "To my dear grandchild," |
| friends-baby | "To my friend's little one," |
| godchild | "To my dear godchild," |
| own-child | "To my little one," |
| mom | "To Mom," |
| other | "To a little one I care about," |
| null (no recipient) | "To someone special," |

| Occasion | Occasion line |
|---|---|
| naming | "Welcome to the world, and congratulations on your naming ceremony." |
| birthday | "Happy birthday!" |
| first-birthday | "Happy first birthday!" |
| baby-shower | "Congratulations on the baby shower." |
| festival | "Wishing you a joyful festival." |
| rakhi | "Happy Rakhi!" |
| just-because | "Just because you are loved." |
| other, null | "Thinking of you." |

The product name goes in curly quotes because some catalog names end in a full stop ("Swastik - Tabeez for Lucky Charms.") and a few contain a digit ("925 Silver"). The relationship describes the recipient to the buyer ("your niece or nephew" on the card of `conversation`); the salutation turns it into the buyer's voice without guessing whether the buyer is an aunt or an uncle. The draft is deterministic: no clock, no randomness, no LLM. The longest catalog name is 84 characters, so every draft stays far below 500; a test checks all 22 × 7 × 8 combinations.

### 3.2 The presentation card

| Occasion | `heading` | `subheading` | `tone` |
|---|---|---|---|
| naming | "Welcome, little one" | "A gift for a naming ceremony" | blush |
| birthday | "Happy birthday" | "A birthday gift" | champagne |
| first-birthday | "A first birthday" | "A gift for a first birthday" | champagne |
| baby-shower | "Congratulations" | "A baby shower gift" | sage |
| festival | "With festival wishes" | "A festival gift" | sage |
| rakhi | "Happy Rakhi" | "A Rakhi gift" | blush |
| just-because | "Just because" | "A little gift, just because" | sage |
| other, null | "A little gift" | "A gift to unwrap" | champagne |

The `festival` row names no festival, no deity, and no symbol (REQ-GP-23). The card has no price: a price on the card would need the footnote and has no job there.

## 4. `pieceHref` (in `lib/model-param.ts`)

```ts
/** `/piece/<sku>` plus `?m=<percent-encoded model JSON>` when a model is given. */
export function pieceHref(sku: string, model?: RecipientModel): string {
  const path = `/piece/${encodeURIComponent(sku)}`;
  return model ? `${path}?${new URLSearchParams({ [MODEL_PARAM]: encodeModelParam(model) })}` : path;
}
```

Same transport as `modelHref` (`conversation` design §3): the model is JSON in canonical key order. The page validates it again on arrival, so a hand-edited URL either parses to a valid model or is ignored (no recipient context).

## 5. `GiftWrap` (client)

Props (plain data from the server):

```ts
interface GiftWrapProps {
  name: string;                      // product name, verbatim
  url: string;                       // catalog url, verbatim
  initialMessage: string;            // draftMessage(...)
  presentation: Presentation;        // presentationFor(...)
}
```

State: `phase: "idle" | "wrapping" | "revealed"`, `message: string` (`useState(initialMessage)`), `copy: "idle" | "ok" | "fail"`.

### 5.1 State machine

| From | Event | To |
|---|---|---|
| idle | click "Wrap this gift", reduced motion off | wrapping |
| idle | click "Wrap this gift", reduced motion on | revealed |
| wrapping | `WRAP_REVEAL_MS` elapsed | revealed |
| wrapping | click "Skip" | revealed |
| revealed | click "Reset to draft" | revealed, `message = initialMessage` |

```ts
useEffect(() => {
  if (phase !== "wrapping") return;
  const t = setTimeout(() => setPhase("revealed"), WRAP_REVEAL_MS);
  return () => clearTimeout(t);
}, [phase]);
```

The `setState` call sits inside the timer callback, not in the effect body, so it passes the React lint rules. Reduced motion is read inside the click handler: `typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches`. This avoids a hydration mismatch and works in jsdom, which has no `matchMedia`. On `revealed`, an effect focuses the card heading (`tabIndex={-1}`).

### 5.2 Rendering

- **idle**: a closed gift box (a `div` of `bg-blush`, rounded, with two crossing ribbon bars of `bg-gold/70` and a lid bar), the button "Wrap this gift" (primary look), and the buy link (secondary look).
- **wrapping**: the same box with animation classes, `aria-busy="true"`, a `role="status"` line "Wrapping your gift…", a "Skip" button, and the buy link (secondary).
- **revealed**: a `role="status"` line "Your gift is wrapped"; the presentation card; the editor block; the buy link (primary).

Presentation card: `<article className={tone class + " wrap-card-in"}>` with `<h3 tabIndex={-1}>{heading}</h3>`, the subheading, `<p className="whitespace-pre-line">{message}</p>`, and "The gift: {name}". Tone classes are a fixed map to full class strings (`bg-blush`, `bg-champagne`, `bg-sage`), because Tailwind needs literal class names.

Editor block: `<label htmlFor>` "Gift message — a draft you can edit"; `<textarea rows={6} maxLength={500}>` controlled by `message`; "Reset to draft"; "Copy message"; a `role="status"` line for "Copied" or "Select the text and copy it yourself."; the line "Your message stays on this page. It is not sent to us or to the store." The copy handler:

```ts
async function copy() {
  try { await navigator.clipboard.writeText(message); setCopy("ok"); } catch { setCopy("fail"); }
}
```

`navigator.clipboard` is undefined in insecure contexts and in jsdom; the `try` also covers the `TypeError` from calling `undefined.writeText`. No `fetch`, no `XMLHttpRequest`, no `localStorage`, no `<form>`.

Buy link: `<AtelierButton href={url} external variant={phase === "revealed" ? "primary" : "secondary"}>Buy on Tiny Tiaraa ↗</AtelierButton>`. `AtelierButton` already passes `target="_blank"` and `rel="noopener noreferrer"` and leaves `href` untouched (`conversation` T3.1). Four catalog URLs carry percent-encoding (`%E2%80%93`, the en dash in TPN-1459, TNZ-1058, TNZ-1056) or commas (TBZ-1013); a test asserts all 22 `href`s equal the catalog string, so any normalisation by `next/link` is caught.

### 5.3 The CSS (in `app/globals.css`)

Plain classes in the style of the existing `.mote`, with keyframes that change only `transform` and `opacity`, so the file gains no colour:

```css
@keyframes wrap-ribbon { to { transform: scaleX(0); opacity: 0; } }
@keyframes wrap-lid    { to { transform: translateY(-70%) rotate(-5deg); opacity: 0; } }
@keyframes wrap-box-out{ to { opacity: 0; } }
@keyframes wrap-card-in{ from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }

.wrap-ribbon  { animation: wrap-ribbon  800ms ease-in 0ms forwards; }      /* ends 0.8 s */
.wrap-lid     { animation: wrap-lid    1400ms ease-in-out 600ms forwards; } /* ends 2.0 s */
.wrap-box-out { animation: wrap-box-out 400ms ease-out 2000ms forwards; }   /* ends 2.4 s */
.wrap-card-in { animation: wrap-card-in 400ms ease-out both; }              /* 0.4 s after reveal */

@media (prefers-reduced-motion: reduce) {
  .wrap-ribbon, .wrap-lid, .wrap-box-out, .wrap-card-in { animation: none; }
}
```

The last wrapping animation ends at 2.4 s (= `WRAP_REVEAL_MS`) and the card fades in over the next 0.4 s: 2.8 s from activation, under the 3 s limit (REQ-GP-15). A static test parses these four rules and fails when any `delay + duration` of the box animations exceeds `WRAP_REVEAL_MS`, or the card fade exceeds `CARD_FADE_MS`, so the CSS and the constants cannot drift apart. The animations touch the gift box and the card only. The product photo is not inside `GiftWrap`.

## 6. The page (`app/piece/[sku]/page.tsx`)

```tsx
export async function generateStaticParams() {
  return catalog.products.map((p) => ({ sku: p.sku }));
}

export default async function PiecePage({
  params, searchParams,
}: {
  params: Promise<{ sku: string }>;
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const { sku } = await params;
  const product = catalog.products.find((p) => p.sku === sku);
  if (!product) notFound();                       // throws; outside any try/catch

  const sp = await searchParams;
  const parsed = parseModelParam(sp.m);            // 'missing' and 'invalid' both mean: no recipient
  const model = parsed.status === "ok" ? parsed.model : null;

  const view = toPieceView(product);
  const verdict = computeVerdict(product, catalog, model ? model.ageBand : null);
  const spec = buildSizeSpec(product);
  const ctx = giftContext(model);
  …
}
```

Layout (all of it inside `<main className="… print:hidden">` except the viewer's print sheet, which the viewer renders itself): header (text wordmark, "Browse the atelier"); back link (`modelHref('/picks', model)` "Back to your picks" or `/atelier` "Back to the atelier"); a two-column grid on wide screens: left, the title block (`data-price-region`: name, price, `PriceFootnote`, rating when listed, "Out of stock" badge when not in stock) over `ProductPhoto` and its caption, then `PieceFacts`; right, `SafetyVerdict`, `TrueSizeViewer`, and either `GiftWrap` (in stock) or the out-of-stock note with the browse link (REQ-GP-09). One column on mobile in the same order. Because `TrueSizeViewer` carries its own `print:hidden` and print sheet, the wrapper cannot hide the whole `main`; the other sections each carry `print:hidden`.

`SafetyVerdict` is a server-rendered section. `TrueSizeViewer` and `GiftWrap` are client islands with plain-data props.

### 6.1 Next.js notes (read from `node_modules/next/dist/docs/` before writing the route)

| Fact | Source file | Consequence |
|---|---|---|
| `params` and `searchParams` are promises; `await` them. | `01-app/03-api-reference/03-file-conventions/page.md`, `dynamic-routes.md` | The page is `async` and awaits both. |
| With Cache Components (`cacheComponents: true` in `next.config.ts`), params without `generateStaticParams` are runtime data and must sit under a `Suspense` boundary; the root layout already wraps `children` in one. With `generateStaticParams`, the build validates the route for the samples. | `dynamic-routes.md` | `generateStaticParams` returns the 22 SKUs. `npm run build` is part of the final wave. |
| `dynamicParams` is not available with Cache Components. | `02-route-segment-config/dynamicParams.md` | Unknown SKUs are handled with `notFound()` in the page, not by a segment config. |
| `notFound()` throws `NEXT_HTTP_ERROR_FALLBACK;404`, must be called in the render path (not in an un-awaited promise), and renders the nearest `not-found`. Called after streaming has started, the response keeps status 200. | `04-functions/not-found.md` | Call it right after the lookup. The status may be 200 under the root `Suspense` (open question Q15). |
| `redirect()`-style throws must sit outside `try/catch`. | `04-functions/redirect.md` | The page has no `try`. |

The builder re-reads these files before writing the route; this table records what the spec relied on (AGENTS.md).

### 6.2 `not-found.tsx`

A server component with the same header, "We couldn't find that piece.", `AtelierButton` "Browse the atelier" to `/atelier`, and a "Find a gift" link to `/find`. No dead end.

## 7. Links from the cards, and the supersession of REQ-CV-33

`PickCard` gains an optional prop `detailHref?: string` and, when given, a secondary `AtelierButton` "See details" above the buy button. `/picks` passes `pieceHref(view.sku, model)` for each card. `BrowseCard` renders a "See details" link to `pieceHref(item.sku)` on every card, including the out-of-stock card (no model in the browse grid, so no `m`). The props stay optional so existing tests that render `PickCard` without it keep passing.

| Spec text | Status after this spec |
|---|---|
| `conversation` REQ-CV-33: "Until the detail page exists (`/piece/[sku]`, a later milestone), a pick card SHALL NOT link to it, so no link leads to a 404." | **Superseded** for the link rule by REQ-GP-10 and REQ-GP-11. The detail page exists, so the condition that justified the ban has ended. The rest of REQ-CV-33 (every `/picks` state offers "Change my answers" and "Browse the full atelier") stays in force. |
| `conversation` design §5 `PickCard` note: "The card has no link to `/piece/[sku]` in this milestone" | Superseded in the same way. |
| `conversation` Q7 (pick cards link to the buy URL only; the detail link arrives with `gift-presentation`) | Resolved by this spec. |
| `conversation` REQ-CV-32, REQ-CV-38 | Unchanged: the buy link stays on pick cards; the out-of-stock browse card still has no buy control. "See details" is a navigation link, not a buy control. |

The `conversation` spec files are not edited: this record is the supersession. The evidence log notes it.

## 8. Failure behaviour

| Situation | Behaviour |
|---|---|
| Unknown or malformed SKU | `notFound()`; not-found UI with two links. |
| `m` missing | No recipient context; safety card shows the "No recipient selected" age row; generic draft and card. |
| `m` invalid | Same as missing; no redirect, no error. |
| `m` valid but the band is not listed for the piece | Safety age row flags; verdict `Check this`. The page still renders. |
| Out-of-stock piece | Title badge, facts, verdict, viewer; no wrap, no buy link, a browse link. |
| Clipboard unavailable | "Select the text and copy it yourself." |
| JavaScript disabled | Server-rendered page: facts, verdict, approximate size label, the closed gift box, and the buy link all show; wrap, calibration, and editing need JavaScript. |
| User prefers reduced motion | The wrap skips straight to the revealed card; the card appears without fade. |

## 9. Testing

| File | Env | Covers |
|---|---|---|
| `tests/gift-message.test.ts` | node | every salutation and occasion line, the four-line shape, curly-quoted name, no-context draft, `presentationFor` table, constants (`WRAP_REVEAL_MS + CARD_FADE_MS ≤ 3000`) |
| `tests/gift-message.property.test.ts` | node | G2, G3, G7, G8 (seeded, `numRuns ≥ 200`) |
| `tests/piece-view.test.ts` | node | the facts table for TPN-1149 (Chain row present, no Rating row), TNZ-1056 (no Chain row, Rating "4.7/5 (3 reviews)"), THP-1027 (neither row), TNZ-1058 (Availability "Out of stock"); G5 over all 22 |
| `tests/model-param.test.ts` | node | extend: `pieceHref` without and with a model; G6 over all SKUs × the golden models and generated models |
| `tests/gift-wrap.ui.test.tsx` | jsdom, `vi.useFakeTimers()` | phases and timing, Skip, reduced motion (stub `matchMedia`), draft prefill and editing, Reset, `maxLength`, Copy success and failure, card text follows the edit, buy link href equals `url` in all phases (G1 over all 22 URLs), no `fetch`/`localStorage` calls (spies), no `<img>` in the component |
| `tests/piece.links.ui.test.tsx` | jsdom | `PickCard` "See details" `href` equals `pieceHref(sku, model)` and decodes back to the model; `BrowseCard` link `/piece/<sku>` on in-stock and out-of-stock cards; the out-of-stock card still has no buy control; golden-1 picks still render in order |
| `tests/piece.route.test.tsx` | node | `PiecePage` called as a function: unknown SKU throws the not-found error; a known SKU with and without `m` renders (`renderToStaticMarkup`, `next/image` and `next/link` mocked if needed) and contains the exact fit-check line, the exact approximate-size label once, the wrap button, the buy `href`; TNZ-1058 contains "Out of stock" and no buy `href` and no "Wrap this gift"; G9 |
| `tests/gift-presentation.static.test.ts` | node | the CSS durations (§5.3); `lib/gift-message.ts` and `lib/piece-view.ts` purity; `components/GiftWrap.tsx` has no `fetch`, `XMLHttpRequest`, `localStorage`, `sessionStorage`, `<form`, `<img`, `catalog.json`, `catalog-store`; no `#hex`/`rgb(`/`[#` in `components/` and `app/`; no `app/api/` directory; no LLM client import |

If the Vitest node environment cannot render a Next primitive in `piece.route.test.tsx`, the test mocks `next/image` to `<img>` and `next/link` to `<a>`, as the component tests already do; if rendering the full page in Vitest proves impractical, the test keeps the not-found and prop-building assertions, and the dev-server checks in the final wave are the acceptance for the rendered HTML.

### 9.1 Correctness properties (fast-check, seeded)

| ID | Property | Requirement |
|---|---|---|
| P-GP-1 (G1) | For all 22 products, `GiftWrap` in each phase renders exactly one link to the product's `url` byte for byte (`target="_blank"`, `rel` contains `noopener`); the detail page of an out-of-stock product has none. | REQ-GP-25, 26, 33 |
| P-GP-2 (G2) | For any relationship, occasion, and catalog name: the draft contains the name once; with the name removed, no digit and no match of the banned pattern; length ≤ 500. | REQ-GP-18, 21, 34 |
| P-GP-3 (G3) | `draftMessage` and `presentationFor` are deterministic and do not mutate arguments. | REQ-GP-21, 35 |
| P-GP-4 (G4) | Fake timers: `revealed` is not reached at `WRAP_REVEAL_MS − 1` and is reached at `WRAP_REVEAL_MS`; Skip reaches it at 0 ms; `WRAP_REVEAL_MS + CARD_FADE_MS ≤ 3000`; the CSS delays and durations sum within the constants. | REQ-GP-15, 36 |
| P-GP-5 (G5) | For all 22 products, every `Fact` equals the catalog field named in `source` through the documented maps; Chain and Rating rows exist exactly when non-null; no `mrp_inr`, `claims`, or `design_application_no` value appears. | REQ-GP-05, 37 |
| P-GP-6 (G6) | `pieceHref` round trip for every SKU and valid model (`parseModelParam` of the decoded `m` equals the model); no query without a model. | REQ-GP-10, 38 |
| P-GP-7 (G7) | No religious vocabulary in any heading, sub-line, or draft (outside the product name), for every relationship and occasion. | REQ-GP-23, 39 |
| P-GP-8 (G8) | `presentationFor` is total over `Occasion` and `null`, with a valid tone. | REQ-GP-22, 40 |
| P-GP-9 (G9) | The page's band equals `model.ageBand` for every valid model, null otherwise, and never throws for an arbitrary `m`. | REQ-GP-03, 41 |
| P-GP-10 | Static: no network, storage, or image in `GiftWrap`; no catalog import in components; tokens only; no `app/api/`. | REQ-GP-16, 19, 27, 28, 29 |

A counterexample from any property is logged in `docs/kiro-evidence-log.md` with its fix.

## 10. Final acceptance (REQ-GP-32)

Run against the dev server on a spare port (the tasks give the commands). The HTML from `curl` contains an inline copy of every client component's props (the RSC payload), so the checks strip `<script>` blocks first, and they grep apostrophe-free prefixes because React escapes `'` in text. The checks cover the detail page of TNZ-1056 (safety card, viewer, wrap, buy link equal to the catalog URL), TNZ-1058 (badge, no buy link), `NOPE-0000` (not found), a piece with a recipient (`?m=`) showing the recipient's band in the age row, and `/picks` golden case 1 with its three "See details" links in the order TBZ-1013, TNZ-1056, TBZ-1017. The physical checks of `true-size-viewer` REQ-TS-30 run here, because this is the first place the viewer is on a page.

## 11. Open questions (not resolved by this spec; builder's call)

| ID | Question | Spec's working assumption |
|---|---|---|
| Q15 | The root layout wraps `children` in `Suspense` (needed for `searchParams` under Cache Components). `notFound()` after streaming starts keeps status 200 (docs). `/piece/NOPE-0000` may therefore answer 200 with the not-found UI and `noindex`, as `/picks` without `m` did in M2 (OQ-1). | Measured: the dev server answers 200 with the not-found UI and `noindex`; a production `next start` answers 404. Expected behaviour is now recorded as 200 in dev, 404 in production (22 Nov 2026). The page calls `notFound()` at once after the lookup and the root `Suspense` stays. CONFIRMED 22 Nov 2026: the deployed URL returns HTTP 404 for /piece/NOPE-0000 (curl-verified; clean-browser pass). |
| Q16 | The PRD lists the wrap, the message, the card, then buy. A visitor who does not want the animation still needs to buy. | The buy link is present in all phases (secondary until revealed), and "Skip" and reduced motion shorten the reveal. |
| Q17 | The PRD gives an editable draft but no way to take it elsewhere, and the store link is a different site. | Adds "Copy message" (clipboard only, no network) and the line "Your message stays on this page. It is not sent to us or to the store." |
| Q18 | `PickCard` is rendered by tests without a link prop. | `detailHref` is optional on `PickCard`; `/picks` always passes it. |
| Q19 | `generateStaticParams` plus Cache Components plus a page that awaits `searchParams`: the build behaviour is not verified until `npm run build` runs. | `generateStaticParams` returns the 22 SKUs as the docs advise; the build is in the final wave and any error is a spec question. |
| Q20 | An out-of-stock piece still shows the verdict and viewer but not the wrap. | Yes (browse parity: the piece is explorable; it cannot be bought, so there is nothing to wrap). |
| Q21 | `design_application_no` and `sku_extra` are catalog fields that the PRD's fact list (materials, weight, dimensions, age groups, rating) does not name. | Not shown. The design application number could be read as a certification. |
| Q22 | Per-piece page titles (`generateMetadata`) are not in the PRD's detail page. | Left to `polish-deploy`. |
