# Conversation — Design

*Implements REQ-CV-01 to REQ-CV-60 (`requirements.md`). Source: PRD §1, §3, §4; architecture §7–§8. Depends on `matching-core` (`match()`, `RecipientModel`, `SYMBOL_CHIP_TAGS`, `formatInr`) and `catalog-data` (`ParsedCatalog`, `Product`). Nothing in `lib/matching.ts`, `lib/matching/`, `lib/catalog.ts`, `data/catalog.json`, or `data/*.ts` changes.*

## 1. Overview

```
/find  (client state machine, no network)                         /picks  (server component)
 relationship → age → [adult-check] → occasion → budget →          m ─► parseModelParam ─► validateModel ─► match() ─► toPickViews ─► PickCard ×0–3
 metal → symbols → [category] → recipient card ──"Reveal my picks"──► /picks?m=<model JSON>                               + disclosures + shortfall
                       ▲  Edit / Back                                  └─ missing → /find   invalid → /find?notice=incomplete
/atelier (server page → client CatalogGrid; filters mirrored in ?age&category&metal&budget)
```

Matching runs in one place only, the `/picks` server component, from a validated model (REQ-CV-21). `/find` is a pure state machine plus rendering.

### File map

| File | Contents | Pure? |
|---|---|---|
| `lib/conversation.ts` | question definitions, chip tables, `Answers`, `ConversationState`, `reduce()`, `toModel()`, `validateModel()`, `stateFromModel()`, `describeModel()`, `momSkipNote()` | yes |
| `lib/model-param.ts` | `MODEL_PARAM`, `encodeModelParam()`, `modelHref()`, `parseModelParam()` | yes |
| `lib/picks-view.ts` | `toPickViews()`: joins `MatchResult` to catalog products, asserts invariants, maps markers to plain words | yes |
| `lib/browse.ts` | `BrowseItem`, `BrowseFilters`, `toBrowseItems()`, `parseBrowseFilters()`, `filterItems()`, `filtersToQuery()`, filter option labels | yes |
| `lib/catalog-store.ts` | `export const catalog = parseCatalog(raw)`: loads `data/catalog.json` once. Imported by server pages only | no logic |
| `app/find/page.tsx` | server page: reads `m` and `notice`, renders `Conversation` | route only |
| `app/picks/page.tsx` | server page: parse, validate, redirect or match, render | route only |
| `app/atelier/page.tsx` | server page: loads catalog, renders `CatalogGrid` | route only |
| `components/Conversation.tsx` (+ `ChipGroup.tsx`, `ProgressMoon.tsx`, `RecipientCard.tsx`) | client UI over the reducer | UI |
| `components/PickCard.tsx`, `DisclosureNote.tsx` | pick rendering | UI |
| `components/CatalogGrid.tsx` (+ `BrowseCard.tsx`) | client grid and filters | UI |
| `components/AtelierButton.tsx` | existing; gains an optional `external` prop (§8) | UI |

`lib/catalog-store.ts` is new, because `lib/catalog.ts` is pure and has no loader (`tests/helpers/matching-fixtures.ts` does the same job for tests). It is a four-line module, not a place for logic. See open question Q6.

## 2. `lib/conversation.ts`

### 2.1 Types and chip tables

```ts
export type QuestionId =
  'relationship' | 'age' | 'adult-check' | 'occasion' | 'budget' | 'metal' | 'symbols' | 'category';
export type Step = QuestionId | 'card' | 'adult-end';

export type AgeChipId = '0-1' | '1-3' | '3-6' | '6-12' | '12-19' | 'adult';
export type SymbolKey = 'om' | 'ganesha' | 'cross' | 'sikh' | 'trishul' | 'jain' | 'tabeez'; // keys of SYMBOL_CHIP_TAGS

export interface Answers {
  relationship?: Relationship;          // chip value; may be overridden by adultIsMom
  age?: AgeChipId;
  adultIsMom?: boolean;
  occasion?: Exclude<Occasion, 'other'>;
  budget?: BudgetBand;
  metal?: MetalPref;
  symbols?: SymbolChoice;
  symbolList?: SymbolKey[];             // only while symbols === 'religious'
  category?: CategoryPref;
}

export interface ConversationState {
  answers: Answers;
  step: Step;
  returnToCard: boolean;                // true while editing from the card (REQ-CV-16)
}

export type Action =
  | { type: 'answer'; question: Exclude<QuestionId, 'symbols'>; value: string | boolean } // typed per question, see below
  | { type: 'pick-symbol'; value: SymbolChoice }       // question 5 top-level chip
  | { type: 'toggle-symbol'; key: SymbolKey }          // question 5 sub-chip
  | { type: 'continue' }                               // question 5 with Religious
  | { type: 'back' }
  | { type: 'edit'; question: QuestionId }
  | { type: 'restart' };
```

The `answer` action is typed per question in the code (a discriminated union such as `{ question: 'occasion'; value: Occasion }`); the table above shows its shape only.

Every chip table is a `const` array with `label` and model `value`, exported so the UI and the tests read the same source:

