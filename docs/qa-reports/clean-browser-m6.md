# Clean-browser pass (Milestone 6) — QA note

Status: browser observations from a separate browser task on the live site;
key claims independently verified by the coordinator with curl. No browser
exists on the build machine, so no browser check was run from here. Live
site: https://haunted-gift-atelier.netlify.app/ (main@`1e2e0ff` at the time
of the pass).

## Journey (verified by taps + curl)

Persona: recipient newborn, occasion baby shower, budget under ₹2,500.
Picks in order: TNZ-1056 ₹1,674, TOB-1008 ₹1,899, TBZ-1013 ₹2,324. (All
three are In Stock in `data/catalog.json`; the prices match the catalog.)

- Safety verdict + true-size viewer present on all three detail pages.
- Gift wrap works.
- The buy link points to tinytiaraa.com (href verified).

## Route checks

- `/piece/NOPE-0000`: HTTP 404 in production in 14 of 15 curls (one 200
  observed once — see below), soft-404 page shown. O-1 / Q15 CONFIRMED
  with the caveat below.
- `/piece/TNZ-1058`: out of stock, no buy link.
- `/picks` with no params: redirects to `/find`.
- `/atelier`: grid renders 22 pieces, out-of-stock greyed out.

## Q15 / O-1 confirmed

Expected behaviour "200 in dev, 404 in production" is now confirmed on
the deployed URL: curl returns 404 for `/piece/NOPE-0000` in 14 of 15
observations (the coordinator's curls plus the parent's), and the browser
shows the soft-404 page. Caveat: one curl returned 200 — the first curl
~3.5 minutes after the M6 push, plausibly a cold-start streaming race
(if the shell flushes before `notFound()` throws, the status stays 200).
The 200 response body was not captured, but by the known mechanism it is
the same client-rendered not-found template observed in dev as 200 +
`noindex`. The soft-404 page renders either way, so the user-visible
behaviour is stable; only the status code varies. Q15 is closed with
this caveat recorded. The served-HTML `h1` / `main-content` gap is the
documented Next.js client-rendering fallback and is unchanged.

## Correction: the /picks href claim was a browser misread (no bug, no fix)

The browser task reported that the `/picks` "See details" links for picks
2 and 3 had wrong hrefs (`/piece/TNZ-1055`, `/piece/TNZ-1057`). That
claim is FALSE.

Disproof: the coordinator fetched the live `/picks` HTML for the exact
persona (the `m` param built with the repo's own `toModel` +
`encodeModelParam`) — the three hrefs are exactly `/piece/TNZ-1056`,
`/piece/TOB-1008`, `/piece/TBZ-1013`. TNZ-1055 and TNZ-1057 do not exist
in `data/catalog.json` (22 SKUs, neither present). The code path
(`toPickViews` → `pieceHref`) derives hrefs from the pick SKUs and cannot
produce SKUs outside the catalog.

Recorded as a browser misread. No code change was made.

## Netlify "Powered by Netlify" badge (open decision, no change made)

The served HTML contains an injected script
`netlify/scripts/hud?variant=public` (confirmed in the live homepage HTML
with curl) plus an HTML comment "Netlify hosting facts for this site". It
renders a floating badge in the bottom-right corner that visually overlaps
the landing-page footer text.

Research (Netlify's own docs and pricing page, read 22 Nov 2026): the
badge is on by default for new public projects created on a Free plan on
or after 19 Aug 2026 — this project (created 22 Nov 2026, Free/Starter)
has it on. The ONLY removal path is the per-project dashboard toggle
(Project configuration > General > Powered by Netlify badge); it takes
effect on the next request with no redeploy. The docs say the setting may
be locked depending on plan ("If the setting is locked, upgrading to
Personal or Pro lets you turn it off") and do not state outright whether
it is locked on Free — whether this team's toggle is usable can only be
checked in the Netlify dashboard. There is no `netlify.toml` option, no
header, and no CSS workaround: Netlify injects the script at the edge,
and the docs say it "renders in an isolated frame, so your project's CSS
can't affect the badge".

Cost if an upgrade is the path: Personal $9/month, Pro $20/month
(Netlify pricing page, read 22 Nov 2026). NO upgrade was made. Open
decision for the builder.

## Not run / not verified

- Phone-width layout: the browser task could not resize its viewport
  (checked at ~905px only, no issues seen). The builder will eyeball it
  on his phone.
- T4.3 physical calibration: still needs a human with a real card +
  ruler.
- Fault-injection fallback `h1` (REQ-REL-60): no thrown error was
  triggered in the browser pass; stays NOT verified.
- Q-REL2 `loading.tsx` screen-reader check: NOT RUN.
