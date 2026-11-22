# Polish and Deploy (Milestone 4) — Design

*Implements REQ-PD-01 to REQ-PD-63 (`requirements.md`). Source: PRD §1, §10, §11; architecture §7 (design system, testing strategy), §8 (`polish-deploy` row), §9 (rows Sat 28 Nov to Mon 30 Nov); steering `product.md`, `tech.md`, `structure.md`, `catalog-rules.md`. Inherits, and does not re-decide, the pinned rules of `conversation`, `safety-verdict`, `true-size-viewer`, and `gift-presentation`. Nothing in `lib/matching*`, `lib/catalog.ts`, `lib/safety*.ts`, `lib/true-size.ts`, `lib/size-spec.ts`, `lib/conversation.ts`, `lib/gift-message.ts`, `lib/piece-view.ts`, `data/`, or `public/catalog/` changes. One new pure file, `lib/page-meta.ts`.*

## 1. Overview

```
Layer 1  app/globals.css      tokens (6 colours + non-colour tokens), :focus-visible, reduced-motion rule
Layer 2  components/          SiteHeader, SkipLink, ActionButton (new)  ·  AtelierButton (+describedBy)
Layer 3  components/ + app/   per-screen polish and a11y fixes (landing, /find, /picks, /piece, /atelier, not-found)
Layer 4  lib/page-meta.ts     pieceTitle(), pieceDescription() (pure)  →  generateMetadata / metadata exports
Layer 5  tests/               axe + role/query + contrast + class-static + copy-lock + title tests
Layer 6  docs/                polish-m4.md (manual checklist), polish-m4-audit.md (qa-auditor), evidence log
```

The pass works from the top down so each layer can be checked before the next one leans on it. Layer 1 fixes whole classes of problems (focus, motion) with no class churn, which keeps the class-string assertions in earlier tests valid. Layer 2 removes duplication (six headers, eight button strings). Layer 3 touches each screen once. Layers 4 and 5 lock the result in.

### Ownership (REQ-PD-50)

| Owner | Writes |
|---|---|
| `design-polish` agent | `components/**`, `app/**` (including `app/globals.css`) |
| Builder session or `gift-curator` | `lib/page-meta.ts`, `tests/**`, `docs/**`, `package.json`, `package-lock.json`, `.kiro/steering/structure.md` (if approved) |
| `qa-auditor` agent | `docs/qa-reports/polish-m4-audit.md`, read-only on code |

A task that pairs a component edit with a test edit (§7.5) is two sub-steps for two owners in the same wave.

### File map

| File | Contents | Pure? |
|---|---|---|
| `app/globals.css` | adds non-colour tokens, global `:focus-visible`, global reduced-motion rule, `.mote` hide rule | tokens file |
| `app/layout.tsx` | `metadata.title` template, `SkipLink` first in `<body>` | route |
| `components/SiteHeader.tsx` | wordmark, labelled `nav`, the "Opens in a new tab" hint element | UI (server) |
| `components/SkipLink.tsx` | "Skip to main content" | UI (server) |
| `components/ActionButton.tsx` | `<button>` primitive: `primary`, `secondary`, `quiet`; sizes `md`, `lg` | UI |
| `components/AtelierButton.tsx` | gains optional `describedBy`; secondary border `border-plum/60`; primary string unchanged | UI |
| `components/CobwebCorner.tsx` | optional, landing hero only | UI |
| `lib/page-meta.ts` | `pieceTitle`, `pieceDescription`, `ROUTE_TITLES` | yes |
| `tests/helpers/axe.ts`, `contrast.ts`, `targets.ts`, `outline.ts` | test helpers | test |
| `tests/a11y.*.test.ts(x)`, `tests/polish.copy.test.tsx`, `tests/page-meta*.test.ts` | the suite (§7) | test |
| `docs/qa-reports/polish-m4.md`, `polish-m4-audit.md` | manual checklist, audit | docs |

## 2. What the code review found

Counts are from a grep of `app/` and `components/` at HEAD 5472e92. Each row maps to a requirement.

| Finding | Where | Measured or counted | Requirement |
|---|---|---|---|
| Muted text below AA | `text-plum/60` ×8: landing trust strip, detail photo caption, `PriceFootnote`, `RecipientCard` labels, `SafetyVerdict` ("General guidance", "Source:", eyebrow), `GiftWrap` privacy line | 3.46 to 3.69:1 | REQ-PD-02, 25 |
| Muted text borderline | `text-plum/70` ×4 (`ProgressMoon`, `SizeOutlines` ×2, landing) | 4.50 on `sage` (no margin) | REQ-PD-02 (floor 75) |
| Out-of-stock text far below AA | `text-plum/50` ×1, `BrowseCard` | 2.77:1 | REQ-PD-13, 25 |
| Gold used as text | `text-gold` ×7: landing eyebrow and numerals "1 2 3", `PickCard` eyebrow, two moon SVGs | 1.92 to 2.26:1 | REQ-PD-02 |
| Control borders too faint | `border-plum/30` ×12 | 1.76:1 | REQ-PD-06, 26 |
| Mote animation not covered by reduced motion | `.mote` (9 s infinite) has no media rule; only the wrap classes do | n/a | REQ-PD-27 |
| Six copies of the header, small link targets | landing, `/find`, `/picks`, `/piece`, not-found, `/atelier`: `text-sm` links with no min height (about 20 px) | n/a | REQ-PD-05, 28 |
| Eight hand-copied button class strings | `GiftWrap` ×2, `TrueSizeViewer` ×2, `CalibrationSlider` ×2, `SizeRuler`, `Conversation`; plus Back, Edit, Clear filters | n/a | REQ-PD-06 |
| Standalone text links without a min height | "Back to your picks" and "Back to the atelier" (detail), "Change my answers" (`/picks`) | n/a | REQ-PD-28 |
| No skip link; `main` has no id | every route | n/a | REQ-PD-05, 18 |
| No focus-visible rule | the UA default outline only | n/a | REQ-PD-19 |
| Focus lost when a focused control unmounts | "Wrap this gift" → wrapping; "Calibrate with a card" → slider; "Reset calibration"; "Clear filters" | n/a | REQ-PD-23 |
| Status regions mounted with their text | `GiftWrap` wrapping and revealed lines; viewer mode line has no region | n/a | REQ-PD-22 |
| Range input height is the native one | `CalibrationSlider` input has no height | thumb about 16 to 20 px | REQ-PD-28, 30 |
| Slider value only as a bare number | `input[type=range]` with no `aria-valuetext` | n/a | REQ-PD-30 |
| Repeated links with no context | "See details" ×22, "Buy on Tiny Tiaraa ↗" ×21 | n/a | REQ-PD-20 |
| External links give no new-tab cue | every `external` `AtelierButton` | n/a | REQ-PD-20 |
| Drawing label repeats its caption | `SizeOutlines` `role="img"` plus `figcaption` with the same text | n/a | REQ-PD-29 |
| `PieceFacts` has no heading | detail page | n/a | REQ-PD-12 |
| One `<title>` for every route | `app/layout.tsx` only | n/a | REQ-PD-33 to 36 |
| Five arbitrary letter-spacing values | `tracking-[0.15em]`, `[0.2em]` ×4, `[0.25em]` | n/a | REQ-PD-03 |

