# Safety guidance rules
version: 1.0.0

Human-edited only (steering `catalog-rules.md`). Any edit names the rule and the reason, bumps the version, and adds a changelog line. IDs are never reused or renumbered; a retired rule is marked retired, not deleted. `lib/safety-rules.ts` mirrors this file; `tests/safety.rules.test.ts` fails if they differ.

### SR-MAT-GOLD18
- check: materials
- applies: segment 18KT Gold
- severity: note
- text: 18KT gold is 18 parts gold in 24 (75% gold). The listing does not name the other metals.

### SR-MAT-SILVER925
- check: materials
- applies: segment 925 Silver
- severity: note
- text: 925 sterling silver is 92.5% silver. The listing does not name the other metal.

### SR-MAT-DIAMOND
- check: materials
- applies: segment Diamond …
- severity: note
- text: Carat (ct) is the diamond's weight, not its size. GH-VS is a colour and clarity grade as stated on the listing; the listing does not say who graded it.

### SR-MAT-PEARL
- check: materials
- applies: segment contains pearl
- severity: note
- text: The listing says pearl and does not say whether it is natural or cultured.

### SR-MAT-CZ
- check: materials
- applies: segment CZ
- severity: note
- text: CZ is cubic zirconia, a lab-made stone. It is not diamond.

### SR-MAT-BEADS
- check: materials
- applies: segment contains black beads
- severity: note
- text: The listing says black beads and does not say what they are made of.

### SR-WEIGHT-MEDIAN
- check: weight
- applies: always
- severity: note
- text: Compared with the median weight of in-stock pieces listed for the same age group. Listed weights use different bases (gold only for some pieces, gross weight for others) and different metals, so this is context, not a limit.

### SR-CLAIMS-ONLY
- check: certifications
- applies: always
- severity: note
- text: Only certifications stated on this product's own page are shown. Store-wide wording is not treated as a claim for this piece.

### SR-WEAR-TABEEZ
- check: wear
- applies: category = Tabeez
- severity: flag
- text: Worn on a black thread — tie securely and check the knot regularly.

### SR-WEAR-BRACELET
- check: wear
- applies: dims.kind = string-bracelet
- severity: flag
- text: Check the fit as the child grows, and take it off for sleep.

### SR-WEAR-BANGLE
- check: wear
- applies: dims.kind = bangle
- severity: flag
- text: A bangle does not stretch. Check that it slips over the hand comfortably and still fits as the child grows, and take it off for sleep.

### SR-WEAR-SET-EARRINGS
- check: wear
- applies: category = Set
- severity: flag
- text: The earrings are small parts. Supervise young children and check them regularly.

### SR-NS-NICKEL
- check: not-stated
- applies: always
- severity: note
- text: Nickel content is not stated on the listing.

### SR-NS-PLATING
- check: not-stated
- applies: always
- severity: note
- text: Plating or finish is not stated on the listing.

### SR-NS-CLASP
- check: not-stated
- applies: always
- severity: note
- text: Clasp or closure type is not stated on the listing.

## Changelog

- 1.0.0 — Initial 15 rules from the safety-verdict design §4.2.
