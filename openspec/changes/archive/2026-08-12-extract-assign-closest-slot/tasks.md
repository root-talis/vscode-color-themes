## 1. Chromatic slot reassignment in `lib/derive-palette.js`

- [x] 1.1 Add a `CHROMATIC_SLOTS` constant listing the 8 color-named base slots (`blue`, `green`, `red`, `orange`, `yellow`, `purple`, `pink`, `cyan`), matching the existing `BASE_ANCHORS` names exactly.
- [x] 1.2 Add a `CHROMATIC_REFERENCE` table of the 8 canonical reference hexes (D2 in design.md) as one clearly-commented block next to the assignment code.
- [x] 1.3 Add a small Hungarian algorithm (O(n³), n=8) computing the minimum-total-Euclidean-LAB-distance perfect matching between the 8 derived chromatic colors and the 8 chromatic slots, using `rgb2lab` from `lib/color.js`.
- [x] 1.4 Wire the reassignment into `derivePalette`: after the role anchors resolve and before `validatePalette(data, 'derived palette')`, relabel the 8 chromatic base slots by the matching. The neutral and `rust.*` slots keep their resolved values.
- [x] 1.5 Confirm determinism: the algorithm iterates slots/colors in a stable fixed order so identical duplicate colors resolve to the same slot order on every run (D4).

## 2. Tests in `test/extract.test.js`

- [x] 2.1 Add a correia-gruvbox reassignment test: `extractTheme` on `themes/correia-gruvbox.json` yields a palette whose `blue` is `#179fff`, whose `yellow`/`orange` slots hold the gold colors (`#ffd700` and `#fabd2f`/`#d79921` per the assignment), whose `purple` is `#da70d6`, and whose neutral slots are unchanged from today's output.
- [x] 2.2 Add a byte-exact rebuild test for the reassigned correia extraction: `verifyRebuild` against `themes/correia-gruvbox.json` passes with the reassigned palette and regenerated spec.
- [x] 2.3 Add a chromatic-identity assertion for `github-dark` and `github-light`: the reassigned chromatic slots deep-equal the committed `palettes/github-{dark,light}.json` values (existing 3.1/3.2 recovery tests already pin the full palette; this locks the identity case explicitly).
- [x] 2.4 Add a determinism test: run `extractTheme` twice on the same theme and assert the palette and spec outputs are byte-identical (duplicate colors, e.g. correia's `#1d2021`, must not flip).
- [x] 2.5 Run `npm test` and confirm the full suite (color, extract, snapshot) passes unchanged except for the new tests.

## 3. Spec sync and docs

- [x] 3.1 Run `openspec sync-specs --change extract-assign-closest-slot` to fold the delta requirement ("Chromatic base slots named by closest color") into `openspec/specs/theme-generation/spec.md`, then `openspec validate extract-assign-closest-slot --type change`.
- [x] 3.2 Update the README's "Reverse direction" section with one sentence noting that extraction reassigns the 8 chromatic slots to the closest palette slot by color distance so a derived palette's slot names match its colors.
