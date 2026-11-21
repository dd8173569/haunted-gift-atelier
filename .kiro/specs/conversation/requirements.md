# Conversation — Requirements

*Spec for PRD §1 (journey steps 2–4 and the browse escape hatch) and PRD §4 (conversation design). Milestone 2. Implemented in `lib/conversation.ts` (pure state machine) plus the routes `/find`, `/picks`, `/atelier` and their components. Matching comes from `lib/matching.ts` (see `matching-core`, REQ-MC-01 to REQ-MC-42). Catalog facts come from `data/catalog.json` via `lib/catalog.ts` (see `catalog-data`, REQ-CD-01 to REQ-CD-26).*

Terms: **chip** = a tappable answer button. **Answers** = the chips the user has tapped so far. **Recipient model** = the `RecipientModel` type in `lib/matching/types.ts`; this spec produces exactly that type and never redefines it. **Confirmed model** = a recipient model the user has seen on the recipient card and approved with "Reveal my picks". **Pick** = an entry of `MatchResult.picks`. **Price region** = one container on screen that shows one or more prices and carries one price footnote. **LLM** = any language-model call.

Scope: the `/piece/[sku]` detail page, safety verdict, true-size viewer, gift wrap, and the optional LLM route belong to later specs (`safety-verdict`, `true-size-viewer`, `gift-presentation`, and the M5 stretch). This spec does not change `lib/matching.ts`, `lib/matching/*`, `lib/catalog.ts`, `data/catalog.json`, or `data/*.ts`.

---

## 1. The question flow

**[REQ-CV-01] Six questions, chip-first**
The conversation SHALL ask at most 6 questions, in this order: (1) who the gift is for, (2) the occasion, (3) the budget, (4) the metal, (5) symbols, (6) the kind of piece. Every question SHALL be answered by tapping a chip. No question SHALL require typed text.

**[REQ-CV-02] One question at a time**
The system SHALL show exactly one question at a time, with a progress marker showing the current question number out of 6 (a crescent-moon marker, per the brand rules). Question 1 has two parts (relationship, then age) that share the marker value "1 of 6".

**[REQ-CV-03] Back is always available**
From every question after the first, and from the recipient card, the system SHALL show a "Back" control that returns to the previous applicable question with the earlier answer still selected. Going Back SHALL NOT clear any answer. On question 1 (relationship) the control SHALL be a link to `/`.

**[REQ-CV-04] Chip options and model values**
The chips SHALL be exactly these, with the model values shown. Labels are verbatim from PRD §4.

| Question | Chips (label → model value) |
|---|---|
| 1a Who | Niece or nephew → `niece-nephew` · Grandchild → `grandchild` · A friend's baby → `friends-baby` · Godchild → `godchild` · My own child → `own-child` · Mom → `mom` · Someone else → `other` → `relationship` |
| 1b Age | 0–1 → `infants` · 1–3 → `infants` · 3–6 → `kids` · 6–12 → `kids` · 12–19 → `teens` → `ageBand`; plus "An adult" (REQ-CV-12) |
| 2 Occasion | Naming ceremony → `naming` · Birthday → `birthday` · First birthday → `first-birthday` · Baby shower → `baby-shower` · Festival → `festival` · Rakhi → `rakhi` · Just because → `just-because` → `occasion` |
| 3 Budget | Under ₹2,500 → `under-2500` · ₹2,500–₹15,000 → `2500-15000` · ₹15,000–₹25,000 → `15000-25000` · ₹25,000+ → `25000-plus` · No limit → `no-limit` → `budgetBand` |
| 4 Metal | 18KT gold → `gold` · 925 silver → `silver` · No preference → `any` → `metal` |
| 5 Symbols | Any → `any` · Zodiac → `zodiac` · Evil eye / nazariya → `evil-eye` · Religious → `religious` (opens sub-chips, REQ-CV-10) · No religious symbols → `none-religious` → `symbols` |
| 5 sub-chips | Om · Ganesha · Cross · Sikh · Trishul · Jain · Tabeez → `symbolList` (lower-case keys of `SYMBOL_CHIP_TAGS`) |
| 6 Piece | Pendant → `pendant` · Bracelet → `bracelet` · Earrings → `earrings` · Set → `set` · Tabeez → `tabeez` · Surprise me → `any` → `category` |