| Table | Entries |
|---|---|
| `RELATIONSHIP_CHIPS` | 7 chips of REQ-CV-04, plus `phrase` ("your niece or nephew", "your grandchild", "your friend's baby", "your godchild", "your own child", "Mom", "someone special") for the card sentence |
| `AGE_CHIPS` | `{id:'0-1', label:'0–1', band:'infants', years:0}`, `{id:'1-3', label:'1–3', band:'infants', years:1}`, `{id:'3-6', …, band:'kids', years:3}`, `{id:'6-12', …, band:'kids', years:6}`, `{id:'12-19', …, band:'teens', years:12}`, and `{id:'adult', label:'An adult'}` (no band) |
| `OCCASION_CHIPS`, `BUDGET_CHIPS`, `METAL_CHIPS`, `SYMBOL_CHIPS`, `SYMBOL_SUBCHIPS`, `CATEGORY_CHIPS` | the chips of REQ-CV-04, in that order |

Runtime enum lists (`RELATIONSHIPS`, `AGE_BANDS`, `OCCASIONS`, `BUDGET_BANDS`, `METALS`, `SYMBOL_CHOICES`, `CATEGORIES`) are `as const` arrays. Each has a compile-time exhaustiveness check against the matching type (for example `type _R = Exclude<Relationship, (typeof RELATIONSHIPS)[number]> extends never ? true : never`), so a new member in `lib/matching/types.ts` breaks `npm run typecheck` here instead of silently passing validation.

### 2.2 Question definitions

```ts
interface QuestionDef {
  id: QuestionId;
  number: 1 | 2 | 3 | 4 | 5 | 6;     // the progress marker value; 'age' and 'adult-check' share 1
  prompt: string;                     // atelier voice, fixed string
}
```

| id | number | prompt |
|---|---|---|
| `relationship` | 1 | "Who are we finding a gift for?" |
| `age` | 1 | "How old is the little one?" *(new copy, Q9)* |
| `adult-check` | 1 | "Is this for Mom?" |
| `occasion` | 2 | "What's the occasion?" |
| `budget` | 3 | "What shall we spend?" |
| `metal` | 4 | "Gold or silver?" |
| `symbols` | 5 | "Any symbols you'd love — or like to avoid?" |
| `category` | 6 | "What kind of piece?" |

The five prompts that come from PRD §4 are verbatim. Prompts are fixed strings: no template, no LLM (REQ-CV-43).

### 2.3 Applicability and normalisation

```ts
const ORDER: QuestionId[] = ['relationship','age','adult-check','occasion','budget','metal','symbols','category'];

const isMom  = (a: Answers) => a.relationship === 'mom' || a.adultIsMom === true;
const ended  = (a: Answers) => a.age === 'adult' && a.adultIsMom === false && a.relationship !== 'mom';

function applicable(q: QuestionId, a: Answers): boolean {
  if (ended(a)) return q === 'relationship' || q === 'age' || q === 'adult-check';
  switch (q) {
    case 'relationship': return true;
    case 'age':          return a.relationship !== 'mom';
    case 'adult-check':  return a.relationship !== 'mom' && a.age === 'adult';
    case 'category':     return !isMom(a);
    default:             return true;
  }
}
```

`normalize(a)` returns a new `Answers` with every answer removed whose question is not applicable (REQ-CV-13), plus `symbolList` removed unless `symbols === 'religious'`, plus `adultIsMom` removed unless `age === 'adult'` and `relationship !== 'mom'`. It is the only place answers are discarded, and it runs after every answer. Examples: Mom → Grandchild clears nothing but now asks `age` and `category` (both unanswered); Grandchild → Mom clears `age`, `adultIsMom`, `category`; Religious → Zodiac clears `symbolList`.

When `age === 'adult'` and `adultIsMom === true`, `toModel()` builds the model with `relationship = 'mom'`, which matches REQ-CV-12 (the flow asks "Is this for Mom?" only after an adult age).

### 2.4 The reducer

```ts
const initial: ConversationState = { answers: {}, step: 'relationship', returnToCard: false };
function reduce(s: ConversationState, action: Action): ConversationState   // pure, returns a new state
```

| Action | Effect |
|---|---|
| `answer` (any question but `symbols`) | `answers' = normalize({...answers, [q]: value})`. WHEN `ended(answers')` → `step = 'adult-end'`. ELSE WHEN `returnToCard` → `step = firstUnanswered(answers') ?? 'card'` and `returnToCard` becomes false once `step === 'card'`. ELSE `step = nextApplicable(q, answers') ?? 'card'`. |
| `pick-symbol` | Sets `symbols`. Non-religious value: clears `symbolList`, then advances exactly as `answer`. `'religious'`: keeps `symbolList`, does not advance (the sub-chips show; REQ-CV-06). |
| `toggle-symbol` | Only while `symbols === 'religious'`: toggles `key` in `symbolList`, kept in fixed chip order. Never advances. |
| `continue` | Only on `step === 'symbols'` with `symbols === 'religious'`: advances as `answer` would. |
| `back` | From `card` → the last applicable question. From `adult-end` → `adult-check`. From a question → `prevApplicable(q, answers)`. From `relationship` → no change (the UI shows a link to `/`). WHEN `returnToCard` → `step = 'card'`, `returnToCard = false` (Back cancels an edit). Never changes `answers`. |
| `edit` | `step = q`, `returnToCard = true`. |
| `restart` | `initial`. |

`firstUnanswered(a)` is the first `q` in `ORDER` with `applicable(q, a)` and no answer (for `symbols`, an answer is `symbols !== undefined`; for `adult-check`, `adultIsMom !== undefined`). `nextApplicable` and `prevApplicable` walk `ORDER` skipping non-applicable questions. Forward taps without `returnToCard` move one applicable question at a time, so the user is never carried past an unanswered question. Going Back and tapping again lands on questions that may already hold an answer, which the UI shows pre-selected.