Already correct and pinned, not changed: `alt={name}` on every photo; `aria-pressed` on chips; heading focus on step change; one `h1` per screen and no skipped levels; `aria-live` count on `/atelier`; `aria-hidden` on the ruler, the progress bars, and the motes; `min-h-11` chips; native `button`/`a`/`input`/`textarea` everywhere (no clickable `div`); no positive `tabIndex`; no `order-*` or reverse classes; `tabIndex={-1}` only on headings; `outline-none` only on those headings.

## 3. Contrast numbers (computed from the token values, WCAG relative luminance, alpha composited over the surface)

Tokens: pearl `#FAF7F2`, blush `#F7E8E4`, champagne `#F5EDD8`, sage `#DCE8DD`, gold `#C9A227`, plum `#3D2C3A`. Surfaces: the five tokens, plus `blush/50`, `blush/60`, `champagne/40`, `sage/60`, `plum/5` composited over pearl. Ratios are text-over-surface; the table gives the worst surface and the best.

| Text role | Worst surface | Worst ratio | Best ratio | Verdict |
|---|---|---|---|---|
| `text-plum` | `sage` | 10.27 | 12.13 (`pearl`) | pass |
| `text-plum/90` | `sage` | 7.84 | 8.99 | pass |
| `text-plum/85` | `sage` | 6.81 | 7.70 | pass |
| `text-plum/80` | `sage` | 5.92 | 6.60 | pass |
| **`text-plum/75` (policy floor)** | `sage` | **5.15** | 5.67 | pass |
| `text-plum/70` | `sage` | 4.50 | 4.89 | borderline, no margin |
| `text-plum/65` | `sage` | 3.94 | 4.23 | fail |
| `text-plum/60` | `sage` | 3.46 | 3.69 | fail (normal text) |
| `text-plum/50` | `sage` | 2.71 | 2.84 | fail |
| `text-gold` | `sage` | 1.92 | 2.26 (`pearl`) | fail, even for large text |
| `text-pearl` on `bg-plum` | n/a | 12.13 | | pass |
| `text-pearl` on `bg-plum/85` | n/a | 7.70 | | pass |
| `text-plum` on `bg-gold` | n/a | 5.36 | | pass (not used today) |

Control boundaries (`border-plum/N` against the surface behind it): `/15` 1.31, `/30` 1.76, `/40` 2.2, `/50` 2.7 to 2.8, **`/60` 3.46 to 3.69 (policy floor)**, `/70` 4.5 to 4.9. The focus outline (`plum`, solid) is 10.27:1 or better against every surface. Pearl against blush is 1.12:1: a pearl photo panel on a blush card is a decorative step, not information, so it needs no contrast.

The numbers come from a throwaway script during this spec. The suite recomputes them (`tests/a11y.contrast.test.ts`, §7.4) so a token edit that breaks a role fails a test, and these tables are the expected values the test pins with a 0.01 tolerance.

## 4. Design system layer

### 4.1 `app/globals.css` additions (appended; the wrap rules and the `.mote` rule are not edited)

```css
@theme {
  /* colours and fonts unchanged */
  --tracking-eyebrow: 0.2em;                       /* one value for every uppercase eyebrow */
  --shadow-card:
    0 1px 2px color-mix(in srgb, var(--color-plum) 8%, transparent),
    0 10px 28px -14px color-mix(in srgb, var(--color-plum) 22%, transparent);
  --focus-ring-width: 2px;
  --focus-ring-offset: 2px;
}

@layer base {
  :focus-visible {
    outline: var(--focus-ring-width) solid var(--color-plum);
    outline-offset: var(--focus-ring-offset);
  }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
    scroll-behavior: auto !important;
  }
  .mote { display: none; }
}
```

Why a universal rule. The existing block lists four wrap classes. A list needs an edit whenever a class or a `transition-colors` utility is added, and `transition-colors` is already on 12 controls and was never covered. The universal rule covers every present and future animation and transition with no per-class edit (REQ-PD-27). `animation: none` is safe for the wrap: `wrap-card-in` uses `both`, so without the animation the card simply sits at its final state, and the reduced-motion click handler already skips the wrapping phase. The `.mote` rule hides the motes: with `animation: none` they would otherwise freeze as five visible gold dots. The shadow uses `color-mix` over `var(--color-plum)`, so no new colour literal enters the file, and the conversation static test, which scans `.ts` and `.tsx` only, is unaffected. The builder checks Tailwind v4's theme namespaces (`--tracking-*` makes `tracking-eyebrow`, `--shadow-*` makes `shadow-card`) in `node_modules/tailwindcss` docs or by a build before relying on the names.

An outline, not a box-shadow ring, draws the focus indicator because outlines survive Windows forced-colors mode. With `outline-offset: 2px` the plum outline always sits on the page surface around the control, so it keeps contrast even on a plum-filled button.

### 4.2 Type, spacing, shape (REQ-PD-03, 04)

| Role | Classes |
|---|---|
| Wordmark | `font-display text-2xl font-semibold tracking-wide` |
| Page `h1` | `font-display text-3xl font-semibold leading-tight sm:text-4xl` |
| Landing hero `h1` | `font-display text-4xl font-semibold leading-tight sm:text-6xl` |
| Section `h2` | `font-display text-2xl font-semibold`; in cards `text-xl` |
| Body | `text-base leading-relaxed` |
| Secondary | `text-sm leading-relaxed text-plum/80` or darker |
| Eyebrow | `text-xs font-semibold uppercase tracking-eyebrow text-plum/80`; gold decorative rule above or beside it, never gold text |
| Footnote | `text-sm leading-relaxed text-plum/75` (never `text-xs`) |
| Container | `mx-auto w-full max-w-6xl px-6 sm:px-10` |
| Rhythm | `gap-6` between sections, `py-8` page padding, `py-14` landing bands, `gap-3` inside cards |
| Radii | panels and inputs `rounded-2xl`; product cards `rounded-3xl`; buttons, chips, badges `rounded-full` |