The `other` occasion value exists in the type but SHALL NOT be offered as a chip.

**[REQ-CV-05] Age chips use half-open intervals**
The age chips SHALL cover `[0,1)`, `[1,3)`, `[3,6)`, `[6,12)`, `[12,19)`, so a chip's range never overlaps its neighbour. Each chip's `ageBand` SHALL equal what `ageYearsToBand()` returns for the chip's lower bound (0 and 1 → `infants`; 3 and 6 → `kids`; 12 → `teens`), which keeps REQ-MC-02 true. The model's `ageYears` SHALL be set to the chip's lower bound (0, 1, 3, 6, 12) so the chip can be recovered from the model. The system SHALL NOT present `ageYears` to the user as the child's real age; every on-screen age is a chip range ("0–1 years").

**[REQ-CV-06] Single tap advances**
WHEN the user taps a chip on any question except question 5 with "Religious" selected, the system SHALL record the answer and move on without a separate confirm button. On question 5 with "Religious" selected, the system SHALL show a "Continue" button, because the sub-chips are multi-select.

**[REQ-CV-07] Complete models only**
The conversation SHALL produce a `RecipientModel` only when every applicable question is answered. It SHALL never produce a partial model, never fill a missing answer with a default, and never infer an answer from another (REQ-MC-11: religious opt-in is never inferred).

**[REQ-CV-08] Happy path by taps**
The whole path from `/find` to the first pick card SHALL be completable by taps alone, in 8 taps (questions 1a, 1b, 2, 3, 4, 5, 6, then "Reveal my picks"), plus one "Continue" tap and one tap per sub-chip when "Religious" is chosen. A scripted tester SHALL complete it in under 2 minutes with the LLM off.

---

## 2. Branching

**[REQ-CV-09] Question 5 sub-chips appear only for "Religious"**
The seven religious sub-chips SHALL be visible only while "Religious" is selected. Selecting any other question 5 chip SHALL hide them and clear `symbolList`. WHEN "Religious" is selected with no sub-chip selected, the model SHALL carry `symbols = 'religious'` and no `symbolList` (any religious piece). WHEN sub-chips are selected, `symbolList` SHALL hold them in the fixed chip order (om, ganesha, cross, sikh, trishul, jain, tabeez).

**[REQ-CV-10] Religious is explicit opt-in**
The model SHALL carry `symbols = 'religious'` only after the user taps "Religious". No other answer (occasion, relationship, festival, name) SHALL set or imply it. "No religious symbols" SHALL set `none-religious`, which `matching-core` never relaxes (REQ-MC-12).

**[REQ-CV-11] Mom skips question 6**
WHEN the recipient is Mom, the system SHALL NOT ask question 6, SHALL set `category = 'any'`, and SHALL show a one-line note in its place. The note SHALL be built from the catalog: WHEN every in-stock product listed for Mom has the same category, it reads "Only {category, lower case, plural} are listed for Mom, so we skipped the piece question."; otherwise it reads "We skipped the piece question for Mom." The system SHALL NOT hard-code the category. The age questions SHALL also be skipped, with `ageBand = 'mom'` and no `ageYears`.

**[REQ-CV-12] Adults who are not Mom**
The age question SHALL offer an "An adult" chip (the only way to reach the PRD §3 adult path by taps). WHEN it is tapped, the system SHALL ask "Is this for Mom?" with chips "Yes, Mom" and "No". "Yes, Mom" SHALL set `relationship = 'mom'` and `ageBand = 'mom'` and continue as in REQ-CV-11. "No" SHALL end the flow with exactly this honest message: "This atelier specialises in babies, kids, and Mom." plus a "Browse the atelier" link to `/atelier` and a Back control. Matching SHALL NOT run, and no model SHALL be produced (REQ-MC-03).