Step gating (property P-CV-3): `step === 'card'` implies `toModel(answers).ok`; any other question step is at or before `firstUnanswered(answers)` in `ORDER`, except while editing.

### 2.5 `toModel()` and `validateModel()`

```ts
type ModelResult = { ok: true; model: RecipientModel } | { ok: false; reason: 'adult' | 'incomplete'; missing: QuestionId[] };
function toModel(a: Answers): ModelResult
```

`toModel` first normalises. It returns `{ok:false, reason:'adult'}` when `ended(a)`; `{ok:false, reason:'incomplete', missing}` when any applicable question is unanswered; otherwise builds the model in canonical key order:

```ts
const mom = isMom(a);
{ relationship: mom ? 'mom' : a.relationship,
  ageBand: mom ? 'mom' : AGE_CHIP[a.age].band,
  ...(mom ? {} : { ageYears: AGE_CHIP[a.age].years }),
  occasion: a.occasion, budgetBand: a.budget, metal: a.metal, symbols: a.symbols,
  ...(a.symbols === 'religious' && a.symbolList?.length ? { symbolList: a.symbolList } : {}),
  category: mom ? 'any' : a.category }
```

Optional keys are omitted, never `undefined`, so `JSON.stringify` and deep equality agree.

```ts
type Validation = { ok: true; model: RecipientModel } | { ok: false; reason: string };
function validateModel(x: unknown): Validation
```

`validateModel` is the gate of REQ-CV-19. It accepts only a plain object; rejects unknown keys; checks each enum field against its `as const` list; checks `symbolList` (array of known `SymbolKey`, no duplicates, present only with `symbols === 'religious'`, and then non-empty); checks `ageYears` (finite number, `0 ≤ n < 19`, and `ageYearsToBand(n) === ageBand` unless `ageBand === 'mom'`, where `ageYears` must be absent); and checks `relationship === 'mom'` if and only if `ageBand === 'mom'`. It returns a rebuilt model in canonical key order, not the input object. It never coerces, repairs, or defaults.

### 2.6 Resume and card text

`stateFromModel(model): ConversationState` runs `validateModel` first (returns `initial` on failure) and rebuilds `Answers`: `relationship`, `age` from `ageYears` by the chip intervals (`chipForYears()`; absent `ageYears` for a non-Mom model leaves `age` unanswered), `occasion`, `budget`, `metal`, `symbols`, `symbolList`, `category` (Mom: unanswered, not applicable). It returns `{answers, step: firstUnanswered(answers) ?? 'card', returnToCard: false}`. Property P-CV-8: `toModel(stateFromModel(m).answers)` equals `m` for every valid model that has an `ageYears` or is Mom.

```ts
interface CardLine { question: QuestionId; label: string; value: string }
interface CardView { headline: string; lines: CardLine[]; note?: string }
function describeModel(model: RecipientModel, momNote: string): CardView
function momSkipNote(catalog: ParsedCatalog): string
```

Headline: "A {occasion word} gift for {relationship phrase}, {age range} years" with the age range from the chip (or the age-band label when `ageYears` is absent). Example: "A naming gift for your niece or nephew, 0–1 years". Mom: "A birthday gift for Mom". Lines (label → value): Who → chip label; Age → "0–1 years"; Occasion → chip label; Budget → chip label; Metal → "18KT gold" / "925 silver" / "No preference"; Symbols → "Any symbols" / "Zodiac" / "Evil eye / nazariya" / "Religious: Om, Ganesha" / "Religious, any symbol" / "No religious symbols"; Piece → chip label, with "Surprise me" shown as "Any piece". For Mom the Age and Piece lines are omitted and `note` carries `momNote`.

`momSkipNote(catalog)` filters `catalog.products` to in-stock products whose `age_groups` include `Mom`; if they share one `category` it returns `Only ${category.toLowerCase()} are listed for Mom, so we skipped the piece question.` (v1.0.0: "Only earrings are listed for Mom, so we skipped the piece question."), else "We skipped the piece question for Mom." It trusts the catalog, not a constant (REQ-CV-11). The `/find` server page computes it and passes the string to the client.

## 3. Model transport (DECISION)

**Decision.** The confirmed model travels in one URL query parameter `m` on `/picks` (and back to `/find` for editing), carrying the model as JSON.

| Option | Verdict |
|---|---|
| **URL param `m` = JSON** | **Chosen.** Stateless: no storage, no server memory, no cookie. Shareable and bookmarkable: the same URL gives the same picks on any device (REQ-MC-31 makes that deterministic). A server component can read it, so `/picks` renders on the server with no loading flash. Survives reload and browser Back. Easy for QA to craft and read. The model holds no personal data (no names, no free text), so a shared URL leaks nothing. |
| `localStorage` / `sessionStorage` | Rejected. A server component cannot read it, so `/picks` would become a client component that matches after hydration. Not shareable. The tech steering says "no database, no accounts"; browser storage is not forbidden, but it adds state for no gain. |
| Cookie | Rejected. Adds a banner question and a server-side read for no gain over the URL. |
| Base64url-encoded JSON | Rejected as the default. It saves little length and needs `btoa`/`Buffer` on two runtimes. It hides the value from a human reading the URL. Revisit only if the URL length becomes a problem. |
| Server session | Rejected. Needs a store. Out of scope. |

