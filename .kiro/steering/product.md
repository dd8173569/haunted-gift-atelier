---
inclusion: always
---

# Product: Haunted Gift Atelier

## Refusals (non-negotiable)

- NEVER show a discount, strike-through price, "save ₹X", or "% off". No MRP exists anywhere: `mrp_inr` is null for all 22 SKUs.
- NEVER recommend an out-of-stock item. TNZ-1058 is the one Out of Stock SKU. It appears only greyed out in `/atelier`, with an "Out of stock" badge and no buy CTA.
- Return exactly 3 picks when 3 or more products are eligible. Return 1 or 2 when fewer are. NEVER add a fake 3rd pick.
- NEVER assert a certification (BIS, hypoallergenic, nickel-free, "safe for sensitive skin") that is not in that product's `claims[]`. `claims[]` is `[]` for all 22 SKUs, so the card says "No certifications are stated on this product's page".
- NEVER show a religious-symbol piece unless the user explicitly opted in. NEVER infer it from an occasion, festival, relationship, or name. `none-religious` is never relaxed.
- NEVER generate, insert, or display a logo or watermark. "Tiny Tiaraa" appears as a text wordmark only, in the display serif.
- NEVER crop, alter, recolour, upscale, or regenerate a catalog photo. Show it with `object-contain` on a pastel background, with no text or overlay on it. One photo per SKU exists; do not invent alternate views.
- NEVER depict a real person's face.
- NEVER invent a product, price, SKU, rating, material, or claim. Every product fact traces to `data/catalog.json`.
- Pastel light palette only. All colour tokens live in one config file. No ad-hoc hex values in components.
- NEVER let an LLM name, recommend, describe, price, filter, or reorder a product, or write a safety claim.

## Vision

A haunted-gift-atelier experience that finds the right baby-jewelry gift by conversation, then shows it is a fit (safety check), shows it at true size, and wraps it. The real catalog is Tiny Tiaraa's 22 SKUs (tinytiaraa.com, the founder's own brand). The trust layers are the product, not decoration on a quiz.

## Named user

The gift-buyer who is not the wearer: an aunt, uncle, grandparent, godparent, or friend buying baby or kids jewelry for someone else's child. The trust problems we answer:
1. Recipient difficulty: they cannot tell what suits the child → a recipient-model conversation.
2. Scale deception: product photos are zoomed → the true-size viewer, with honest calibration.
3. Unverified safety claims → a fit check that asserts only what the data states.

## Journey

`/` landing → `/find` conversation (max 6 taps-only questions, back always available) → recipient card (every field editable, matching runs only from the confirmed model) → `/picks` (3 picks, 2–4 "why this one" reasons each, relaxation disclosed in plain words) → `/piece/[sku]` (safety verdict + true-size viewer + catalog facts + gift wrap and message) → "Buy on Tiny Tiaraa" opens the catalog `url` verbatim in a new tab. `/atelier` is the browse escape hatch (21 in-stock + 1 greyed out). The happy path takes under 2 minutes with the LLM off. No login, no paywall, no checkout, no accounts.

## Brand rules

- Premium and professional. Haunted elements are subtle and functional: floating motes on the landing, a crescent-moon progress marker, cobweb corners on the landing hero only. Spooky never obscures a price, a photo, or a safety line.
- Every price carries the footnote: "Price as listed on tinytiaraa.com on 21 Nov 2026 — check the store for the current price."
- Product names are shown verbatim, including the site's spelling ("sudd set", "studd set").
- The safety card is a fit check, not a certification. Its line: "A fit check from the atelier — guidance, not a safety certification. When in doubt, check with the brand or the child's parents." It never says "safe" or "unsafe".
- True size is claimed only after calibration. Before it, the label is "Approximate size — calibrate with a card for true size."
- Ratings appear only when the catalog has one (9 of 22 have none). Never invent or round one.
- Missing data is stated plainly ("not stated on the listing"), never filled in.