**[REQ-CV-13] Changing an answer repairs the branch**
WHEN the user changes an answer so that a later answer no longer applies (for example "Mom" replaced by "Grandchild", "Religious" replaced by "Zodiac", an adult age replaced by a child age), the system SHALL discard exactly the answers that no longer apply and SHALL ask any newly applicable question before showing the card. It SHALL NOT discard an answer that still applies.

---

## 3. The recipient card

**[REQ-CV-14] Card before matching**
WHEN all applicable questions are answered, the system SHALL show a recipient card before any matching runs. The card SHALL begin with one plain-words sentence built from the model, in the form "A {occasion} gift for your {relationship}, {age chip range}" (for example "A naming gift for your niece or nephew, 0–1 years"), followed by one line each for: who, age, occasion, budget, metal, symbols, kind of piece. For Mom the age line and the piece line SHALL be replaced by the REQ-CV-11 note.

**[REQ-CV-15] Words come from the model**
Every word on the card SHALL be rendered from the current answers through fixed label maps. The card SHALL NOT state a fact about any product, and SHALL NOT use `ageYears` as a real age (REQ-CV-05).

**[REQ-CV-16] Per-line Edit**
Each card line SHALL have an "Edit" control. WHEN tapped, the system SHALL open that question with the current answer selected. After the user answers, the system SHALL return to the card, unless REQ-CV-13 made a new question applicable, in which case it asks that question first. The card SHALL update in the same render as the answer.

**[REQ-CV-17] Reveal runs from the confirmed model only**
The card SHALL have one primary control, "Reveal my picks". Matching SHALL run only after the user activates it. The control SHALL be a navigation to `/picks` carrying the model (REQ-CV-18); no matching SHALL run on `/find`.

---

## 4. Model transport and the matching gate

**[REQ-CV-18] Model travels in the URL**
`/find` SHALL pass the confirmed model to `/picks` in one query parameter named `m`, whose value is the model as JSON in canonical key order, percent-encoded. The app SHALL NOT store the model in `localStorage`, cookies, a database, or server memory. The same `m` SHALL reproduce the same picks on any device (REQ-MC-31).

**[REQ-CV-19] Strict parse**
`/picks` SHALL accept `m` only if it passes `validateModel()`: a single (not repeated) value of at most 1,000 characters; valid JSON; an object whose keys are all known `RecipientModel` keys; every enum field inside its enum; `symbolList` present only when `symbols = 'religious'` and every entry a known chip key; `ageYears` a finite number in `[0,19)` that maps to `ageBand` via `ageYearsToBand()` when present; and `relationship = 'mom'` exactly when `ageBand = 'mom'`. An unknown key, wrong type, or out-of-enum value SHALL make the whole parameter invalid. The system SHALL NOT repair or coerce a value.

**[REQ-CV-20] Missing or invalid model redirects**
WHEN `m` is absent, `/picks` SHALL redirect to `/find`. WHEN `m` is present but invalid, `/picks` SHALL redirect to `/find?notice=incomplete`, and `/find` SHALL show the one-line note "That link did not carry a complete recipient, so let's start again." and begin at question 1. `/picks` SHALL NOT render an error page or an empty picks page for either case.

**[REQ-CV-21] Invalid model never reaches match()**
`match()` SHALL be called from exactly one place in the app: the `/picks` page, after `validateModel()` returned ok. No component SHALL call `match()`.

**[REQ-CV-22] Resume and change answers**
WHEN `/find` receives a valid `m`, it SHALL start on the recipient card for that model with every line editable. `/picks` SHALL show a "Change my answers" link to `/find?m=…` carrying the same model. An invalid `m` on `/find` SHALL be ignored with the REQ-CV-20 note.

---

## 5. The picks page

**[REQ-CV-23] Exactly what match() returns**
`/picks` SHALL render exactly the picks in `MatchResult.picks`, in the order returned: no more, none dropped, none reordered, none added. The page SHALL NOT filter, score, rank, or rename a pick. Each rendered pick SHALL join to one catalog product by `sku`; a pick whose SKU is not in the catalog SHALL fail the render loudly, not be skipped.

