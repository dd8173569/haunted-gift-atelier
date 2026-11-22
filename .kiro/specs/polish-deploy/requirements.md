# Polish and Deploy (Milestone 4: premium UI and accessibility) — Requirements

*Spec for the polish pass over the whole journey `/` → `/find` → `/picks` → `/piece/[sku]` → `/atelier` (PRD §1, architecture §7 "Design system" and §8 row `polish-deploy`, architecture §9 rows Sat 28 Nov to Mon 30 Nov). It covers premium visual polish inside the locked design tokens, accessibility (keyboard, ARIA, contrast, reduced motion, touch targets, alt text), automated accessibility checks in the existing Vitest setup, a manual checklist for what cannot be automated, the dev-only Next.js "instant" warning, and per-piece page titles (M3 open question Q22). Milestones 5 and 6 of the same architecture row (reliability, deploy, clean-browser pass) get their own tasks later; this document is Milestone 4 only. It changes `app/`, `components/`, and `app/globals.css`, adds one pure file `lib/page-meta.ts`, and adds tests. It changes no product logic. (Update 22 Nov 2026: Milestone 5 is done; Milestone 6 deployed the app to Netlify — live at https://haunted-gift-atelier.netlify.app/ — so this spec's deploy row now refers to Netlify, not Vercel. See the evidence log.)*

Terms: **screen** = one of the six routes' rendered states (landing, a `/find` step, `/picks`, `/piece/[sku]`, `/atelier`, the piece not-found page). **Surface** = a token background (`pearl`, `blush`, `champagne`, `sage`, `plum`, or an opacity variant composited over `pearl`). **Text role** = a Tailwind text-colour utility (`text-plum`, `text-plum/75`, `text-pearl`). **Control** = a button, link used as a button, chip, slider, textarea, or any other interactive element. **Decorative** = an element with `aria-hidden="true"` whose meaning is also carried by adjacent text (the moon, the progress bars, the motes, the gift box). **Policy alpha** = the lowest opacity a token text colour may use (REQ-PD-02). **Pinned string** = copy fixed by an earlier spec (REQ-PD-16).

Scope: this spec does not change `lib/matching.ts`, `lib/matching/*`, `lib/catalog.ts`, `lib/safety*.ts`, `lib/true-size.ts`, `lib/size-spec.ts`, `lib/conversation.ts`, `data/*`, or `public/catalog/*`. It does not change what `match()`, `computeVerdict()`, or `buildSizeSpec()` return, any pinned string (REQ-PD-16), any golden case, or the redirect behaviour of `/picks` (M2 OQ-1). It adds no route, no feature, no LLM call, and no `.github/workflows/ci.yml`.

**Out of scope, recorded so nobody re-opens it here:** matching behaviour and scoring (the four M1 persona questions stay frozen until the Tue 24 Nov checkpoint); safety-verdict wording, rules, and `claims[]`; the physical calibration check T4.3 of `gift-presentation` (needs a human with a card and a ruler; it stays "not run" and no number is invented); the `/piece/NOPE-0000` fallback (expected behaviour now recorded as 200 in dev, 404 in production — Q15 note updated 22 Nov; production 404 CONFIRMED on the deployed URL 22 Nov 2026, 14 of 15 curls (one 200 observed once — a streaming-timing race)); CI; the optional LLM layer (M5 stretch); the `/about` route named in `structure.md` (no route exists, none is added).

**Contradictions with earlier pinned work, stated up front.** (1) `tests/atelier.ui.test.tsx` asserts the class `text-plum/50` on the out-of-stock card, and `tests/gift-wrap.ui.test.tsx` asserts `border-plum/30` on the secondary buy link. Those are class pins in tests. The spec text they implement (REQ-CV-38 "muted surface and text colours from the tokens", REQ-GP-25) names no opacity. `text-plum/50` measures 2.77:1 and `border-plum/30` measures 1.76:1 (design §3), so AA and the brief win, and the two assertions are updated in the same task to the new class, never deleted (REQ-PD-49). (2) The brief asks for live regions on conversation step changes. REQ-CV-50 accepts "heading focus or live region"; the conversation already moves focus to the new heading, and a second announcement would double-speak, so this spec keeps focus management as the one mechanism (REQ-PD-22, REQ-PD-23). (3) The brief suggests a price band in the piece title. The brand rule "every price carries the footnote" cannot be met inside a `<title>`, so the title carries no price and no price band (REQ-PD-34). (4) The `design-polish` agent may not write `lib/**`, `tests/**`, or `.kiro/**` (its definition); tasks split work by owner (REQ-PD-50).

---

## 1. Visual system and polish

**[REQ-PD-01] Palette is locked; tokens stay in one place**
The six colour tokens (`pearl #FAF7F2`, `blush #F7E8E4`, `champagne #F5EDD8`, `sage #DCE8DD`, `gold #C9A227`, `plum #3D2C3A`) in `app/globals.css` SHALL stay the only colours in the app. No component or route file SHALL contain `#hex`, `rgb()`, `hsl()`, `oklch()`, or an arbitrary colour value. The pass MAY add non-colour tokens to the same `@theme` block (letter-spacing, shadow, duration, focus-ring width). A shadow token SHALL derive its colour from `var(--color-plum)` with `color-mix`, so no new colour literal appears.

**[REQ-PD-02] Text colour policy**
Text SHALL use `text-plum` or `text-pearl`, or `text-plum/N` with `N ≥ 75`. `text-gold` SHALL NOT appear anywhere (gold measures 1.9:1 to 2.3:1 on every surface). Gold MAY colour decorative elements only, through `bg-gold`, `fill-gold`, or `stroke-gold`. The moon SVGs SHALL use `fill-gold` instead of `fill="currentColor"` with `text-gold`. The existing `text-plum/60` (8 uses), `text-plum/70` (4), `text-plum/50` (1), and `text-gold` (7) SHALL be replaced.

**[REQ-PD-03] One type scale**
Headings and the wordmark SHALL use the display serif (`font-display`); everything else the sans. The scale SHALL be: page `h1` `text-3xl sm:text-4xl` (landing hero `text-4xl sm:text-6xl`); section `h2` `text-2xl` (cards `text-xl`); body `text-base`; secondary text `text-sm`; `text-xs` only for eyebrow labels and the "Source:" line. No rendered text SHALL be smaller than 12 px (`text-xs`). The price footnote SHALL be `text-sm` on cards and `text-xs` nowhere. Uppercase eyebrows SHALL use one letter-spacing token (replacing the five arbitrary values `tracking-[0.15em]`, `[0.2em]`, `[0.25em]`).

**[REQ-PD-04] One spacing and shape scale**
Pages SHALL share one container (`mx-auto w-full max-w-6xl px-6 sm:px-10`), one vertical rhythm (`gap-6` between page sections, `py-8` page padding, `py-14` landing bands), and three corner radii: `rounded-2xl` (panels, inputs), `rounded-3xl` (product cards), `rounded-full` (buttons, chips, badges). No other radius SHALL be used for a surface.

**[REQ-PD-05] One site header and a skip link**
One `SiteHeader` component SHALL replace the six copies of the header (landing, `/find`, `/picks`, `/piece/[sku]`, the piece not-found page, `/atelier`). It SHALL show the "Tiny Tiaraa" text wordmark in the display serif, linking to `/`, and a `<nav aria-label="Primary">` with the links each screen has today (same link text and `href` as today, including `/atelier`'s "← Back to the atelier" to `/`). Every link in it SHALL be at least 44 px high (REQ-PD-28). The root layout SHALL render a "Skip to main content" link as the first focusable element, visible on focus, targeting `id="main-content"`; every screen's `<main>` SHALL carry that id and `tabIndex={-1}`.

**[REQ-PD-06] Shared control primitives**
Every `<button>` except a chip SHALL come from one `ActionButton` component with variants `primary`, `secondary`, and `quiet` (a text button for "Back"). It replaces the eight hand-copied full-size class strings in `GiftWrap`, `TrueSizeViewer`, `CalibrationSlider`, `SizeRuler`, and `Conversation` ("Continue"), and the smaller "Back", "Edit", and "Clear filters" buttons in `Conversation`, `RecipientCard`, and `CatalogGrid`. Chips stay in `ChipGroup`. `AtelierButton`'s primary variant class string SHALL stay byte-identical (`tests/picks.ui.test.tsx` pins it). A control's visible boundary (border) SHALL be `border-plum/60` or darker (REQ-PD-26). Control heights SHALL be `h-11` (44 px) or `h-12`; primary calls to action SHALL be `h-12`.

**[REQ-PD-07] Surfaces and elevation**
Panels SHALL use only these surfaces: `pearl` (page and photo panels), `blush/50` (cards), `champagne` (emphasis and "Check this"), `sage/60` ("Good fit"), `plum/5` (out of stock). Cards MAY carry one shadow token (REQ-PD-01). A surface SHALL NOT sit over a product photo.

**[REQ-PD-08] Responsive layout**
Every screen SHALL lay out without horizontal page scrolling at 320, 360, 768, 1024, 1280, and 1536 CSS px wide. The only horizontal scroll containers SHALL be the size-outline row and the screen ruler (REQ-TS-24 already allows them). Source order SHALL be the stacking order on narrow screens (REQ-PD-24). No component SHALL fix a width in pixels except the true-size drawings (`style` widths from `mmToPx`) and the slider outline.

**[REQ-PD-09] Landing**
The landing screen SHALL keep its hero, its three-step band, its trust strip, and its footer with `PriceFootnote`. It SHALL replace the gold numerals and the gold eyebrow with plum text and a gold decorative rule (REQ-PD-02), put the three steps in an ordered list, and keep every pinned sentence of REQ-SV-29. Floating motes and the crescent moon SHALL stay; cobweb corners MAY be added to the hero only (REQ-PD-14).

**[REQ-PD-10] `/find`**
The conversation SHALL sit on one panel surface (REQ-PD-07) with consistent spacing between progress, question, chips, and Back. Chips SHALL keep `aria-pressed`, `min-h-11 min-w-11`, and the pressed look `bg-plum text-pearl`. The recipient card SHALL keep its headline, one line per answer with "Edit", "Reveal my picks", and "Back".

**[REQ-PD-11] `/picks`**
The three pick cards SHALL share one height rhythm (photo, name, price, footnote, markers, reasons, buttons, in that order) with the buttons pinned to the card bottom. The pick eyebrow ("Pick 1 · Pendant") SHALL be plum text (REQ-PD-02). `DisclosureNote` and the shortfall note SHALL stay above and below the cards as today.

**[REQ-PD-12] `/piece/[sku]`**
The detail page SHALL keep its order (REQ-GP-04) and its two-column layout on wide screens. `PieceFacts` SHALL gain a screen-reader-only `h2` "Catalog facts" so the outline has no unlabelled block. The three right-hand cards (fit check, size viewer, gift wrap) SHALL share one padding and radius. The out-of-stock note SHALL use the `plum/5` surface with AA text.

**[REQ-PD-13] `/atelier`**
The filter chips SHALL keep four labelled groups and the polite count. The out-of-stock card SHALL stay muted through its `plum/5` surface and the "Out of stock" text badge, with its text at `text-plum/75` (REQ-PD-02), and its photo SHALL stay untouched (REQ-CV-38). "See details" and the buy link SHALL be the only controls on a card.

**[REQ-PD-14] Haunted elements stay subtle**
The only haunted elements SHALL be floating motes (landing hero), the crescent-moon progress marker (`/find`), and cobweb corners (landing hero only, if added). Cobweb corners, if added, SHALL be inline SVG in a component, `aria-hidden`, `pointer-events-none`, drawn with `stroke-plum` at low opacity, placed in hero corners, and SHALL NOT overlap text or a control. No haunted element SHALL cover a price, a photo, a verdict row, a caption, or a message (REQ-CV-49, REQ-GP-29).

**[REQ-PD-15] Brand invariants survive the polish**
After the pass: no logo, watermark, or generated image exists; "Tiny Tiaraa" appears as text only; each catalog photo is shown through `ProductPhoto` (or `SizeOutlines`' in-box photo) with `object-contain`, no text, badge, or overlay on it, and no `opacity`, `filter`, `grayscale`, `blur`, `scale`, or `rotate` class on it or its ancestors up to the card; no discount, strike-through, MRP, "save", or "% off" appears; every `₹` text node has a `[data-price-region]` ancestor carrying the exact footnote; the out-of-stock piece has no buy control; no real person's face appears.

**[REQ-PD-16] Pinned copy is not touched**
The following strings SHALL render byte for byte as today: the fit-check line (`FIT_CHECK_LINE`); "Approximate size — calibrate with a card for true size." (once per viewer in the approximate and stale modes, and the only place "true size" appears there, REQ-TS-11, REQ-TS-12); the price footnote; "No certifications are stated on this product's page."; "No recipient selected — age fit shown against all listed age groups"; "Photo as listed — shown enlarged, not to scale."; the gift-wrap strings of REQ-GP-14 to REQ-GP-20 ("Wrap this gift", "Wrapping your gift…", "Your gift is wrapped", "Skip", "Gift message — a draft you can edit", "Reset to draft", "Copy message", "Copied", "Select the text and copy it yourself.", "Your message stays on this page. It is not sent to us or to the store."); "Buy on Tiny Tiaraa ↗"; "See details"; "Reveal my picks"; "Change my answers"; "Browse the full atelier"; "How we widened the search"; "Why this one"; "Out of stock"; "This piece is out of stock on the listing."; "We couldn't find that piece."; the calibration strings ("Calibrate with a card", "Reset calibration", "Calibrated to your screen", "This matches", "Cancel", "Size on your screen", "Print a 1:1 paper ruler"); the six question prompts, "Question n of 6", and `ADULT_END_MESSAGE`; every safety row text, rule text, and reason; every relaxation disclosure. New copy this spec adds is limited to REQ-PD-05 (skip link), REQ-PD-12 (screen-reader heading), REQ-PD-20 (hint text), REQ-PD-30 (slider value text), and the page titles (REQ-PD-33 to REQ-PD-36).

---

## 2. Accessibility

**[REQ-PD-17] Everything is operable by keyboard**
Every control on every screen (links, chips, the sub-chips, "Continue", "Edit", "Back", filter chips, "Clear filters", the calibration slider and its buttons, the wrap buttons, the textarea, "Reset to draft", "Copy message", "Print a 1:1 paper ruler", buy and detail links, the skip link) SHALL be a native interactive element (`a[href]`, `button`, `input`, `textarea`) reachable with Tab and operable with Enter or Space as the element type implies. No control SHALL be a `div` or `span` with a click handler. No keyboard trap SHALL exist, including the calibration panel and the wrap reveal.

**[REQ-PD-18] Tab order follows reading order**
No element SHALL use a positive `tabIndex`. `tabIndex={-1}` SHALL appear only on programmatic focus targets (each `<main id="main-content">`, the step and card headings, the gift-card heading). Tab order SHALL equal DOM order, and DOM order SHALL equal visual order: no `order-*`, `flex-row-reverse`, `flex-col-reverse`, or `grid-flow-dense` class SHALL be used on content (decorative `aria-hidden` elements excepted).

**[REQ-PD-19] A visible focus indicator on every focusable element**
One global rule in `app/globals.css` SHALL draw `:focus-visible` as `outline: 2px solid var(--color-plum)` with `outline-offset: 2px` (an outline, so it survives forced-colors mode). It SHALL measure at least 3:1 against every surface (design §3: 10.3:1 or more). No element SHALL set `outline-none` or `outline: none` unless it is a `tabIndex={-1}` programmatic target (the step headings, the gift-card heading, `main`). Such a target is not a control a keyboard user operates, so it MAY hide the outline; every control SHALL show it.

**[REQ-PD-20] Every control has an accessible name, and repeated links have context**
Every control SHALL have an accessible name that contains its visible text (label in name). Repeated links ("See details" on up to 22 cards, "Buy on Tiny Tiaraa ↗" on up to 21) SHALL keep their visible text as the accessible name and SHALL carry `aria-describedby` pointing at their card's heading id (`pick-<sku>-name`, `browse-<sku>-name`). Every link with `target="_blank"` SHALL also reference one hidden hint element "Opens in a new tab" through `aria-describedby`; the hint SHALL be rendered once per screen. The hint SHALL NOT contain "true size".

**[REQ-PD-21] Selection state is exposed**
Every chip SHALL expose its state with `aria-pressed` (REQ-CV-50). Every chip group SHALL be `role="group"` with an `aria-label`. The out-of-stock state SHALL be conveyed by the text "Out of stock", the flagged state by the text "Worth a look", and the pressed state by the filled look and `aria-pressed`: never by colour alone.

**[REQ-PD-22] Live regions where the screen changes without navigation**
Each in-page change SHALL be announced by exactly one mechanism, per this table. A live region SHALL exist in the DOM before its text changes (persistent container, text swapped in).

| Change | Mechanism |
|---|---|
| Conversation step change, recipient-card edit, return to the card | Focus moves to the new `h1` (`data-step-heading`). No live region (REQ-PD-23). |
| Incomplete-link notice on `/find` | `role="status"`, present at load (existing). |
| Filter result count on `/atelier` | `aria-live="polite"` count (existing); the empty-state sentence is inside the same live container. |
| Gift wrap phases | One persistent `role="status"` container holds "Wrapping your gift…" then "Your gift is wrapped"; `aria-busy="true"` while wrapping (REQ-GP-17 unchanged). |
| Copy result | The persistent `role="status"` line (existing). |
| Calibration mode and value | One persistent `role="status"` container holds the mode line ("Calibrated to your screen", the approximate label, the stale note); the slider exposes its value through `aria-valuetext` (REQ-PD-30). |
| Picks reveal | A navigation, not an in-page change: the new route's title (REQ-PD-33 to REQ-PD-36) and `h1` are what Next.js's route announcer reads. No live region. |

**[REQ-PD-23] Focus management**
WHEN the conversation step changes, focus SHALL move to the new step heading. WHEN the gift wrap starts wrapping, focus SHALL move to "Skip" (the "Wrap this gift" button unmounts). WHEN the gift wrap reaches `revealed`, focus SHALL move to the card heading (REQ-GP-17). WHEN the calibration panel opens ("Calibrate with a card" unmounts), focus SHALL move to the slider. WHEN it closes after "This matches" or "Cancel", or after "Reset calibration", focus SHALL move to the viewer's button that is then shown ("Reset calibration" or "Calibrate with a card"). WHEN "Clear filters" is activated (the button unmounts), focus SHALL move to the first filter chip. A control SHALL NOT unmount while it has focus without focus being moved to a named target. Focus SHALL NOT move on page load.

**[REQ-PD-24] Headings, landmarks, reading order**
Every screen SHALL have exactly one `h1` and no skipped heading level in document order (an `h1` is never followed directly by an `h3`). Every screen SHALL have exactly one `main`, one `banner` (the header), and a labelled `nav`. Content SHALL not sit outside a landmark except the skip link. The screen-reader order SHALL match the visual order (REQ-PD-18).

**[REQ-PD-25] Text contrast (WCAG 2.2 AA, 1.4.3)**
Every text role SHALL reach 4.5:1 for normal text and 3:1 for large text (24 px, or 18.66 px bold) on every surface it can sit on, computed from the token values in `app/globals.css` with alpha composited over the surface (never estimated). With policy alpha 75 the lowest measured ratio is 5.15:1 (`text-plum/75` on `sage`). `text-pearl` on `bg-plum` and on `bg-plum/85` SHALL be at least 7:1. The out-of-stock card's text (`text-plum/75` on `plum/5`) SHALL be at least 4.5:1.

**[REQ-PD-26] Non-text contrast (WCAG 2.2 AA, 1.4.11)**
A control's visible boundary (border) SHALL be at least 3:1 against the surface behind it: `border-plum/60` measures 3.46:1 on `sage`, 3.53:1 on `blush`, 3.69:1 on `pearl`. The textarea border, the slider, the calibration outline, and the size drawings SHALL meet it. Decorative dividers (`plum/10`, `plum/15`) and the decorative progress bars are exempt because their meaning is also in text ("Question n of 6").

**[REQ-PD-27] Reduced motion covers every animation and transition**
`app/globals.css` SHALL contain one `@media (prefers-reduced-motion: reduce)` rule on `*, *::before, *::after` that sets `animation: none !important`, `transition: none !important`, and `scroll-behavior: auto !important`, and sets `.mote { display: none }`. The existing wrap rule SHALL stay as it is. No component SHALL use an inline `animation` or `transition` style, `scrollIntoView` with smooth behaviour, `requestAnimationFrame` loops, or the Web Animations API. A new keyframe or `transition-*` utility SHALL be covered by the global rule without further edits. The JavaScript wrap timer SHALL keep reading `matchMedia` in the click handler (REQ-GP-15).

**[REQ-PD-28] Touch targets of at least 44 × 44 CSS px**
Every control SHALL be at least 44 px high (`h-11`, `h-12`, `min-h-11`, or an equal padding) and at least 44 px wide (`min-w-11`, or horizontal padding of `px-4` or more around text). This includes header links, the "Back to …" link on the detail page, "Change my answers", "Back", "Edit", chips, the slider's row, and the skip link when visible. A link inside a running sentence is exempt; none exists today.

**[REQ-PD-29] Alt text and images**
Every catalog photo SHALL have `alt` equal to the product `name` verbatim (already true in `PickCard`, `BrowseCard`, the detail page, and `SizeOutlines`; this requirement pins it). Any new image usage SHALL take its `alt` from a catalog field. Decorative SVG SHALL be `aria-hidden="true"`. An SVG that carries meaning SHALL have `role="img"` and an `aria-label`. A drawing whose caption (`figcaption`) repeats its `aria-label` SHALL be `aria-hidden`, so a screen reader does not read the same sentence twice (open question Q-PD7).

**[REQ-PD-30] The calibration slider is accessible**
The range input SHALL keep its accessible name "Card outline width" and `aria-describedby="cal-help"`, and SHALL add `aria-valuetext` of the form "Outline {n} pixels wide". The text SHALL NOT contain "true size". The input SHALL be at least 44 px high. It SHALL respond to the arrow keys, Home, End, PageUp, and PageDown as a native range input does.

**[REQ-PD-31] Document-level basics**
`<html>` SHALL carry `lang="en"`. The viewport SHALL NOT disable zoom (no `maximum-scale`, no `user-scalable=no`). Each screen SHALL reflow at 320 CSS px without two-dimensional scrolling (REQ-PD-08) and SHALL remain usable at 200% text size. Each page SHALL have a distinct `<title>` (REQ-PD-33).

**[REQ-PD-32] Colour is never the only signal**
No state SHALL be shown by colour alone: verdict by the words "Good fit" and "Check this", flagged rows by "Worth a look", out of stock by "Out of stock", pressed chips by fill and `aria-pressed`, progress by the text "Question n of 6".

---

## 3. Page titles (M3 open question Q22)

**[REQ-PD-33] Root template**
`app/layout.tsx` SHALL export metadata with `title: { default: "Haunted Gift Atelier — Tiny Tiaraa", template: "%s | Haunted Gift Atelier" }`, keeping its current `description`. The landing page SHALL use the default title.

**[REQ-PD-34] Piece title format**
`lib/page-meta.ts` SHALL export `pieceTitle(product)`. For an in-stock product it SHALL return the catalog `name` verbatim. For an out-of-stock product it SHALL return `${name} (out of stock)`. The title SHALL NOT contain a price, a price band, a rating, a discount word, "safe", "unsafe", a certification term, or "true size". Names carry the site's spelling ("sudd set", "studd set") and any trailing full stop. The rendered `<title>` is `{name} | Haunted Gift Atelier`.

**[REQ-PD-35] Piece description**
`pieceDescription(product)` SHALL return one sentence built only from catalog fields: `{name}: {category}, {metal label}, listed for {age group labels}. See the fit check, a size view you calibrate, and a gift wrap.` through the existing `METAL_LABEL` and `AGE_GROUP_LABEL`. It SHALL contain no price, no rating, and no "true size". `app/piece/[sku]/page.tsx` SHALL export `generateMetadata` that awaits `params`, finds the product through `lib/catalog-store.ts`, and returns these two values. For an unknown SKU it SHALL return `{ title: "Piece not found" }` and no description.

**[REQ-PD-36] Route titles**
Each other route SHALL export a static `metadata.title`: `/find` "Find a gift"; `/picks` "Your picks"; `/atelier` "The atelier". The five titles (landing default, three static, piece) SHALL be distinct and non-empty.

---

## 4. Automated accessibility checks

**[REQ-PD-37] Tooling**
Accessibility rules SHALL run through `axe-core` called directly from Vitest in the jsdom environment (the package is already installed at 4.14.1 as a dependency of `eslint-plugin-jsx-a11y`; the implementation adds it as a direct `devDependency` and verifies it works with Vitest 5.1.1, jsdom 31, and Testing Library 16.3.3 before relying on it). `vitest-axe` is the fallback only if the direct call fails, and the result of that decision SHALL be recorded in the evidence log. `eslint-plugin-jsx-a11y` rules that `eslint-config-next` already enables SHALL stay on in `npm run lint`. No browser, Playwright, or other new test runner SHALL be added.

**[REQ-PD-38] Axe over the journey**
`tests/a11y.axe.test.tsx` SHALL render each screen (design §7.2 matrix) and assert zero axe violations at the `wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`, and `best-practice` tags. The rules that need real layout (`color-contrast`, `target-size`, `scrollable-region-focusable`) SHALL be disabled in the axe call, with the reason in a comment, and replaced by REQ-PD-40 and REQ-PD-41. A disabled rule SHALL NOT be used to hide a real violation.

**[REQ-PD-39] Role and query assertions where axe cannot judge**
`tests/a11y.keyboard.test.tsx` SHALL assert, with Testing Library queries: one `h1` and no skipped level per screen; one `main#main-content`; the skip link is the first focusable element; no positive `tabIndex`; `tabIndex={-1}` only on the allowed targets; focus lands on the new heading after each conversation step, edit, and return to the card; focus lands on the gift-card heading at `revealed`; every chip has `aria-pressed`; every chip group has a name; each live region of REQ-PD-22 exists before its text changes and holds exactly the pinned text after; every `target="_blank"` link references the hint; every repeated link references its card heading; every product photo has `alt` equal to the name; the slider has name, `aria-describedby`, and `aria-valuetext`; every drawing whose caption repeats its label is `aria-hidden`.

**[REQ-PD-40] Contrast is computed, not eyeballed**
`tests/a11y.contrast.test.ts` SHALL parse the six `--color-*` values from `app/globals.css`, composite every text role and border role found in `components/` and `app/` (by scanning the source) over every surface, and assert the REQ-PD-25 and REQ-PD-26 minimums. It SHALL also assert that the helper reproduces known WCAG values (black on white 21:1, `#767676` on white 4.54:1) and that the policy alpha floor is tight (`text-plum/60` fails on at least one surface, `text-plum/75` passes on all).

**[REQ-PD-41] Touch targets and class rules**
`tests/a11y.targets.test.tsx` and `tests/a11y.static.test.ts` SHALL assert, from the rendered class lists and the source: every control meets REQ-PD-28 by its height and width classes (jsdom does not load Tailwind, so computed layout is unavailable; the test says so and the manual pass covers glass); no `text-gold`; no text alpha below 75; every `border-plum/N` on a control has `N ≥ 60`; no `outline-none` outside the allowed targets; no `order-*` or reverse classes; no `transition`, `animate-`, or `animation` use that the global rule (REQ-PD-27) does not cover; no inline animation style; no smooth scroll; no `maximum-scale` or `user-scalable`; no raw `<img>`; `lang="en"` in the layout; every `<button>` comes from `ActionButton` or is a chip.

**[REQ-PD-42] Copy lock and brand tests**
`tests/polish.copy.test.ts(x)` SHALL render each screen and assert the pinned strings of REQ-PD-16, the "true size" rule (exactly once in the approximate and stale modes), the footnote on every `₹` node, no discount wording, the out-of-stock card has no buy control, and the brand invariants of REQ-PD-15, over all 22 SKUs where the screen shows them.

**[REQ-PD-43] Title tests**
`tests/page-meta.test.ts` and `tests/page-meta.property.test.ts` SHALL cover REQ-PD-33 to REQ-PD-36, and `lib/page-meta.ts` SHALL be pure and reach ≥ 80% line coverage.

**[REQ-PD-44] What stays manual**
`docs/qa-reports/polish-m4.md` SHALL hold a checklist for what the automated suite cannot judge, with each line "NOT RUN" until a human fills it: a real keyboard walkthrough of the whole journey; a screen-reader pass (name the reader and browser used); a physical contrast spot-check on a real screen with a contrast tool (at least the six token pairs and the muted text roles); a forced-colors (high-contrast) look; zoom to 200% and reflow at 320 px; touch-target feel on a phone; reduced-motion on (system setting) for the landing, the wrap, and the calibration; the premium visual review (REQ-PD-45); the calibration slider with keyboard only. The checklist SHALL NOT contain a measured number the builder did not take. The T4.3 physical calibration lines stay "not run" in `docs/qa-reports/true-size-m3.md`.

**[REQ-PD-45] Premium visual review**
The checklist SHALL include a visual review at 360, 768, and 1280 px wide of all five journey screens plus a piece page per category, against this list: one display face and one sans; the type scale of REQ-PD-03; the spacing and radii of REQ-PD-04; consistent card padding; no orphaned styles; buttons aligned at card bottoms; photos uncropped on pearl; prices with their footnote legible; nothing haunted over content. WHEN a headless browser exists on the machine, the implementation MAY add screenshots to the evidence log; otherwise it SHALL record "not run".

---

## 5. The dev-only "instant" warning

**[REQ-PD-46] Reproduce and record**
One investigation task SHALL reproduce the dev-only Next.js instant-navigation warning on `/find` and `/picks` (`searchParams` awaited outside a `<Suspense>` boundary), copy the exact message into the evidence log, and record whether `/atelier` and `/piece/[sku]` warn too.

**[REQ-PD-47] Decide and record, one session**
The task SHALL decide between (a) `export const instant = false` on the affected pages, and (b) moving the `searchParams` read into a `<Suspense>`-wrapped child with a static fallback, using the criteria of design §8, and SHALL record the decision and its reason in the evidence log either way, including "no code change". The work SHALL take at most one implementation session. The warning SHALL be treated as a dev diagnostic, not a behaviour bug: `npm run build` already passes.

**[REQ-PD-48] Behaviour is unchanged**
Whatever the decision, `/picks` without `m` SHALL still answer 200 with a meta-refresh to `/find`, `/picks` with a valid `m` SHALL still render the golden-case-1 picks in order (TBZ-1013, TNZ-1056, TBZ-1017), and no pinned string SHALL change. A Suspense fallback, if added, SHALL contain no pinned string, SHALL carry `aria-busy="true"`, and SHALL NOT render a fake card or a fake price.

---

## 6. Boundaries, ownership, regression

**[REQ-PD-49] Existing tests**
The 953 existing tests SHALL keep passing. A test assertion that pins a class the polish deliberately changes SHALL be updated to the new class in the same task, and the change SHALL be listed in the evidence log. The known assertions are `tests/atelier.ui.test.tsx` (`text-plum/50` becomes `text-plum/75`) and `tests/gift-wrap.ui.test.tsx` (`border-plum/30` becomes `border-plum/60`). No golden case, property test, or behavioural assertion SHALL be loosened or removed. The test count SHALL not fall.

**[REQ-PD-50] Ownership**
The `design-polish` agent SHALL edit `components/**`, `app/**`, and `app/globals.css` only. The builder session (or `gift-curator`) SHALL write `lib/page-meta.ts`, every file in `tests/`, the docs, and the `package.json` change. The `qa-auditor` agent SHALL audit read-only and write `docs/qa-reports/polish-m4-audit.md`. A task that needs a change outside an owner's paths SHALL stop and report it.

**[REQ-PD-51] Purity and no new network**
`lib/page-meta.ts` SHALL have no React import, I/O, clock, randomness, network, or LLM client, and SHALL import only types and the `METAL_LABEL` and `AGE_GROUP_LABEL` maps. With the LLM route absent the app SHALL make no network call beyond its own origin (`tech.md`). No `app/api/` directory SHALL be added.

**[REQ-PD-52] Design lock**
At the end of the pass the evidence log SHALL record the token block, the type scale, the spacing and radius scale, and the focus rule as locked ("visual language frozen", architecture §9, Mon 30 Nov). A later change to them is a spec change.

---

## 7. Integration acceptance

**[REQ-PD-53] End to end**
With the dev server running: every route SHALL return its current status and its distinct `<title>` (`/` "Haunted Gift Atelier — Tiny Tiaraa", `/find` "Find a gift | Haunted Gift Atelier", `/picks?m=…` "Your picks | Haunted Gift Atelier", `/atelier` "The atelier | Haunted Gift Atelier", `/piece/TNZ-1056` "Blue Evil Eye Nazariya – 925 Silver Baby Bracelet | Haunted Gift Atelier", `/piece/TNZ-1058` with "(out of stock)"); every page SHALL contain `lang="en"`, one `id="main-content"`, one `<h1`, and the skip link before the first heading; `/picks` golden case 1 SHALL be unchanged; the approximate-size label SHALL appear once on `/piece/TNZ-1056`; `npm test`, `npm run typecheck`, `npm run lint`, `npm run validate-catalog`, and `npm run build` SHALL pass; and no `coverage/` directory, dev server, or temp file SHALL remain.

---

## 8. Property-test invariants

**[REQ-PD-54] A1 Contrast helper is correct.** For random sRGB colours the ratio is symmetric, between 1 and 21, equals 1 for equal colours, and compositing at alpha 1 returns the foreground; known values hold (REQ-PD-40).
**[REQ-PD-55] A2 Policy alpha holds everywhere.** For every alpha in `{75, 80, 85, 90, 95, 100}` and every surface, `text-plum/alpha` is at least 4.5:1; for every alpha in `{60, 65, 70}` and the surface set, at least one surface is below 4.5:1 or within 0.05 of it (so the floor is justified, not arbitrary).
**[REQ-PD-56] A3 Border policy holds.** For every alpha in `{60, 70, 80, 90, 100}` and every surface, `border-plum/alpha` is at least 3:1.
**[REQ-PD-57] A4 Piece titles are grounded.** For all 22 products, `pieceTitle` contains the name verbatim exactly once; contains "out of stock" if and only if the product is out of stock; matches none of `/₹|\d,\d{3}|%|\bsave\b|\boff\b|\bMRP\b|certif|hypoallergenic|\bsafe\b|\bunsafe\b|true[- ]size/i` outside the name; and is deterministic. `pieceDescription` obeys the same and contains no digit that is not in the catalog name or the age-group label.
**[REQ-PD-58] A5 Routes have distinct titles.** The default, `/find`, `/picks`, `/atelier`, and 22 piece titles are pairwise distinct.
**[REQ-PD-59] A6 One h1 and a valid outline.** For every screen state in the axe matrix, there is exactly one `h1`, no heading level is skipped going down, and there is exactly one `main`.
**[REQ-PD-60] A7 Focus follows the step.** For any reachable conversation state sequence (an index-based generator that picks a valid action for the current state, as `arbFlow` does in `tests/conversation.property.test.ts`), after each step change the focused element is the heading of the new step, and every step has a non-empty, distinct prompt.
**[REQ-PD-61] A8 Every control is large and named.** For `PickCard` and `BrowseCard` over all 22 products (and the three golden models), every interactive element has a non-empty accessible name containing its visible text and meets REQ-PD-28.
**[REQ-PD-62] A9 Motion is covered.** Every `animation:` and `transition:` declaration in `app/globals.css` and every `transition`/`animate-` utility in the source is neutralised by the REQ-PD-27 rule; the wrap keyframes still end by `WRAP_REVEAL_MS`.
**[REQ-PD-63] A10 Pinned copy and brand hold.** Over all 22 SKUs and all screens that show them: the REQ-PD-16 strings are present, "true size" appears once in approximate and stale modes, every `₹` has the footnote, and no screen contains a discount word, a logo image, or an overlay on a photo.