The `h1` of `/find` and of `RecipientCard` already use this size; the other pages move to it.

### 4.3 Components

**`SiteHeader`** (server component). Props `{ links: readonly { href: string; label: string; hideBelowSm?: boolean }[] }`.

```tsx
<header className="flex items-center justify-between px-6 py-3 sm:px-10 print:hidden">
  <Link href="/" className="inline-flex min-h-11 items-center font-display text-2xl font-semibold tracking-wide">Tiny Tiaraa</Link>
  <nav aria-label="Primary" className="flex items-center gap-2 text-sm">
    {links.map(l => <Link key={l.href} href={l.href} className={`inline-flex min-h-11 items-center px-3 hover:underline ${l.hideBelowSm ? "hidden sm:inline-flex" : ""}`}>{l.label}</Link>)}
  </nav>
  <span id="new-tab-hint" className="sr-only">Opens in a new tab</span>
</header>
```

Each screen passes today's links and nothing else: landing `[How it works (#how, hideBelowSm), Browse the atelier (/atelier)]`; `/find`, `/picks`, `/piece`, not-found `[Browse the atelier (/atelier)]`; `/atelier` `[← Back to the atelier (/)]`. The piece not-found page and `/piece` keep `print:hidden`. The `new-tab-hint` span lives here so it exists once per screen.

**`SkipLink`**: `<a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:inline-flex focus:h-11 focus:items-center focus:rounded-full focus:bg-plum focus:px-6 focus:text-pearl">Skip to main content</a>`, first child of `<body>` in `app/layout.tsx`, outside the `Suspense`. Every `<main>` gets `id="main-content" tabIndex={-1} className="… outline-none"`.

**`ActionButton`**: `ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "quiet"; size?: "md" | "lg" }`, `type="button"` default.

| Variant | Classes |
|---|---|
| base | `inline-flex items-center justify-center rounded-full font-medium transition-colors` |
| `primary` | `bg-plum text-pearl hover:bg-plum/85` |
| `secondary` | `border border-plum/60 text-plum hover:bg-champagne` (hover surface differs from blush cards) |
| `quiet` | `min-h-11 min-w-11 px-4 text-plum hover:underline` |
| size `md` | `h-11 px-6 text-sm` (quiet ignores size) |
| size `lg` | `h-12 px-8 text-base` |

**`AtelierButton`**: primary keeps `flex h-12 items-center justify-center rounded-full px-8 text-base font-medium transition-colors bg-plum text-pearl hover:bg-plum/85` byte for byte (`tests/picks.ui.test.tsx` line 44). Secondary becomes `border border-plum/60 text-plum hover:bg-blush` (only the border changes; hover surface left alone because every secondary link sits on `pearl` or `blush/50`, and `hover:bg-blush` is still a visible step on pearl; on blush cards the hover is subtle, which the visual review may tune). New optional prop `describedBy?: string` renders `aria-describedby` as `describedBy`, plus ` new-tab-hint` when `external`.

**Repeated links.** `PickCard` gives its `h2` `id={`pick-${sku}-name`}` and passes `describedBy` to "See details" and the buy link; `BrowseCard` does the same with `browse-${sku}-name`. Visible text is unchanged and so is the accessible name (existing queries use `name: /Buy on Tiny Tiaraa/`), and the description adds the product name. `aria-label` was rejected: it would replace the name and could break the label-in-name rule (Q-PD4).

**`CobwebCorner`** (optional, REQ-PD-14): one inline SVG of a quarter web (three arcs and four spokes) in a 96-px box, `aria-hidden`, `pointer-events-none`, `stroke-plum`, `opacity-20`, `absolute` at the hero's top-left and top-right (mirrored with `-scale-x-100`). It sits behind the hero text in z-order and inside the hero's padding; it is not animated, so the reduced-motion rule has nothing to do. If the builder declines it (Q-PD9), the task is dropped and the spec is otherwise unchanged.

### 4.4 Per-screen polish punch list

The classes are for the `design-polish` agent to choose within §4.2; the list says what each screen must show and fix.

| Screen | Fixes and decisions |
|---|---|
| Landing | `SiteHeader`; eyebrow and numerals to plum with a gold decorative rule; moon `fill-gold`; steps as `<ol>` with the numeral inside the `li`; trust-strip text to `text-plum/80`; footer footnote `text-sm`; CTA buttons keep `h-12`; `border-plum/60` on the secondary CTA; hero spacing `pt-12 pb-16 sm:pt-20`; optional cobwebs. |
| `/find` | One `rounded-3xl bg-blush/50 p-6 sm:p-10` panel around `ProgressMoon`, the heading, the chips, and Back; sub-chip panel stays `bg-champagne`; "Continue" is an `ActionButton primary lg`; Back is `ActionButton quiet` (a `Link` styled the same on question 1, `min-h-11`); `RecipientCard` labels `text-plum/80`, "Edit" is `ActionButton secondary md` (keeps `aria-label="Edit {label}"`); progress moon `fill-gold`, text `text-plum/80`. |
| `/picks` | Cards `shadow-card`; eyebrow plum with gold rule; footnote `text-sm`; "Change my answers" as a `min-h-11` link; heading block uses the `h1` scale. |
| `/piece/[sku]` | `SiteHeader`; back link `min-h-11 inline-flex items-center`; caption `text-sm text-plum/75`; `PieceFacts` gets `<h2 className="sr-only">Catalog facts</h2>`; verdict, viewer, and wrap cards share `rounded-2xl p-6`; viewer buttons become `ActionButton`; the wrap box stays decorative; `SafetyVerdict` muted spans to `text-plum/75`; out-of-stock note on `plum/5` with `text-plum`. |
| `/atelier` | `SiteHeader`; out-of-stock card `bg-plum/5 text-plum/75`; filter groups spaced the same as `/find` chips; count line `text-plum/80`; "Clear filters" is `ActionButton secondary`; cards `shadow-card`. |
| Piece not-found | `SiteHeader`; same container and `h1` scale. |

The out-of-stock card keeps `data-sku`, the "Out of stock" text badge beside the name, no buy control, and a photo with no `opacity`, `filter`, or `grayscale` anywhere up to the card (REQ-CV-38). Muting is carried by the surface and the badge, so the product name and price stay readable.

## 5. Accessibility design