**Parameter.** Name `m`. Value: `JSON.stringify` of the model in canonical key order (§2.5), then percent-encoded by `URLSearchParams` (`new URLSearchParams({ m: json }).toString()`). Typical length 160 to 230 characters. Example before encoding:

```
{"relationship":"niece-nephew","ageBand":"infants","ageYears":0,"occasion":"naming","budgetBand":"under-2500","metal":"silver","symbols":"any","category":"any"}
```

```ts
export const MODEL_PARAM = 'm';
export const MAX_PARAM_LENGTH = 1000;
export function encodeModelParam(model: RecipientModel): string          // canonical JSON string
export function modelHref(path: '/picks' | '/find', model: RecipientModel): string   // `${path}?m=…`, percent-encoded
export type ParamResult =
  | { status: 'missing' }
  | { status: 'invalid'; reason: string }
  | { status: 'ok'; model: RecipientModel };
export function parseModelParam(raw: string | string[] | undefined): ParamResult
```

`parseModelParam` takes the value Next.js already decoded (`searchParams.m`). `undefined` or `''` → `missing`. An array (repeated `m`), a string longer than `MAX_PARAM_LENGTH`, a `JSON.parse` throw, or a `validateModel` failure → `invalid` with a reason (the reason is for tests and logs, never shown). Otherwise `ok` with the rebuilt model. It never throws.

**Invalid-param behaviour.** `/picks`: `missing` → `redirect('/find')`; `invalid` → `redirect('/find?notice=incomplete')`. `/find`: `notice` is honoured only when it equals the literal `incomplete` (any other value is ignored); `m` valid → resume on the card; `m` invalid → ignored, with the same note and a fresh start. The model is never repaired. A user who edits the URL by hand gets either a valid model (and real picks for it) or the redirect.

## 4. `/find` route

`app/find/page.tsx` is a server component:

```tsx
export default async function FindPage({ searchParams }: { searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  const sp = await searchParams;
  const parsed = parseModelParam(sp.m);
  const notice = sp.notice === 'incomplete' || parsed.status === 'invalid' ? 'incomplete' : undefined;
  return <Conversation initialModel={parsed.status === 'ok' ? parsed.model : undefined}
                       notice={notice} momNote={momSkipNote(catalog)} />;
}
```

`Conversation` (`'use client'`) holds `useReducer(reduce, init)` where `init = initialModel ? stateFromModel(initialModel) : initial`. No `useRouter`, no `useSearchParams`: the only navigations are `Link`s (Back to `/`, "Browse the atelier", "Reveal my picks"), which keeps it free of the Suspense requirement and easy to test.

### Screens

| Step | Rendering |
|---|---|
| a question | `ProgressMoon` ("Question n of 6", crescent marker, text equivalent), the prompt as a focused `<h1>` (REQ-CV-50), a `ChipGroup`, and "Back". Question 1 relationship: the Back control is a `Link` to `/`. |
| `symbols` | top-level `ChipGroup` (single-select). With "Religious" selected, a second multi-select `ChipGroup` of the seven sub-chips and a "Continue" button. |
| `adult-check` | prompt "Is this for Mom?" with chips "Yes, Mom" and "No". |
| `adult-end` | The message "This atelier specialises in babies, kids, and Mom.", an `AtelierButton` to `/atelier` ("Browse the atelier"), and Back. No model. |
| `card` | `RecipientCard` (below). |

`ChipGroup` renders `<button type="button" aria-pressed>` per chip in a `role="group"` labelled by the prompt. Tap targets are at least 44 px. Selected chips use `bg-plum text-pearl`; unselected use `border-plum/30 hover:bg-blush`.

`RecipientCard` takes `describeModel(model, momNote)`: the headline, the lines each with an "Edit" button (dispatches `edit`), the mom note when present, and the primary `AtelierButton href={modelHref('/picks', model)}` "Reveal my picks". A secondary "Back" returns to the last question. The card is computed from `toModel(state.answers)` on every render, so an edit shows in the same render (REQ-CV-16).

## 5. `/picks` route

`app/picks/page.tsx` is a server component, rendered per request (it reads `searchParams`, so Next.js renders it dynamically):

```tsx
export default async function PicksPage({ searchParams }: { searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  const sp = await searchParams;
  const parsed = parseModelParam(sp.m);
  if (parsed.status === 'missing') redirect('/find');
  if (parsed.status === 'invalid') redirect('/find?notice=incomplete');
  const result = match(parsed.model, catalog);          // the only match() call in the app
  const views = toPickViews(result, catalog);
  …
}
```

`redirect()` throws by design, so it sits outside any `try/catch` (Next.js `redirect` docs). Because `redirect` returns `never`, TypeScript narrows `parsed` to `ok` after the two guards.

Page layout, top to bottom: a heading and the one-line summary (`describeModel(...).headline`); `DisclosureNote` when `result.disclosures` is non-empty (heading "How we widened the search", each sentence verbatim in a list); the cards (a grid, 1 column on mobile, 3 on wide screens); the `shortfallNote` and "Browse the full atelier" `AtelierButton` (secondary) when `result.showBrowseLink`; a "Change my answers" link to `modelHref('/find', model)`.

### `lib/picks-view.ts`