**[REQ-CV-24] Exactly 3, or fewer with a shortfall note**
WHEN `match()` returns 3 picks, the page SHALL show 3 cards. WHEN it returns 1 or 2, the page SHALL show those cards, the `shortfallNote` verbatim, and a "Browse the full atelier" link to `/atelier`. WHEN it returns 0, the page SHALL show the `shortfallNote`, the browse link, and "Change my answers". The page SHALL NOT add a placeholder, a "similar item", or a filler card.

**[REQ-CV-25] Never an out-of-stock pick**
No pick card SHALL show a product whose `availability` is not `In Stock`. A pick with `Out of Stock` SHALL fail the render (REQ-MC-07 makes this unreachable; the page checks anyway).

**[REQ-CV-26] Photo exactly as downloaded**
Each pick card SHALL show the catalog photo at `/catalog/{image_file}` through `ProductPhoto`: `object-contain` on the pearl background, uncropped, unfiltered, with no text, badge, or overlay on the photo. The alt text SHALL be the product name verbatim.

**[REQ-CV-27] Name and price verbatim**
Each pick card SHALL show `name` exactly as in the catalog (including "sudd set" and "studd set"), and `price_inr` formatted by the shared Indian-grouping helper (`formatInr`, for example ₹2,324). The card SHALL NOT show a discount, a strike-through, an MRP, or "% off".

**[REQ-CV-28] Snapshot footnote on every price**
Every price region SHALL contain the text "Price as listed on tinytiaraa.com on 21 Nov 2026 — check the store for the current price." through `PriceFootnote`. Each pick card is its own price region, so its relaxation sentence and reasons that contain a price sit inside the same region.

**[REQ-CV-29] Why-reasons come from match()**
Each pick card SHALL list the pick's `reasons[].text` verbatim, in the order returned, 2 to 4 per card (REQ-MC-29). The page SHALL NOT write, edit, translate, or add a reason, and SHALL NOT use an LLM for any reason.

**[REQ-CV-30] Every relaxation disclosed in plain words**
WHEN `MatchResult.disclosures` is non-empty, the page SHALL show every sentence verbatim in one note above the cards. WHEN a pick has `relaxations`, its card SHALL show a plain-words label for each: `budget-below` → "Just below your budget"; `budget-above` → "Just above your budget"; `symbol-broadened` → "A related symbol"; `metal-dropped` → "A different metal"; `category-dropped` → "A different kind of piece". WHEN a pick has `relaxationNote`, the card SHALL show it verbatim. The page SHALL NOT show a disclosure for a relaxation that did not happen, and SHALL NOT hide one that did.

**[REQ-CV-31] Rating only when listed**
A pick card SHALL show the catalog `rating` string verbatim only when it is non-null. It SHALL NOT show a placeholder, a zero, or a rounded value for a null rating.

**[REQ-CV-32] Buy link is the catalog URL**
Each pick card SHALL have a "Buy on Tiny Tiaraa" link whose `href` is the product's `url` field exactly as stored, with `target="_blank"` and `rel="noopener noreferrer"`. The link SHALL NOT add query parameters, tracking, or a redirect through the app.

**[REQ-CV-33] No dead end on picks**
Every state of `/picks` (3, 1–2, or 0 picks) SHALL offer a way forward: "Change my answers" and "Browse the full atelier". Until the detail page exists (`/piece/[sku]`, a later milestone), a pick card SHALL NOT link to it, so no link leads to a 404.

---

## 6. The browse escape hatch

**[REQ-CV-34] Grid of the whole catalog**
`/atelier` SHALL show all 22 catalog products in one grid: the 21 in-stock products first, then the out-of-stock product. It SHALL work with no conversation, no model, and no query parameter.

**[REQ-CV-35] Filters**
The grid SHALL offer four filters, each a single-select chip group with an "All" chip: age (Infants 0–3 years, Kids 3–12 years, Teens 12–19 years, Mom, matched against `age_groups`), category (Pendant, Bracelet, Earrings, Set, Tabeez), metal (18KT gold, 925 silver), and budget (the four bands, matched against `price_band`). Filters SHALL combine with AND. Each filter SHALL change the grid in the same render, with no network call.