### 5.1 Keyboard and focus

All controls are native elements today, so the work is the focus indicator (§4.1), the skip link, and focus hand-offs when a focused control unmounts.

| Event | Focus moves to | Implementation note |
|---|---|---|
| Conversation step change, edit, return to the card | the new `[data-step-heading]` | exists (`Conversation` effect on `step`); keep |
| "Wrap this gift" activated, motion allowed | "Skip" | effect on `phase === "wrapping"` focuses a ref on Skip |
| Wrap reaches `revealed` (timer, Skip, or reduced motion) | the card `h3` | exists; keep |
| "Calibrate with a card" activated | the slider | `CalibrationSlider` focuses its input on mount |
| "This matches", "Cancel", "Reset calibration" | the button then shown in the status area | `TrueSizeViewer` keeps a ref per button and focuses the one that renders next, in an effect keyed on `calibrating` and `mode` |
| "Clear filters" | the first filter chip | `CatalogGrid` ref on the first chip |

Each hand-off runs in an effect or event handler that does not call `setState` in its body, which the React lint rules require (`useSyncExternalStore` and the timer callback patterns of M3 already follow this). The tests in `tests/a11y.keyboard.test.tsx` assert `document.activeElement` after each event.

Slider keyboard: a native range moves 1 px per arrow press over a range of 685 (171 to 856). Chromium and Firefox implement PageUp and PageDown as larger steps and Home and End as the ends; the spec does not rely on that. The manual pass tests the slider with the keyboard only. IF that pass shows the range cannot be matched in a reasonable number of presses, THEN add two `ActionButton quiet` controls "Smaller" and "Larger" that change the value by 10 px (no new copy beyond those two words), and record it (Q-PD8). The task for it is conditional.

### 5.2 Names, descriptions, states

| Element | Name | Description / state |
|---|---|---|
| Chip | its label | `aria-pressed` |
| Chip group | `aria-label` (the prompt, or "Age", "Category", "Metal", "Budget") | `role="group"` |
| "Edit" | `aria-label="Edit {label}"` (contains "Edit") | none |
| "See details", buy link | visible text | `aria-describedby="{card heading id}"`; buy link adds `new-tab-hint` |
| Slider | "Card outline width" | `aria-describedby="cal-help"`, `aria-valuetext="Outline {n} pixels wide"` |
| Textarea | visible label "Gift message — a draft you can edit" | none |
| Drawings with a caption | `aria-hidden="true"` (the `figcaption` is the name) | n/a |
| Ruler, progress bars, motes, gift box, moon | `aria-hidden="true"` | text equivalents exist |
| Region cards (fit check, size viewer, gift) | `aria-labelledby` the heading | unchanged |

The drawings change is the one place this spec touches `tests/true-size.ui.test.tsx` assertions that read `role="img"` and `aria-label` (lines 283 to 293, 350). Those tests assert the label text; if the drawing becomes `aria-hidden`, the assertions move from `getByRole("img")` to the `data-testid` element's attribute, and the label string is preserved on the element (`aria-label` stays; `aria-hidden` is added). Whether to do it at all is Q-PD7: a screen reader reading "ring outline… 5.25 in around" twice is a nuisance, not a failure, and `role="img"` with a label is what REQ-TS-19 specified. The default is to make the change; the builder may veto it.

### 5.3 Live regions (REQ-PD-22)

```tsx
// GiftWrap: always mounted, text swapped
<div role="status" className="text-sm font-medium" data-testid="wrap-status">
  {phase === "wrapping" ? "Wrapping your gift…" : phase === "revealed" ? "Your gift is wrapped" : ""}
</div>

// TrueSizeViewer: the mode line sits in one persistent region
<div role="status" data-testid="size-status"> …stale note / "Calibrated to your screen" / the approximate label… </div>
```

A region inserted together with its text is often not announced, which is why the two M3 lines that mount with their text (wrapping, revealed) move into a container that is present from the first render. The strings are the pinned ones, so no copy changes. The `GiftWrap` copy status (`role="status"`, empty until `copy` changes) is already the right pattern. The `/atelier` count already is.

Two live announcements at `revealed` (the status text, and focus moving to the card heading) are both pinned by REQ-GP-17. They are different channels (a polite status and a focus event) and the status text is short, so the spec leaves both. If the manual screen-reader pass finds the double speech annoying, the choice is to drop the status line at `revealed` only; that would be a REQ-GP-17 change and is Q-PD6.

The viewer's `role="status"` wraps text that includes the REQ-TS-11 label. The "true size" count rule is about the text content of the viewer, which does not change; `aria-valuetext` and the hint are outside it or contain no such words.

### 5.4 Headings, landmarks, order

Outline per screen (already true, now enforced):

| Screen | Outline |
|---|---|
| `/` | h1 hero; h2 ×3 (steps) |
| `/find` | h1 (question, adult-end message, or card headline) |
| `/picks` | h1 "Your picks"; h2 "How we widened the search" when present; h2 per pick; h3 "Why this one" per pick |
| `/piece/[sku]` | h1 name; h2 "Catalog facts" (sr-only); h2 verdict ("Good fit" or "Check this"); h2 "Size on your screen"; h2 "Gift this piece" (or none for out of stock); h3 gift-card heading |
| `/atelier` | h1 "The atelier"; h2 per card |
| not-found | h1 |