```ts
interface PickView {
  rank: 1 | 2 | 3;
  sku: string; name: string; category: string; price_inr: number; url: string;
  imageSrc: string;                 // `/catalog/${image_file}`
  rating: string | null;            // catalog string verbatim, or null
  reasons: string[];                // pick.reasons[].text, in order
  markerLabels: string[];           // plain words, REQ-CV-30
  relaxationNote?: string;
}
function toPickViews(result: MatchResult, catalog: ParsedCatalog): PickView[]
```

It maps `result.picks` one to one, in order. For each pick it finds the product by `sku` and throws `Error('pick … not in catalog')` if absent; throws if `availability !== 'In Stock'`; throws if `picks.length > 3` or the SKUs repeat. It copies `name`, `url`, `price_inr`, `rating`, and `category` from the product and never edits them. `MARKER_LABEL` is a fixed map: `budget-below` → "Just below your budget", `budget-above` → "Just above your budget", `symbol-broadened` → "A related symbol", `metal-dropped` → "A different metal", `category-dropped` → "A different kind of piece". The thrown errors are the loud failure of REQ-CV-23 and REQ-CV-25: they trip the Next.js error boundary rather than silently show something wrong.

### `PickCard`

```
┌───────────────────────────────┐   data-price-region
│ 1 of 3 · Pendant              │
│ [ProductPhoto  object-contain] │   no overlay
│ Name verbatim                  │
│ ₹14,249        Rated 4.9/5     │   rating only when non-null
│ PriceFootnote                  │
│ [Just below your budget]       │   one label per marker
│ relaxationNote (verbatim)      │
│ Why this one                   │
│  • Listed for kids 3–12 years  │   2–4 reasons, verbatim
│ [Buy on Tiny Tiaraa ↗]         │   url verbatim, new tab
└───────────────────────────────┘
```

The card is a `<article data-price-region>`. The buy control is `AtelierButton external href={url}`. The card has no link to `/piece/[sku]` in this milestone (REQ-CV-33); the detail spec adds it. The card never reads `catalog.json`: it receives a `PickView`.

## 6. `/atelier` route

`app/atelier/page.tsx` is a server component: it awaits `searchParams`, calls `parseBrowseFilters(sp)` for the initial filters, calls `toBrowseItems(catalog)`, and renders `<CatalogGrid items initialFilters />`. Only serialisable plain data crosses to the client component.

```ts
interface BrowseItem {
  sku: string; name: string; price_inr: number; url: string; imageSrc: string;
  category: Category; metal: Metal; price_band: PriceBand; age_groups: AgeGroup[];
  availability: 'In Stock' | 'Out of Stock'; rating: string | null;
}
interface BrowseFilters { age: AgeFilter; category: CategoryFilter; metal: MetalFilter; budget: BudgetFilter }
// each = 'all' | a value: age 'infants'|'kids'|'teens'|'mom'; category 'pendant'|'bracelet'|'earrings'|'set'|'tabeez';
//        metal 'gold'|'silver'; budget PriceBand
```

| Function | Behaviour |
|---|---|
| `toBrowseItems(catalog)` | One item per product; in-stock first, then out-of-stock, each in catalog order (a stable partition). Copies fields, derives nothing new. |
| `parseBrowseFilters(sp)` | Reads `age`, `category`, `metal`, `budget`; each unknown, repeated, or missing value becomes `'all'`. Never throws. |
| `filterItems(items, f)` | AND of: `age === 'all' \|\| age_groups.includes(AGE_LABEL[f.age])`; `category === 'all' \|\| category.toLowerCase() === f.category`; `metal === 'all' \|\| metal === f.metal`; `budget === 'all' \|\| price_band === f.budget`. Order preserved; the out-of-stock item is treated like any other. |
| `filtersToQuery(f)` | `URLSearchParams` string of the non-`all` filters, in the fixed order age, category, metal, budget. |

`CatalogGrid` (`'use client'`) keeps `filters` in `useState(initialFilters)`. On a chip tap it sets the state and calls `window.history.replaceState(null, '', filtersToQuery(next) ? '?' + … : window.location.pathname)`. Next.js integrates `history.replaceState` with its router (single-page-applications guide), and there is no `useSearchParams`, so no Suspense boundary is needed. The grid renders four `ChipGroup`s (each with an "All" chip), the result count ("Showing 21 pieces"), and the cards. It is one price region: a single `PriceFootnote` sits above the cards inside the `data-price-region` container (REQ-CV-39). Empty result: "No piece matches those filters." and a "Clear filters" button.

`BrowseCard` shows `ProductPhoto` (alt = name), the name, `formatInr(price_inr)`, "{category} · {METAL_LABEL[metal]}", the rating when non-null, and for in-stock items the external buy button. For `availability === 'Out of Stock'` it uses `bg-plum/5 text-plum/50` for the surface and text, shows a visible "Out of stock" text badge beside the name (not on the photo), and renders no buy control. The photo is untouched: no `opacity`, `grayscale`, or filter is applied to it, because REQ-CV-26 forbids altering how a photo looks. "Greyed" is carried by the card surface and text.

## 7. Next.js notes (read from `node_modules/next/dist/docs/` before writing this)