**[REQ-CV-36] Filter state in the URL**
The grid SHALL mirror its filters in the query parameters `age`, `category`, `metal`, `budget`, so a filtered view can be shared. An unknown or invalid value SHALL be treated as "All" without an error. The URL SHALL be updated without a navigation or reload.

**[REQ-CV-37] Empty filter result**
WHEN no product matches the filters, the grid SHALL show "No piece matches those filters." and a "Clear filters" control. The out-of-stock product is a product like any other for this rule: it counts as a match and is shown when it passes the filters.

**[REQ-CV-38] Out-of-stock product greyed, no buy CTA**
The out-of-stock product (TNZ-1058 in catalog v1.0.0) SHALL be shown muted (muted surface and text colours from the tokens) with the text "Out of stock" beside the photo, not over it. Its photo SHALL stay unfiltered and full-strength. It SHALL have no "Buy on Tiny Tiaraa" link and no other buy control. The grid SHALL derive this from `availability`, not from a hard-coded SKU.

**[REQ-CV-39] Browse card facts**
Each grid card SHALL show the photo (REQ-CV-26), the name verbatim, the price (REQ-CV-27) in a price region with the footnote (REQ-CV-28), the category, the metal label, and the rating verbatim only when listed (REQ-CV-31). Each in-stock card SHALL have the buy link of REQ-CV-32. The grid is one price region: it SHALL carry the footnote once, directly above the cards, within the same container.

---

## 7. Acceptance through the UI

**[REQ-CV-40] Golden cases reproduce through the UI flow**
Driving the flow by taps SHALL give the same picks, in the same order, with the same scores, disclosures, and shortfall note as `matching-core`:

1. Golden case 1 (REQ-MC-33): Niece or nephew, 0–1, Naming ceremony, Under ₹2,500, 925 silver, Any, Surprise me → TBZ-1013, TNZ-1056, TBZ-1017, each scoring 6, no disclosure.
2. Golden case 2 (REQ-MC-34): Mom, Birthday, ₹25,000+, 18KT gold, Any → THP-1001 (7), THP-1017 (6); the note "Only 2 pieces in the atelier are listed for Mom"; the browse link; no third card; question 6 not asked.
3. Golden case 3 (REQ-MC-35): Someone else, 12–19, Festival, ₹15,000–₹25,000, 18KT gold, Religious + Ganesha, Surprise me → TPN-1141 (9), TPN-1147 (7), TPN-1143 (7), with both disclosures and the TPN-1141 relaxation sentence.

The test SHALL compare against the live output of `match()` for the model the taps produced, and against the SKU, score, and text values above.

**[REQ-CV-41] Scripted personas**
The 8 scripted personas of PRD §4 SHALL each be completable by taps and SHALL produce the picks pinned in `tests/matching.personas.test.ts` (persona 3: TNZ-1058 never appears; persona 8: no religious piece). Answers the persona does not state SHALL be the "no preference" chip ("Any", "No preference", "Surprise me"). The four open matching questions recorded in `docs/kiro-evidence-log.md` (session 2b, personas 2, 3, 6, 8) SHALL NOT be resolved by this spec or by the UI; the UI shows what `match()` returns.

**[REQ-CV-42] No dead ends, no walls**
No screen SHALL require a login, an account, a payment, a cookie banner, or typed input. Every screen SHALL offer a way back or onward (REQ-CV-03, REQ-CV-12, REQ-CV-33, REQ-CV-37).

---

## 8. LLM boundary

**[REQ-CV-43] Scripted only in Milestone 2**
This milestone SHALL ship no LLM call, no LLM client import, no `app/api/chat/route.ts`, and no API key. Every conversational line SHALL be a fixed string in `lib/conversation.ts`. With the app running offline except for its own origin, the whole journey SHALL work.