The verdict `h2` text is only "Good fit" or "Check this", pinned by `safety-verdict` and by `tests/safety.ui.test.tsx` (`aria-labelledby` equals that heading's id). The section's accessible name is therefore the verdict alone. Giving it a fuller name ("Fit check: Good fit") would change that pinned attribute. Left as is (Q-PD5).

Landmarks per screen: `banner` (SiteHeader), `navigation` ("Primary"), `main` (`#main-content`), and `contentinfo` on the landing page. The skip link sits before the banner. The detail page's two-column grid keeps DOM order equal to visual order (left column first, then right; stacked on narrow screens in the same order).

### 5.5 Targets (REQ-PD-28)

Target rule used by the test helper: a control passes when its class list has a height class `h-N` or `min-h-N` with `N ≥ 11` (Tailwind's spacing step 11 is 2.75 rem = 44 px), and a width class `min-w-N` with `N ≥ 11` or horizontal padding `px-N` with `N ≥ 4` (16 px each side around a label). The rule is deliberately a guard on author intent, because jsdom does not load Tailwind and has no layout: `getComputedStyle` cannot see the class effects. The manual pass checks the same on a phone. The range input passes by `h-11` on the input itself.

### 5.6 Motion inventory (REQ-PD-27)

| Motion | Where | Covered by |
|---|---|---|
| `mote-drift` (infinite) | `.mote` on the landing | global rule + `.mote { display: none }` |
| `wrap-ribbon`, `wrap-lid`, `wrap-box-out`, `wrap-card-in` | `GiftWrap` | existing wrap block + global rule; JS timer skips under `matchMedia` |
| `transition-colors` | 12 controls (buttons, chips, links) | global rule |
| smooth scroll | none today (`#how` anchor jumps) | `scroll-behavior: auto` in the rule |
| JS-driven motion | none | static test bans `requestAnimationFrame`, `.animate(`, smooth `scrollIntoView` |

## 6. Page titles (`lib/page-meta.ts`)

```ts
import type { Product } from "./catalog";
import { AGE_GROUP_LABEL, METAL_LABEL } from "./matching/templates";   // existing maps

export const SITE_TITLE = "Haunted Gift Atelier — Tiny Tiaraa";
export const TITLE_TEMPLATE = "%s | Haunted Gift Atelier";
export const ROUTE_TITLES = { find: "Find a gift", picks: "Your picks", atelier: "The atelier", pieceNotFound: "Piece not found" } as const;

export function pieceTitle(product: Pick<Product, "name" | "availability">): string;
export function pieceDescription(product: Pick<Product, "name" | "category" | "materials" | "age_groups">): string;
```

`pieceTitle` returns `name` (in stock) or `${name} (out of stock)`. `pieceDescription` returns `${name}: ${category}, ${metal label}, listed for ${age labels joined ", "}. See the fit check, a size view you calibrate, and a gift wrap.` The metal label and age labels come from the existing maps; where the existing helpers want a parsed `Product` (with `metal`), the function takes the parsed product type the page already holds. `generateMetadata`:

```tsx
export async function generateMetadata({ params }: { params: Promise<{ sku: string }> }): Promise<Metadata> {
  const { sku } = await params;
  const p = catalog.products.find((x) => x.sku === sku);
  return p ? { title: pieceTitle(p), description: pieceDescription(p) } : { title: ROUTE_TITLES.pieceNotFound };
}
```

Decisions:

| Decision | Alternatives | Why |
|---|---|---|
| Title is the name only (plus "(out of stock)") | name + price band (the brief's example); name + category + metal | A price or a band in a title is a price display with no footnote room, which `product.md` forbids ("every price carries the footnote"). The catalog name already names the category and, for gold pieces, the metal ("Gold with Diamond Om Pendant"), so a suffix repeats it. The metal and the age groups go in the description, where they add information. |
| Out of stock in the title | none | A tab or a history entry of an unavailable piece should say so; it uses the catalog's `availability`, not a SKU. |
| Template in the root layout | per-page `absolute` titles | One suffix, one place. The landing keeps the default string, so it is not suffixed twice. |
| Names verbatim, trailing full stop kept | trim | "Swastik - Tabeez for Lucky Charms. | Haunted Gift Atelier" reads oddly but is the catalog's value; catalog rule 5 forbids editing names. |
| Unknown SKU title "Piece not found" | 404 title | The route answers 200 in dev and 404 in production with the not-found UI (Q15; production 404 CONFIRMED on the deployed URL 22 Nov 2026, curl-verified); the title matches what the user sees. No other metadata, so a hand-typed URL gets no description. |

Cache Components: `generateMetadata` awaits `params`, which is runtime data, but the route has `generateStaticParams` returning the 22 SKUs, so the same prerender path that already builds the page covers it (the page awaits `params` too). The builder confirms with `npm run build` (the M3 build passed with the page awaiting `params`). If the build raises the "runtime data in `generateMetadata`" error, the documented fixes (`use cache`, or the dynamic-marker component) apply; read `generate-metadata.md` "With Cache Components" first. A title for a page that Next renders in the same pass needs no further change.

Next.js's route announcer reads `document.title` (then the `h1`) after a client navigation, so distinct titles are also the picks-reveal announcement of REQ-PD-22.

## 7. Test design

### 7.1 Tooling decision (REQ-PD-37)

| Option | Verdict |
|---|---|
| **`axe-core` called directly** | **Chosen.** Already in `node_modules` (4.14.1, a dependency of `eslint-plugin-jsx-a11y`, which `eslint-config-next` brings). Adding it as a direct `devDependency` at that version pulls nothing new. The call is `await axe.run(container, { runOnly: { type: "tag", values: [...] }, rules: {...} })` plus one `expect(results.violations).toEqual([])` with a readable failure message. No matcher library to keep in step with jest-dom 8 and Vitest 5. |
| `vitest-axe` | Fallback. A thin wrapper around axe-core with a `toHaveNoViolations` matcher. Its compatibility with Vitest 5.1.1 and `@testing-library/jest-dom` 8 is not known here; the implementation checks it only if the direct call fails. |
| Playwright + `@axe-core/playwright` | Rejected for this milestone: a browser runner, a browser download, and CI weight, for a project whose CI is out of scope. It would give real layout and contrast; the manual pass covers that instead. |
| `eslint-plugin-jsx-a11y` only | Already on through `eslint-config-next` (a subset of rules); keep, but it is static and cannot see rendered state. |

Spike gate (T0.1): in jsdom 31, `axe.run` needs `window` and `document` globals and a `getComputedStyle`; axe-core 4.14.1 supports jsdom for most rules, with known gaps for rules that need layout. The spike renders `PickCard` and `Conversation` and runs axe with `color-contrast`, `target-size`, and `scrollable-region-focusable` off. If it fails, the recorded fallback order is `vitest-axe`, then role and query assertions only (REQ-PD-39) with the gap written in the evidence log. Nothing in this spec asserts the tool works before the spike does.

### 7.2 The axe matrix (REQ-PD-38)

Pages are async server components. The test calls the page function and renders the element it returns in jsdom: `render(await PicksPage({ searchParams: Promise.resolve({ m }) }))`. `next/image` is mocked to `<img>` as in the existing tests; `next/link` works in jsdom (the existing component tests render it unmocked). The root layout (`<html>`) cannot render inside a container, so `lang="en"`, the title template, and the skip link's presence are asserted statically (§7.3).

| Screen | States rendered |
|---|---|
| `/` | default |
| `/find` | each of the eight question steps (driven by the existing `tests/helpers/conversation-taps.ts`), the Religious sub-chip panel, the card, the adult-end message, the incomplete notice |
| `/picks` | golden models 1, 2, 3 (3 picks, 2 picks with the shortfall note and browse link, 3 picks with disclosures) |
| `/atelier` | default (22 cards), one filter combination, the empty state, the out-of-stock card |
| `/piece/[sku]` | all 22 SKUs idle and approximate; representative SKUs TNZ-1056 (ring), TPN-1459 (photo in box), TPN-1206 (set), TBZ-1013 (tabeez), THP-1001 (Mom, earrings), TPN-1149 (pendant with chain row), and TNZ-1058 (out of stock) each also with a stored calibration, the slider open, the wrap `wrapping`, and the wrap `revealed` |
| piece not-found | `PieceNotFound` |

About 22 + 6×4 + 20 other renders, each about 100 to 400 ms in jsdom: under a minute. The file sets `testTimeout` high enough for the slowest case and runs them as separate `it`s so a failure names the screen.

### 7.3 Files

| File | Env | Covers |
|---|---|---|
| `tests/helpers/axe.ts` | n/a | `runAxe(container)` with the tag set and the disabled rules (each with its reason) |
| `tests/helpers/contrast.ts` | n/a | `parseTokens(css)`, `composite`, `luminance`, `ratio`, surfaces |
| `tests/helpers/targets.ts` | n/a | `targetSize(el)` class parser, `interactive(container)` |
| `tests/helpers/outline.ts` | n/a | `headingOutline(container)`, `focusOrder(container)` |
| `tests/a11y.axe.test.tsx` | jsdom | REQ-PD-38, §7.2 |
| `tests/a11y.keyboard.test.tsx` | jsdom | REQ-PD-39: outline, landmarks, skip link, focus hand-offs, live regions, names, `aria-describedby`, alt text, slider attributes |
| `tests/a11y.contrast.test.ts` | node | REQ-PD-40, A1 to A3 |
| `tests/a11y.targets.test.tsx` | jsdom | REQ-PD-41 targets (A8) |
| `tests/a11y.static.test.ts` | node | REQ-PD-41 source rules, A9 |
| `tests/polish.copy.test.tsx` | jsdom | REQ-PD-42, A10 |
| `tests/page-meta.test.ts`, `tests/page-meta.property.test.ts` | node | REQ-PD-43, A4, A5 |

### 7.4 What each helper does

`contrast.ts` reads `app/globals.css` with `fs` (a test may; `lib/` may not), extracts the six `--color-*: #xxxxxx` values from the `@theme` block, and exposes `composite(fg, alpha, bg)` (per-channel linear mix in sRGB, as CSS does), `luminance` (the WCAG 2.2 formula with the 0.03928 threshold), and `ratio(a, b)`. The surface set is the table of §3. The source scan finds every `text-(plum|pearl|gold)(/N)?`, `border-plum/N`, and `bg-…` utility in `components/**` and `app/**` (tokens only; the existing static test already forbids anything else), and checks the policy for each (text alpha ≥ 75 on all surfaces ≥ 4.5; border alpha ≥ 60 ≥ 3.0 on all surfaces for control borders). Checking every role against every surface is conservative: it does not know which surface a given text sits on, so it assumes the worst. That is the point: a role that passes everywhere can be used anywhere. `targets.ts` parses `h-N`, `min-h-N`, `min-w-N`, `px-N` from `className`. `outline.ts` walks `h1`–`h6` in document order.

### 7.5 Impact on existing tests (REQ-PD-49)

| Test | Assertion | Change | Why |
|---|---|---|---|
| `tests/atelier.ui.test.tsx` line 59 | out-of-stock card `className` contains `text-plum/50` | now `text-plum/75`; line 58 (`bg-plum/5`) unchanged | AA (2.77 to 5.39:1); REQ-CV-38 names no opacity |
| `tests/gift-wrap.ui.test.tsx` line 218 | secondary buy link contains `border-plum/30` | now `border-plum/60` | non-text contrast (1.76 to 3.5:1) |
| `tests/picks.ui.test.tsx` line 44 | exact primary `AtelierButton` class string | none | the primary string stays byte-identical |
| `tests/true-size.ui.test.tsx` lines 188 to 189 | outline `border-plum/60`, `bg-champagne/40` | none | already compliant |
| `tests/true-size.ui.test.tsx` lines 283 to 293, 350 | `role="img"` and `aria-label` of a ring | only if Q-PD7 is accepted: query by `data-testid`; the label string is asserted unchanged | avoid double reading |
| `tests/gift-wrap.ui.test.tsx` | `getByRole("status")` style queries, if any | verify at implementation; a persistent region adds one `role="status"` in `idle` | REQ-PD-22 |
| `tests/safety.ui.test.tsx` | `aria-labelledby` equals the `h2` id; `bg-champagne`, `bg-sage/60` | none | not touched |
| every test that renders a page or `PickCard` | text queries | none expected: visible strings are pinned | REQ-PD-16 |

Each changed assertion keeps its intent and gets a one-line comment naming REQ-PD-49. None is deleted or loosened.

### 7.6 Where the tests do not reach

jsdom has no layout, no real CSS cascade for Tailwind, and no assistive technology. The suite therefore proves: structure (roles, names, order, focus targets, live-region presence), computed contrast of token roles, class-level target sizes and motion coverage, copy and brand invariants, and titles. It does not prove: that a drawing or button is 44 px on glass, that text reflows at 320 px, that a screen reader speaks sensibly, that forced-colors mode is legible, or that the page looks premium. Those are the manual checklist (§9) and are never reported as passed without a human.

## 8. The "instant" warning (REQ-PD-46 to REQ-PD-48)

What the Next.js docs in `node_modules/next/dist/docs/01-app/` say (read for this spec; re-read before editing, per `AGENTS.md`):

| Fact | File |
|---|---|
| `instant` is a route-segment config export on a layout or page (Server Component only); `true`, `false`, or `{ level: "warning" }`. | `03-api-reference/03-file-conventions/02-route-segment-config/instant.md` |
| With Cache Components, every Page and Default segment is validated at warning level in development by default; errors appear in the dev overlay, "the build is unaffected". `instant = false` opts the segment out. | same |
| A client navigation only re-renders below the layout the two routes share; a `<Suspense>` in the root layout does not cover it. Reading `params` or `searchParams` suspends; the fix is a `<Suspense>` boundary near the read, caching, or per-link prefetching. | `02-guides/instant-navigation.md` |
| With `partialPrefetching: true` (set in `next.config.ts`), URL-specific content resolves after navigation by default; `<Link prefetch={true}>` resolves `searchParams` ahead of the click. | `05-config/01-next-config-js/partialPrefetching.md`, `02-guides/optimizing-prefetching.md` |
| `instant = false` "controls instant-navigation validation. The route still uses prerendering and streaming." | `instant.md` |

Why it happens here: `/find` and `/picks` read `m` (and `notice`) from `searchParams` at the top of the page; the only `<Suspense>` is in the root layout (`fallback={null}`), which does not cover a client navigation between pages. `/atelier` also awaits `searchParams` and `/piece/[sku]` awaits `params` and `searchParams`; the dev log named only `/find` and `/picks`, and the investigation records the rest.

### 8.1 Options and decision rule

| Option | What it does | Cost | Risk |
|---|---|---|---|
| (a) `export const instant = false` on the warned pages | Opts those segments out of dev validation; no runtime change. | Two lines and a comment. | Hides the diagnostic for real regressions on those routes; honest only with a recorded reason. |
| (b) Suspense around the `searchParams` read, with a static fallback | Header and headings render at once; the model-dependent body streams in. | A small server child component per page, a fallback, a11y care (`aria-busy`), and a visible flash on each navigation. | `/picks` redirects from inside the streamed child (`redirect()` after the shell is sent is the same 200 + meta-refresh as today, M2 OQ-1); a fallback must not show pinned strings or fake cards. |
| (c) `prefetch={true}` on the "Reveal my picks" and "Change my answers" links | Resolves `searchParams` at prefetch time. | A prop on two links; one extra same-origin request per prefetch (no external call). | Prefetching `/picks?m=…` runs `match()` on the server for a link the user may not click (cheap, pure, deterministic). Does not help `/find` from the landing (no `m`). |

**Decision rule (apply in order; stop at the first that holds):**

1. Reproduce on `next dev` and copy the message. If it does not reproduce, record "not reproducible" and change nothing.
2. Run `npm run build` and `npm start` on a spare port and navigate `/` → `/find` → `/picks` in a browser if one is available, or read the build's route table (`◐`/`ƒ` markers). If the navigation shows no blank or blocked UI (the shell paints immediately and the body follows), the warning is a dev diagnostic about an inherent dependency on request data. Choose (a) and write the reason in a code comment and the evidence log.
3. If the navigation visibly blocks (a blank content area until the server answers), choose (b) for the affected page only, keeping the header and the page title static. Add the tests of REQ-PD-48.
4. Option (c) is considered only for `/picks` and only after (a) or (b), if the manual pass finds the reveal slow.

Default recommendation: (a), because the model lives in the URL by design (REQ-CV-18), so both pages are request-dependent by construction, the fallback of (b) would be an empty box on a two-second journey, and the build is unaffected. The investigation may overturn this with evidence (Q-PD10). Cap: one implementation session, including the record.

Whatever is chosen: the `/picks` redirects (`/picks` without `m` answers 200 plus a meta-refresh to `/find`; invalid `m` goes to `/find?notice=incomplete`) are unchanged, checked with `curl` on the dev server.

## 9. Manual checklist (`docs/qa-reports/polish-m4.md`, REQ-PD-44, REQ-PD-45)

Written in the style of `docs/qa-reports/true-size-m3.md`: a status line ("NOT RUN" until a human fills it), an automated-results table (filled by the implementation session), a test-setup table (device, browser, reader, zoom), then these sections with a pass/fail/notes column.

| Section | Checks |
|---|---|
| Keyboard only, whole journey | Tab through `/` → `/find` (all steps, Religious sub-chips, Back, Edit) → card → `/picks` → `/piece/[sku]` (verdict, viewer, slider, wrap, message, copy, buy) → `/atelier` (filters, Clear filters). Skip link works. Focus is always visible. No trap. Slider reaches both ends with the keyboard. |
| Screen reader | Name the reader and browser. Landmarks and headings list; step change speaks the new question; chips speak pressed state; repeated links speak their product; new-tab hint; wrap status; calibration status; slider value text; count on `/atelier`. |
| Contrast spot-check | On a real display with a contrast tool: the six token pairs, plus the footnote, the eyebrows, the out-of-stock card, and the secondary button border. Compare with the computed table (§3). |
| Reduced motion (system setting on) | Landing (motes gone), wrap (immediate reveal), calibration, hover transitions. |
| Forced-colors / high contrast | Focus outline, borders, buttons, drawings still visible. |
| Zoom and reflow | 200% text zoom; 320 px width: no two-dimensional scroll except the outline row and the ruler. |
| Touch | On a phone: every control easy to hit; chips; slider thumb; header links. |
| Premium visual review (REQ-PD-45) | At 360, 768, and 1280 px for each journey screen and a piece page per category (pendant, bracelet, earrings, set, tabeez). The list in the requirement. |
| Not run, carried forward | T4.3 physical calibration (REQ-TS-30): not run, unchanged. |

If a headless browser exists (`which chromium google-chrome chromium-browser`), the implementation session may capture screenshots at the three widths into `docs/qa-reports/screenshots-m4/` and list them in the evidence log; otherwise it writes "not run". Screenshots are optional evidence, not a gate.

## 10. Correctness properties (fast-check where random generation fits; enumerated otherwise; seeded, `numRuns ≥ 200`)

| ID | Property | Kind | Requirement |
|---|---|---|---|
| P-PD-1 (A1) | Contrast helper: `ratio(a, b) = ratio(b, a)`, `1 ≤ ratio ≤ 21`, `ratio(c, c) = 1`, `composite(fg, 1, bg) = fg`, black on white is 21, `#767676` on white is 4.54 (±0.01). Random sRGB triples. | fast-check | REQ-PD-40, 54 |
| P-PD-2 (A2) | For each alpha in `{75, 80, 85, 90, 95, 100}` and each of the nine surfaces, `ratio(composite(plum, alpha, surface), surface) ≥ 4.5`. For each alpha in `{60, 65, 70}`, some surface gives `< 4.55`. | enumerated | REQ-PD-25, 55 |
| P-PD-3 (A3) | For each alpha in `{60, 70, 80, 90, 100}` and each surface, `border-plum/alpha` is at least 3.0:1; `/30` is not. | enumerated | REQ-PD-26, 56 |
| P-PD-4 (A4) | `pieceTitle` and `pieceDescription` over the 22 products and over generated products (random name, category, availability): the name appears verbatim once; "out of stock" appears iff unavailable; none of the banned pattern outside the name; deterministic; inputs unchanged. | fast-check + enumerated | REQ-PD-34, 35, 57 |
| P-PD-5 (A5) | Titles of the landing, `/find`, `/picks`, `/atelier`, and the 22 pieces (and their out-of-stock variants) are pairwise distinct and non-empty. | enumerated | REQ-PD-36, 58 |
| P-PD-6 (A6) | Every screen state of §7.2: one `h1`; heading levels never jump by more than one going down; one `main`. | enumerated | REQ-PD-24, 59 |
| P-PD-7 (A7) | For random valid action sequences (an index-based generator that picks a valid action for the current state, as `arbFlow` does in `tests/conversation.property.test.ts`; move it to `tests/helpers/` so both files share it), after each step change the focused element is the new step's heading; all step prompts are non-empty and pairwise distinct. | fast-check (component, `numRuns` 50 for render cost, raised if fast) | REQ-PD-23, 60 |
| P-PD-8 (A8) | For `PickCard` and `BrowseCard` over all 22 products: each interactive element has an accessible name containing its visible text, and meets the target rule. | enumerated | REQ-PD-20, 28, 61 |
| P-PD-9 (A9) | Every `animation`/`transition` declaration and utility is covered by the global reduce rule; the wrap keyframes still end by `WRAP_REVEAL_MS`. | static | REQ-PD-27, 62 |
| P-PD-10 (A10) | Over 22 SKUs and all screens that show them: pinned strings present, "true size" once in approximate and stale modes, footnote on every `₹` node, no discount word, no logo, no overlay on a photo. | enumerated | REQ-PD-15, 16, 63 |

P-PD-2 and P-PD-3 are enumerated because the input space is a small finite table; random generation would add nothing. The one-time negative checks (`/60` text fails, `/30` border fails) keep the floors honest. A counterexample from any property is logged in `docs/kiro-evidence-log.md` with its fix; a test is never loosened.

## 11. Next.js notes (read before writing the routes)

| Fact | Source file | Consequence |
|---|---|---|
| `generateMetadata` follows the Cache Components rules; metadata that reads runtime data (`params`) defers to request time, and a page that is otherwise fully prerenderable needs an explicit choice (cache it, or add a dynamic marker). | `03-api-reference/04-functions/generate-metadata.md` ("With Cache Components") | The piece page has `generateStaticParams`; confirm with `npm run build`; apply the doc's fix only if the build errors. |
| `title.template` applies to child segments only, requires `title.default`, and does not apply to the segment that defines it. | same, `title` | The root layout defines `default` and `template`; page titles are plain strings; the landing page, which is the root segment's page, shows the default. |
| `instant` export: Server Component only; dev-only; `false` opts out. | `.../02-route-segment-config/instant.md` | §8. |
| `<Link prefetch={true}>` with Partial Prefetching resolves URL data ahead of the click. | `partialPrefetching.md` | Option (c) of §8. |

The builder re-reads these files, and `next/font`, `next/link`, and the Tailwind v4 theme docs where a task touches them, before writing code.

## 12. Open questions (not resolved by this spec; builder's call at the Tue 24 Nov checkpoint)

| ID | Question | Spec's working assumption |
|---|---|---|
| Q-PD1 | The M2 test pins `text-plum/50` on the out-of-stock card; the class measures 2.77:1. REQ-CV-38 asks for "muted surface and text colours" without an opacity. | AA wins. Text becomes `text-plum/75` (5.39:1 on `plum/5`); the surface and the "Out of stock" badge carry the muting; the test assertion is updated (REQ-PD-49). |
| Q-PD2 | Gold cannot be text on any token surface (1.9 to 2.3:1), so the gold eyebrow, numerals, and pick label lose their gold. A darker gold would be a new colour, which the brand rules forbid. | Gold is decorative only (rules, bars, moon, motes, ribbon). Text turns plum. |
| Q-PD3 | `border-plum/60` on every control is heavier than today's `/30`. The looser alternative is to keep `/30` on text-labelled buttons (the label identifies them) and strengthen only the textarea, slider, and drawings. | Strict: every control boundary is 3:1 (the brief asks for it); the visual review may soften other things (shadow, radius) to keep it premium. |
| Q-PD4 | Repeated "See details" and "Buy" links need context. `aria-label` would replace the name; `aria-describedby` adds the product name without changing it. | `aria-describedby` to the card heading, plus the new-tab hint. |
| Q-PD5 | The fit-check region's accessible name is only "Good fit" or "Check this" (pinned by `safety-verdict` and its test). | Left as is; the visible "Fit check" eyebrow sits next to it. Raise a `safety-verdict` change if the screen-reader pass finds it confusing. |
| Q-PD6 | At `revealed` the gift wrap both writes a status and moves focus (REQ-GP-17). Possible double speech. | Keep both (pinned); decide after the manual screen-reader pass. |
| Q-PD7 | `SizeOutlines` drawings carry `role="img"` and an `aria-label` equal to the caption below, so a screen reader may read it twice. | Make the drawing `aria-hidden` (the caption is the name) and update the few `getByRole("img")` assertions; the builder may veto and keep REQ-TS-19's wording as is. |
| Q-PD8 | A native range moves 1 px per arrow key over 685 px. | Rely on native Page/Home/End; add two "Smaller"/"Larger" buttons only if the manual keyboard pass shows it is impractical. |
| Q-PD9 | `product.md` lists cobweb corners on the hero; M1 to M3 never built them. | Built as an optional inline-SVG task, low opacity, hero only. Drop it if the builder prefers a quieter landing. |
| Q-PD10 | The instant warning: (a) `instant = false` or (b) Suspense. | Default (a), subject to the evidence of the investigation task (§8.1). |
| Q-PD11 | `axe-core` direct versus `vitest-axe`. | `axe-core` direct; verify in T0.1 before use; fallback recorded. |
| Q-PD12 | The brief suggested a price band in the piece title. | None: a price in a title has no room for the footnote. The description carries category, metal, and ages. |
| Q-PD13 | The `/atelier` header link reads "← Back to the atelier" and goes to `/` (the landing). The wording suggests the atelier itself. | Unchanged (not a pinned string, but not in scope to reword). Raise a copy change if the builder wants "← Home". |
| Q-PD14 | Headless browser for screenshots and real-layout checks is not installed. | Manual checklist plus optional screenshots if a browser exists; nothing reported without a human. |
| Q-PD15 | `design-polish` cannot write `tests/**` or `lib/**`. | Tasks split by owner (REQ-PD-50); paired test edits go to the builder in the same wave. |
| Q-PD16 | `/about` is in `structure.md` but no route exists. | Out of scope; no link to it is added. |