| Fact | Source file | Consequence |
|---|---|---|
| `searchParams` is a `Promise`; await it. Using it opts the page into dynamic rendering. It is a plain object, not `URLSearchParams`. | `01-app/03-api-reference/03-file-conventions/page.md` | `/find`, `/picks`, `/atelier` are `async` server components that `await searchParams`. Values can be `string \| string[] \| undefined`, so `parseModelParam` and `parseBrowseFilters` accept arrays. |
| `redirect()` throws `NEXT_REDIRECT`, works in Server Components, and must be called outside `try/catch`. | `04-functions/redirect.md` | The `/picks` guards sit at the top level of the component, outside any `try`. |
| `useSearchParams` in a statically prerendered route needs a `Suspense` boundary or the production build fails. | `04-functions/use-search-params.md` | Avoided: the client components take initial values as props and use `history.replaceState`. |
| `history.pushState` / `replaceState` integrate with the router, and an event handler can read `window.location` directly. | `02-guides/single-page-applications.md` | Filter URL mirroring (§6). |

The builder re-reads these files before writing the routes; this table records what the spec relied on, not a substitute for reading them (AGENTS.md).

## 8. Component inventory

| Component | Client? | Props | Reuses |
|---|---|---|---|
| `Conversation` | yes | `initialModel?`, `notice?`, `momNote` | `ChipGroup`, `ProgressMoon`, `RecipientCard`, `AtelierButton` |
| `ChipGroup` | yes | `label`, `options`, `selected`, `multi?`, `onToggle` | none |
| `ProgressMoon` | no | `current: 1..6` | none (crescent SVG as in `app/page.tsx`, `text-gold`) |
| `RecipientCard` | no | `view: CardView`, `href`, `onEdit`, `onBack` | `AtelierButton` |
| `PickCard` | no | `view: PickView` | `ProductPhoto`, `PriceFootnote`, `AtelierButton`, `formatInr` |
| `DisclosureNote` | no | `sentences: string[]` | none |
| `CatalogGrid` | yes | `items`, `initialFilters` | `ChipGroup`, `BrowseCard`, `PriceFootnote` |
| `BrowseCard` | no | `item: BrowseItem` | `ProductPhoto`, `AtelierButton`, `formatInr` |
| `ProductPhoto`, `PriceFootnote` | existing | unchanged | |
| `AtelierButton` | existing | gains optional `external?: boolean`; when true it passes `target="_blank"` and `rel="noopener noreferrer"` to the `Link`. `href` is passed through untouched. Existing callers are unaffected. | |

`formatInr` is imported from `lib/matching/templates.ts`, the shared helper that already exists. No component defines its own price formatting. All colours are tokens (REQ-CV-48).

## 9. Failure behaviour

| Situation | Behaviour |
|---|---|
| `/picks` without `m` | Redirect to `/find`. |
| `/picks` with invalid `m` | Redirect to `/find?notice=incomplete`; `/find` shows the one-line note. |
| `match()` returns 0, 1, or 2 picks | Cards for what exists, `shortfallNote`, browse link, "Change my answers". No filler. |
| A pick's SKU is not in the catalog, or a pick is out of stock | `toPickViews` throws; the error boundary shows. This is unreachable if `matching-core` holds, and the property tests prove it (C4, C5). |
| Browser Back from `/picks` | Returns to `/find`, which restarts at question 1 (client state is in memory). "Change my answers" is the supported way back to the card. |
| Reload on `/find` mid-flow | The in-memory answers are lost; the flow restarts. Accepted: no storage (REQ-CV-18). |
| Invalid filter parameter on `/atelier` | Treated as "All". |

## 10. Testing

### 10.1 A DOM environment without breaking the node tests

`vitest.config.ts` keeps `environment: "node"` and its `include` (which already globs `tests/**/*.test.tsx`). Component tests opt into jsdom per file with the Vitest docblock on the first line:

```tsx
// @vitest-environment jsdom
```

Vitest 5.1.1 still reads this docblock (the specification loader in `vitest/dist` calls `getSpecificationDocblock`). All existing `.test.ts` files stay in the node environment and are untouched. If the docblock ever stops working, the fallback is a `test.projects` entry in `vitest.config.ts` that sets `environment: 'jsdom'` for `tests/**/*.test.tsx` and `node` for the rest; that edit goes in the same wave as the dependency install.

Dependencies (Wave 2, devDependencies, versions pinned by `npm install`): `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`. `@testing-library/user-event` is not needed (use `fireEvent`). The task touches `package.json` and `package-lock.json` only for these three packages.

`tests/helpers/dom.ts` (imported by each `.tsx` test, not registered globally, so node tests never load it): `import '@testing-library/jest-dom/vitest'`, and `afterEach(cleanup)` from `@testing-library/react` because Vitest globals are off. Server components (`/picks`, `/atelier` pages) are not rendered directly in jsdom: tests render `PickCard`, `CatalogGrid`, and the `/picks` page body through the pure `toPickViews()` and the client components, and the dev-server curl checks (tasks Wave 3, 4) cover the routes.

### 10.2 Test files

