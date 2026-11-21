# Gift Presentation — Requirements

*Spec for PRD §1 steps 5 to 7: the piece detail page `/piece/[sku]`, the gift wrap, the gift message, the presentation card, and the buy link. Milestone 3. It integrates `safety-verdict` (REQ-SV-01 to REQ-SV-42) and `true-size-viewer` (REQ-TS-01 to REQ-TS-41) and links to the page from the picks and browse cards of `conversation`. Implemented in `app/piece/[sku]/page.tsx` and `not-found.tsx`, `lib/gift-message.ts`, `lib/piece-view.ts`, `pieceHref()` in `lib/model-param.ts`, and `components/GiftWrap.tsx`. Catalog facts come from `lib/catalog.ts` (see `catalog-data`). The recipient model is the `RecipientModel` of `lib/matching/types.ts`, read through `parseModelParam()` (see `conversation`, REQ-CV-18, REQ-CV-19).*

Terms: **detail page** = `/piece/[sku]`. **Recipient context** = a valid `RecipientModel` from the `m` query parameter, or none. **Draft** = the message the template produces. **Presentation card** = the text card that shows the message, with an occasion heading. **Phase** = `idle`, `wrapping`, or `revealed`. **Buy link** = the link whose `href` is the catalog `url`.

Scope: this spec does not change `lib/matching.ts`, `lib/matching/*`, `lib/catalog.ts`, `data/catalog.json`, or `data/*.ts`. It does not change what `match()` returns. It adds a link to `PickCard` and `BrowseCard` (§3) and nothing else to `/picks` and `/atelier`.

---

## 1. The detail page

**[REQ-GP-01] Route**
The system SHALL serve `/piece/[sku]` from `app/piece/[sku]/page.tsx` as a server component. It SHALL await `params` and `searchParams` (both are promises in this Next.js version), SHALL export `generateStaticParams()` returning the 22 catalog SKUs, and SHALL load products through `lib/catalog-store.ts` only. The page SHALL NOT call `match()`.

**[REQ-GP-02] Unknown SKU**
WHEN the `sku` parameter equals no product's `sku` (exact, case-sensitive), the page SHALL call `notFound()` before rendering any product content. `app/piece/[sku]/not-found.tsx` SHALL show "We couldn't find that piece." with a "Browse the atelier" link to `/atelier` and a "Find a gift" link to `/find`. The response SHOULD carry status 404; WHEN the root `Suspense` makes the framework answer 200 with the not-found UI and `noindex`, that SHALL be recorded in the evidence log and SHALL NOT be worked around by removing the layout's `Suspense` (open question Q15).

**[REQ-GP-03] Recipient context**
The page SHALL read the query parameter `m` with `parseModelParam()`. WHEN it is valid, the page SHALL use the model's `ageBand` as the safety verdict's band and its `relationship` and `occasion` for the gift draft and card. WHEN it is missing or invalid, the page SHALL treat it as no recipient, SHALL NOT redirect and SHALL NOT show an error, and the safety card SHALL show "No recipient selected — age fit shown against all listed age groups" (REQ-SV-10). The page SHALL NOT invent a recipient, an age, or an occasion.