**[REQ-CV-44] Free text degrades gracefully**
The conversation SHALL offer no free-text input in Milestone 2. WHEN a later milestone adds a free-text field and the LLM is off, failed, or unconfigured, the field SHALL show "I can only take taps right now" and the chips SHALL keep working. This requirement is the contract the M5 stretch must meet.

**[REQ-CV-45] What an LLM may never do (contract for M5)**
An LLM, when added, MAY rephrase the atelier's conversational lines, MAY parse free text into structured fields only behind a confirmation step ("Just to check — a birthday gift for a 2-year-old niece?"), and MAY draft the gift message. It SHALL NEVER name, recommend, or describe a product; state a price, availability, material, or safety claim; or change, reorder, or filter the matching result. It SHALL NEVER be required for any step.

---

## 9. Purity, brand, and tests

**[REQ-CV-46] State machine is pure**
`lib/conversation.ts` SHALL export pure functions and types only: no React import, no I/O, no clock, no randomness, no network, no LLM, no mutation of its inputs. The catalog SHALL be passed in as an argument where a function needs it (REQ-CV-11).

**[REQ-CV-47] One shared source of facts**
Components SHALL NOT import `data/catalog.json`. Product facts SHALL reach the UI through `lib/catalog.ts` types and a parsed catalog loaded once on the server. Money SHALL be formatted by the one shared helper.

**[REQ-CV-48] Tokens only**
All new components SHALL use only the colour tokens in `app/globals.css` (pearl, blush, champagne, sage, gold, plum, and opacity variants of them). No `#hex`, `rgb()`, or arbitrary colour value SHALL appear in a component. "Tiny Tiaraa" SHALL appear as text in the display serif and never as an image. No logo, watermark, or generated image SHALL be added.

**[REQ-CV-49] Spooky never obscures**
The crescent-moon progress marker is the only haunted element in the conversation. No haunted element SHALL cover or sit over a price, a photo, a reason, a disclosure, or a note.

**[REQ-CV-50] Accessible by keyboard and screen reader**
Every chip SHALL be a real button with `aria-pressed` reflecting its state, reachable and operable by keyboard. The current question SHALL be announced (heading focus or live region) when it changes. The progress marker SHALL have a text equivalent ("Question 3 of 6").

**[REQ-CV-51] Tests**
Unit and property tests SHALL cover `lib/conversation.ts` and the model-parameter functions at ≥ 80% line coverage. Component tests (Testing Library) SHALL cover the flow, the card, the picks page output, and the grid. Test files SHALL declare their DOM environment per file so the existing node-environment tests are unaffected (design §10).

---

## 10. Property-test invariants

Each SHALL hold for every generated input, against the real catalog.

**[REQ-CV-52] C1 Every path yields a valid model.** For every sequence of answers that completes the flow, `toModel()` returns a model that passes `validateModel()`.
**[REQ-CV-53] C2 Back and change never corrupt.** For every sequence of answer, back, and edit actions, the answers that still apply are unchanged, and a model built after the sequence equals the model built from the final answers alone.
**[REQ-CV-54] C3 Invalid never reaches match().** For every arbitrary value of `m`, either `parseModelParam()` returns a model that passes `validateModel()` and `match()` does not throw, or it returns an invalid result and no match runs.
**[REQ-CV-55] C4 Picks trace to the catalog.** Every rendered pick joins to one catalog SKU, and the rendered picks equal `match()`'s picks in order and count.
**[REQ-CV-56] C5 No out-of-stock pick or buy control.** No rendered pick is out of stock, and no out-of-stock product has a buy link anywhere (picks or grid).
**[REQ-CV-57] C6 Every price carries the footnote.** Every price on screen sits inside a price region that contains the footnote text.
**[REQ-CV-58] C7 Religious only by opt-in.** A model built from answers has `symbols = 'any'` only when the user tapped "Any", `symbols = 'religious'` only when the user tapped "Religious", and a `symbolList` only under "Religious".
**[REQ-CV-59] C8 Transport round trip.** For every valid model, `parseModelParam(encodeModelParam(model))` returns a model deep-equal to the input.
**[REQ-CV-60] C9 Determinism.** The same answers always produce the same model, the same `m`, and the same card text.