| File | Environment | Covers |
|---|---|---|
| `tests/conversation.test.ts` | node | chip tables, reducer transitions, branching, `toModel`, `validateModel`, `stateFromModel`, `describeModel`, `momSkipNote` (REQ-CV-01 to 17) |
| `tests/conversation.property.test.ts` | node | P-CV-1 to P-CV-8 (seed fixed, `numRuns ≥ 200`; P-CV-4 ≥ 500) |
| `tests/model-param.test.ts` | node | encode, parse, invalid inputs, length cap, repeated `m` (REQ-CV-18 to 22) |
| `tests/picks-view.test.ts` | node | `toPickViews` over golden models and 500 generated models (P-CV-9) |
| `tests/browse.test.ts` | node | filters, parsing, partition, query string (P-CV-11, P-CV-12) |
| `tests/conversation.flow.test.tsx` | jsdom | the flow by taps, Back, Edit, adult end, Mom skip, card text (REQ-CV-01 to 17) |
| `tests/picks.ui.test.tsx` | jsdom | `PickCard` and the picks body: photo, name, price, footnote, reasons, markers, buy link, shortfall (REQ-CV-23 to 33; P-CV-10) |
| `tests/atelier.ui.test.tsx` | jsdom | `CatalogGrid`: 22 cards, filters, empty state, TNZ-1058 muted with no buy link (REQ-CV-34 to 39) |
| `tests/journey.golden.test.tsx` | jsdom | golden cases 1–3 and the 8 personas by taps → URL → `match()` → cards (REQ-CV-40, 41) |
| `tests/conversation.static.test.ts` | node | grep tests: no React/fs/fetch/Date/Math.random/LLM import in the four new `lib/` files; no `catalog.json` or `catalog-store` import in `components/`; no `#hex`/`rgb(`/`[#` in `components/` or `app/`; no `app/api/` directory; no `<img` of a logo (REQ-CV-43, 46, 47, 48) |

## 11. Correctness properties (fast-check + Vitest, seeded)