**[REQ-GP-04] Content and order**
For an in-stock product the page SHALL show, in this order: a header with the "Tiny Tiaraa" text wordmark and a link to `/atelier`; a back link ("Back to your picks" with the model's `m` when a recipient context exists, else "Back to the atelier"); the title block (REQ-GP-06); the photo (REQ-GP-07); the catalog facts (REQ-GP-05); the safety verdict card (`SafetyVerdict`); the true-size viewer (`TrueSizeViewer`); the gift presentation (`GiftWrap`). Every section except the viewer's print sheet SHALL be hidden in print.

**[REQ-GP-05] Catalog facts**
The facts block SHALL list these rows, in this order, each rendered from one catalog field and carrying `data-source="<field>"`: Category (`category`), Metal (`materials`, shown through the shared `METAL_LABEL`), Materials (`materials`, verbatim), Weight (`weight`, verbatim), Dimensions (`dimensions`, verbatim), Chain (`chain`, verbatim, only when non-null), Age groups (`age_groups`, through `AGE_GROUP_LABEL`), SKU (`sku`), Rating (`rating`, verbatim, only when non-null), Availability (`availability`). No other row SHALL appear. A row SHALL NOT show a value that is not in the catalog record, and SHALL NOT show a placeholder for an omitted row.

**[REQ-GP-06] Title, price, availability**
The title block SHALL show `name` verbatim in the display serif, the price through `formatInr`, and `PriceFootnote` inside the same element marked `data-price-region`. It SHALL NOT show a discount, strike-through, MRP, "save", or "% off". WHEN `availability` is `Out of Stock`, it SHALL show a visible text badge "Out of stock" beside the name.

**[REQ-GP-07] Photo**
The page SHALL show the catalog photo through `ProductPhoto` (`/catalog/<image_file>`, `object-contain`, unaltered, one photo, alt = name). The photo SHALL have no text, badge, or overlay on it. A caption beneath it SHALL read "Photo as listed — shown enlarged, not to scale." The wrap animation SHALL NOT cover or overlap the photo.

**[REQ-GP-08] Verdict and viewer data**
The server SHALL compute the verdict with `computeVerdict(product, catalog, band)` and the size spec with `buildSizeSpec(product)` and pass them to the components as props. The page SHALL NOT reimplement a check, a caption, or a dimension.

**[REQ-GP-09] Out-of-stock piece**
WHEN `availability` is `Out of Stock` (TNZ-1058 in catalog v1.0.0), the page SHALL still render the title block with the badge, the photo, the facts, the safety card, and the viewer, but SHALL NOT render `GiftWrap` and SHALL NOT render any buy link or buy control anywhere on the page. In its place it SHALL show "This piece is out of stock on the listing." and a "Browse the atelier" link. The page SHALL derive this from `availability`, not from a SKU.

---

## 2. Links from the cards

**[REQ-GP-10] Pick cards link to the detail page**
Each `PickCard` SHALL have a link "See details" to `/piece/<sku>` carrying the confirmed model in `m` (built by `pieceHref(sku, model)`). The link SHALL be a navigation, not a buy control. The buy link of REQ-CV-32 SHALL stay unchanged.

**[REQ-GP-11] Browse cards link to the detail page**
Each `BrowseCard`, including the out-of-stock card, SHALL have a link "See details" to `/piece/<sku>` with no `m`. The out-of-stock card SHALL still have no buy control (REQ-CV-38).

**[REQ-GP-12] Supersession of REQ-CV-33**
REQ-CV-33's sentence "a pick card SHALL NOT link to [`/piece/[sku]`]" held for Milestone 2 only, "until the detail page exists". The detail page now exists, so that sentence is superseded by REQ-GP-10. The other parts of REQ-CV-33 (every `/picks` state offers "Change my answers" and the browse link) stay in force. The design records the supersession (design §7).

**[REQ-GP-13] `/picks` and `/atelier` stay light**
`/picks` SHALL NOT render a safety card, a viewer, or a gift wrap. `match()` SHALL still be called only from `/picks`. The picks and their order, scores, reasons, and disclosures SHALL be unchanged: golden case 1 SHALL still return TBZ-1013, TNZ-1056, TBZ-1017.

---

## 3. The gift wrap

**[REQ-GP-14] Phases**
`GiftWrap` SHALL have three phases. In `idle` it SHALL show a closed gift box and a "Wrap this gift" button. WHEN the button is activated it SHALL enter `wrapping`, play the reveal, and then enter `revealed`, which shows the presentation card, the message editor, and the primary buy link. It SHALL show no editor and no card before `revealed`.

**[REQ-GP-15] Reveal under 3 seconds**
The reveal SHALL take `WRAP_REVEAL_MS = 2400` ms, never more than `WRAP_REVEAL_MAX_MS = 3000` ms, from activation to `revealed`. A "Skip" button SHALL be visible during `wrapping` and SHALL enter `revealed` at once. WHEN the user prefers reduced motion (`prefers-reduced-motion: reduce`), activation SHALL enter `revealed` immediately with no animation.

**[REQ-GP-16] CSS and animation only**
The reveal SHALL be built from CSS (keyframes and tokens in `app/globals.css`, utility classes) and SHALL add no image file, no SVG file, no generated image, no logo, and no watermark. No text SHALL be overlaid on the product photo, and the wrap SHALL contain no product photo.

**[REQ-GP-17] Announcements**
During `wrapping` the component SHALL expose `aria-busy="true"` and a status message "Wrapping your gift…"; on `revealed` it SHALL announce "Your gift is wrapped" and move focus to the presentation card heading.

---

## 4. The message

**[REQ-GP-18] Template draft**
The draft SHALL be produced by `draftMessage(context, productName)`, a pure template over the relationship, the occasion, and the product name. It SHALL have four lines: a salutation by relationship, an occasion line, "I chose “{product name}” for you." (name verbatim, inside curly quotes, because some names end in a full stop), and "With love,". WHEN there is no recipient context, it SHALL use the generic salutation "To someone special," and the generic occasion line "Thinking of you." The draft SHALL contain no price, rating, discount, certification, or safety wording, and no religious term except inside the verbatim product name. It SHALL NOT use an LLM.

**[REQ-GP-19] Editable, local, never sent**
The editor SHALL be a `<textarea>` prefilled with the draft, with `maxLength = 500`, a visible label ("Gift message — a draft you can edit"), and a "Reset to draft" button. The message SHALL stay in component state: it SHALL NOT be sent to any server, stored in `localStorage`, put in the URL, logged, or passed to a form action. The component SHALL show "Your message stays on this page. It is not sent to us or to the store."

**[REQ-GP-20] Copy**
A "Copy message" button SHALL copy the current text with `navigator.clipboard.writeText`, with no network call. On success it SHALL show "Copied". WHEN the clipboard is unavailable or rejects, it SHALL show "Select the text and copy it yourself." and SHALL NOT throw.

**[REQ-GP-21] Draft is deterministic**
The same context and product name SHALL always produce the same draft. For every one of the 22 product names and every relationship and occasion, the draft SHALL be at most `MESSAGE_MAX_LENGTH` (500) characters.

---

## 5. The presentation card

**[REQ-GP-22] Occasion-appropriate card**
The presentation card SHALL show a heading and a sub-line from `presentationFor(context)`, the current message text (the draft or the user's edit, with line breaks kept), and "The gift: {product name}". The heading and sub-line SHALL come from a fixed table keyed by occasion (design §3.2); with no recipient context or the occasion `other` the heading SHALL be "A little gift". The card SHALL be text on a token surface (`bg-blush`, `bg-champagne`, or `bg-sage`). It SHALL NOT contain a price, a photo, an image, a logo, or a religious symbol.

**[REQ-GP-23] No inferred religion**
The card and the draft SHALL NOT mention a religion, a symbol, or a deity because of the occasion, relationship, festival, or name. The `festival` heading SHALL be "With festival wishes", with no named festival. The product name MAY contain a symbol word because it is a verbatim catalog value.

**[REQ-GP-24] The card updates with the message**
WHEN the user edits the message, the card SHALL show the edited text in the same render.

---

## 6. Buy

**[REQ-GP-25] Buy link is the catalog URL**
For an in-stock piece, `GiftWrap` SHALL render exactly one "Buy on Tiny Tiaraa ↗" link whose `href` equals the product's `url` byte for byte, with `target="_blank"` and `rel="noopener noreferrer"`. The link SHALL NOT add query parameters, tracking, or a redirect through the app. It SHALL be present in all three phases (secondary style before `revealed`, primary after), so no visitor must play the animation to buy.

**[REQ-GP-26] No buy for out-of-stock**
No buy link or buy control SHALL appear on the detail page of an out-of-stock piece (REQ-GP-09).

---

## 7. Boundaries, brand, tests

**[REQ-GP-27] No LLM, no network**
This spec ships no LLM call, no LLM client import, no `app/api/` route, and no API key. With the app running offline except for its own origin, the whole page works. Contract for Milestone 5: an LLM MAY propose a replacement draft only behind a user action, the replacement SHALL pass the same checks as REQ-GP-18 (no price, claim, or product fact beyond the name), and the user SHALL be able to edit and reset it.

**[REQ-GP-28] Pure logic and shared sources**
`lib/gift-message.ts` and `lib/piece-view.ts` SHALL be pure (no React, I/O, clock, randomness, network, LLM). Components SHALL NOT import `data/catalog.json` or `lib/catalog-store.ts`; product facts reach them as props built on the server. Money SHALL be formatted by `formatInr`.

**[REQ-GP-29] Tokens and brand**
All colours SHALL be tokens from `app/globals.css`. "Tiny Tiaraa" SHALL be a text wordmark in the display serif. No haunted element SHALL cover a price, photo, verdict row, caption, or message. Reduced motion SHALL disable the wrap keyframes (`motion-reduce`).

**[REQ-GP-30] Accessibility**
The wrap button, "Skip", the textarea, "Reset to draft", "Copy message", and the buy link SHALL be real controls operable by keyboard. The textarea SHALL have an associated visible label. The wrap state changes SHALL be announced (REQ-GP-17).

**[REQ-GP-31] Tests**
Unit tests SHALL cover `draftMessage`, `presentationFor`, `toPieceView`, and `pieceHref`. Component tests SHALL cover the `GiftWrap` phases and timing (fake timers), the draft and editing, the copy fallback, the presentation card, and the buy link's `href`. Property tests SHALL cover §9. `lib/gift-message.ts`, `lib/piece-view.ts`, and the new part of `lib/model-param.ts` SHALL reach ≥ 80% line coverage.

---

## 8. Integration acceptance

**[REQ-GP-32] End to end**
With the dev server running: `/piece/TNZ-1056` SHALL return 200 with the safety card (verdict, the exact fit-check line), the viewer (the exact approximate label), the wrap button, and a buy link equal to TNZ-1056's catalog `url`; `/piece/TNZ-1058` SHALL show "Out of stock" and no buy link; `/piece/NOPE-0000` SHALL show the not-found UI (status per REQ-GP-02); `/picks` for golden case 1 SHALL list TBZ-1013, TNZ-1056, TBZ-1017 in that order with a "See details" link each; and `npm test`, `npm run typecheck`, `npm run lint`, and `npm run validate-catalog` SHALL pass.

---

## 9. Property-test invariants

**[REQ-GP-33] G1 Buy href is verbatim.** For every in-stock product, the rendered buy link's `href` equals `url` exactly, and there is exactly one buy link; for every out-of-stock product there is none.
**[REQ-GP-34] G2 Draft is grounded.** For every relationship, occasion, and product, the draft contains the product name verbatim exactly once; with the name removed, the rest of the draft contains no digit (so no price or rating) and matches none of `/₹|%|\bsave\b|\boff\b|\bMRP\b|certif|hypoallergenic|\bsafe\b/i`; and the draft is at most 500 characters.
**[REQ-GP-35] G3 Draft is deterministic.** Equal arguments give equal drafts; the inputs are unchanged.
**[REQ-GP-36] G4 Reveal bound.** `WRAP_REVEAL_MS ≤ WRAP_REVEAL_MAX_MS ≤ 3000`; in a fake-timer test, `revealed` is reached at exactly `WRAP_REVEAL_MS`, and never later, by timer or by Skip.
**[REQ-GP-37] G5 Facts trace to the catalog.** For every product, every row of `toPieceView` equals the catalog field named in its `source`, formatted only by the documented label maps; Chain and Rating rows exist exactly when the field is non-null.
**[REQ-GP-38] G6 `pieceHref` round trip.** For every SKU and every valid model, the path of `pieceHref(sku, model)` decodes to `sku` and its `m` parses back (`parseModelParam`) to the model; without a model it has no query.
**[REQ-GP-39] G7 No inferred religion.** For every relationship and occasion, the presentation heading, sub-line, and draft contain none of: Om, Ganesha, Ganesh, Cross, Sikh, Trishul, Jain, Swastik, Allah, God, Lord, Bless, Blessing, Shubh (case-insensitive, whole word), except inside the product name.
**[REQ-GP-40] G8 Presentation covers every occasion.** `presentationFor` returns a non-empty heading and sub-line for every `Occasion` and for no context, with a tone in `blush | champagne | sage`.
**[REQ-GP-41] G9 Band context.** For every valid model, the page's band equals `model.ageBand`; with no model, null; and an invalid `m` is treated as no model (never an error).