Generators: `arbAction` draws a valid action for the current state (a chip value from the question's table, `back`, `edit`, `toggle-symbol`, `continue`, `restart`); `arbAnswers` builds complete answer sets; `arbModel` (reused from `matching.property.test.ts` shape) builds valid models; `arbParam` mixes valid encoded models, mutated models (a key removed, a value swapped, an extra key, a wrong type), truncated strings, arrays, and `fc.anything()`.

| ID | Property | Requirement |
|---|---|---|
| P-CV-1 (C1) | For any action sequence that reaches `step === 'card'`, `toModel(answers)` is ok and `validateModel(model)` is ok. For every complete `Answers`, the same. | REQ-CV-52, REQ-CV-07 |
| P-CV-2 (C2) | For any action sequence, applying `back` leaves `answers` deep-equal to before; and `toModel(finalAnswers)` equals the model built by answering the same final values in order on a fresh state. After changing relationship between Mom and non-Mom, no stale `age`, `adultIsMom`, or `category` remains. | REQ-CV-53, REQ-CV-03, REQ-CV-13 |
| P-CV-3 | Step gating: `step === 'card'` ⇒ `toModel` ok; outside edit mode, `step` is at or before `firstUnanswered(answers)`; `adult-end` ⇔ `ended(answers)`; `reduce` is pure (input state deep-equals its pre-call clone). | REQ-CV-07, REQ-CV-46 |
| P-CV-4 (C3) | For any `arbParam`, `parseModelParam` never throws; `status === 'ok'` ⇒ `validateModel` ok and `match(model, catalog)` does not throw and returns ≤ 3 picks; any other status ⇒ no model. | REQ-CV-54, REQ-CV-19 |
| P-CV-5 (C8) | For every valid model, `parseModelParam(decode(encodeModelParam(m)))` deep-equals `m`, and the `modelHref` query decodes through `URLSearchParams` to the same string. | REQ-CV-59, REQ-CV-18 |
| P-CV-6 (C7) | For any answers, `symbols === 'religious'` in the model only if the answers hold `'religious'`; `symbolList` is present only with it; a model built without the user tapping "Religious" or "Any" has `symbols` of `zodiac`, `evil-eye`, or `none-religious`. | REQ-CV-58, REQ-CV-10 |
| P-CV-7 | Age chips: the five child intervals are contiguous and non-overlapping over `[0,19)`; each chip's `band` equals `ageYearsToBand(years)`; `chipForYears(years)` returns the chip for every `years` in `[0,19)`, and `chipForYears(chip.years) === chip.id`. | REQ-CV-05, REQ-MC-02 |
| P-CV-8 | Resume: for any valid model `m` with `ageYears` (or Mom), `toModel(stateFromModel(m).answers)` deep-equals `m` and `stateFromModel(m).step === 'card'`. | REQ-CV-22 |
| P-CV-9 (C4, C5) | For any valid model (numRuns ≥ 500, real catalog): `toPickViews(match(m, catalog), catalog)` has the same SKUs, order, and count as `match().picks`; every view's SKU is in the catalog and In Stock; `name`, `url`, `price_inr`, `rating` equal the catalog's; `reasons` equal `pick.reasons.map(r => r.text)`; the views never exceed 3. | REQ-CV-55, REQ-CV-56, REQ-CV-23, REQ-CV-25 |
| P-CV-10 (C6) | Rendering `PickCard` for every in-stock product, and `CatalogGrid` for all 22: every DOM text node containing `₹` has an ancestor `[data-price-region]` whose text contains the exact footnote; no rendered text matches `/% off|save ₹|MRP|was ₹/i`; no `<del>` or `line-through` class. | REQ-CV-57, REQ-CV-27, REQ-CV-28 |
| P-CV-11 | Browse: `filterItems` returns a sub-list of the input in the same relative order; equals the input when all filters are `all`; equals the AND of the four predicates; adding a filter never grows the result; `toBrowseItems` has 22 items with the 21 in-stock first. The out-of-stock item never has a buy link in the rendered grid, for any filter combination. | REQ-CV-34, 35, 38, REQ-CV-56 |
| P-CV-12 | `parseBrowseFilters` never throws for any `{[k]: string \| string[] \| undefined}`; an unknown value yields `'all'`; `filtersToQuery` then `parseBrowseFilters` round-trips any valid filters. | REQ-CV-36 |
| P-CV-13 (C9) | Determinism: the same answers give the same model, the same `m`, and the same `describeModel` output; `toPickViews` twice gives deep-equal output. | REQ-CV-60 |

A counterexample from any property is logged in `docs/kiro-evidence-log.md` with its fix, as for matching.

## 12. Scripted personas (QA cases; also `tests/journey.golden.test.tsx`)

Each persona is tapped through the UI. Unstated answers use the "no preference" chip. Expected picks are the values pinned in `tests/matching.personas.test.ts`; this spec does not change them.

| # | Persona | Taps | Expected |
|---|---|---|---|
| 1 | Aunt, 6-month niece | Niece or nephew · 0–1 · Naming ceremony · Under ₹2,500 · 925 silver · Any · Surprise me | **Golden 1:** TBZ-1013, TNZ-1056, TBZ-1017, all 6; no disclosure |
| 2 | Grandmother, 5-year grandson | Grandchild · 3–6 · Birthday · ₹15,000–₹25,000 · 18KT gold · Any · Surprise me | TPN-1147 (6), TPN-1149 (6), TPN-1206 (4); no disclosure. *Open Q-M1: PRD names Trishul, which is ₹14,399, below the band.* |
| 3 | Friend, newborn | A friend's baby · 0–1 · Baby shower · Under ₹2,500 · No preference · Any · Surprise me | TNZ-1056 (4), TOB-1008 (4), TBZ-1013 (1). TNZ-1058 never appears. *Open Q-M2: "Any" admits a religious tabeez.* |
| 4 | Uncle, 14-year nephew | Niece or nephew · 12–19 · Festival · ₹15,000–₹25,000 · 18KT gold · Religious + Ganesha · Surprise me | **Golden 3:** TPN-1141 (9), TPN-1147 (7), TPN-1143 (7); 2 disclosures; TPN-1141 relaxation sentence |
| 5 | Daughter, Mom | Mom · Birthday · ₹25,000+ · 18KT gold · Any (no age, no piece question) | **Golden 2:** THP-1001 (7), THP-1017 (6); "Only 2 pieces in the atelier are listed for Mom"; browse link; Mom note shown on the card |
| 6 | Parent, 8-year daughter | My own child · 6–12 · First birthday · ₹25,000+ · No preference · Any · Set | TPN-1199 (4), TPN-1206 (4, `budget-below`), TOB-1009 (3, `category-dropped`); 2 disclosures. *Open Q-M3: a bangle fills the third slot.* |
| 7 | Godparent, 2-year-old | Godchild · 1–3 · Rakhi · ₹2,500–₹15,000 · 925 silver · Evil eye / nazariya · Surprise me | TNZ-1056 (9, `budget-below`) only; note "Only 1 piece fits this recipient even after widening — browse the full atelier."; no religious piece |
| 8 | Buyer, 10-year-old | Someone else · 6–12 · Just because · No limit · No preference · No religious symbols · Surprise me | TPN-1199, TPN-1206, THP-1001 (1, 1, 1); no religious piece. *Open Q-M4: thin result.* |

Plus three flow cases: (9) Someone else · An adult · No → the honest message and browse link, no `/picks` reachable; (10) An adult · Yes, Mom → continues as Mom; (11) Religious tapped, then "Zodiac" tapped → sub-chips disappear and `symbolList` is cleared.

## 13. Open questions (not resolved by this spec; builder's call)

| ID | Question | Spec's working assumption |
|---|---|---|
| Q-M1 to Q-M4 | The four matching questions in `docs/kiro-evidence-log.md` (session 2b: personas 2, 3, 6, 8). | Unresolved. The UI shows what `match()` returns. No matching change here. |
| Q1 | PRD §4 calls question 5 "multi-select", but `RecipientModel.symbols` holds one value (zodiac and evil eye cannot both be chosen). | Top-level chips are single-select; only the religious sub-chips are multi-select. |
| Q2 | PRD lists "No religious symbols" among the sub-chips of "Religious". | Placed as a top-level chip, so a user does not tap "Religious" to say "none". Sub-chips still appear only for "Religious". |
| Q3 | PRD age chips stop at 12–19, but PRD §3 needs an adult path. | An extra "An adult" chip reaches the "Is this for Mom?" step. |
| Q4 | `ageYears` is optional in the model and the chips give only ranges. | `ageYears` = chip lower bound, used only to restore the chip; never shown as a real age. |
| Q5 | The PRD sample card says "6-month-old niece"; chips cannot say that. | The card says "0–1 years". |
| Q6 | `lib/catalog.ts` has no loader and `structure.md` lists no `catalog-store.ts`. | New `lib/catalog-store.ts`, server pages only; `structure.md` is updated when it is built. |
| Q7 | `/piece/[sku]` does not exist in M2. | Pick cards link to the buy URL only; the detail link arrives with `gift-presentation`/`safety-verdict`. |
| Q8 | The PRD says "greyed" for the out-of-stock item but forbids altering a photo's look. | The card surface and text are muted; the photo is unfiltered. |
| Q9 | The age question's prompt is not in PRD §4. | "How old is the little one?" |
| Q10 | The PRD journey has no "resume at the card" or "Change my answers". | Added via `/find?m=…` so a user can edit after seeing picks; it uses the same `m` transport. |
