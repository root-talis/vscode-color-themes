## 1. OKLab color math

- [x] 1.1 Write failing round-trip tests in `test/color.test.js`: `rgb → oklab → rgb` exact on known and random values, plus a corpus test covering every color in `palettes/*.json` and `themes/*.json`
- [x] 1.2 Replace the `rgb2lab`/`lab2rgb` bodies in `lib/color.js` with OKLab (Ottosson's matrices with cube roots), keeping the exported names and the delta shape
- [x] 1.3 Update `validateDelta` bounds in `lib/color.js` to OKLab ranges (`L ∈ [0,1]`, `|a|,|b| ≤ 0.4`) with tests for the new boundaries
- [x] 1.4 Verify the round-trip corpus passes for every committed palette and theme color; update any LAB-specific assertions in `test/color.test.js`

## 2. Recalibrate suggestion constants

- [x] 2.1 Add the OKLab guard constants to `lib/suggest.js` next to `HUE_TOLERANCE`: `MIN_CHROMA = 0.04`, `MIN_LIGHTNESS_DELTA = 0.20`, and `BLUE_HUE = 260`
- [x] 2.2 Update `test/suggest.test.js`: distinctness-guard assertions use OKLab chroma/lightness, and the `BLUE_HUE` tie-break expectation moves to 260 degrees
- [x] 2.3 Re-suggest `rust` against all nine committed palettes and confirm the docComment classification (pass/fail per family) matches the committed behavior, with only the expected `rust`-section drift

## 3. Regenerate artifacts

- [x] 3.1 Regenerate `spec/*.json` deltas via extraction; verify the matched pairs (`github-dark`, `github-light`, `solarized-dark`, `solarized-light`, `correia-gruvbox`) rebuild byte-exact
- [x] 3.2 Regenerate `palettes/*.json`: `rust` sections from suggestions, and the chromatic reassignments for `correia-gruvbox` and `solarized-light` (github pairs stay identity)
- [x] 3.3 Regenerate the four composite themes (`gk-semantic_github-tomorrow`, `gk-semantic_github-tomorrow-night`, `gk-semantic_github-gruvbox-dark`, `gk-semantic_github-gruvbox-light`); they may differ from the previous committed files

## 4. Update tests and docs

- [x] 4.1 Scope `test/snapshot.test.js` byte-exact equality to the matched pairs and add coverage that composite themes are exempt
- [x] 4.2 Update `test/extract.test.js` fixture-recovery expectations for the regenerated deltas and the two reassigned palettes
- [x] 4.3 Update README references to the Lab color space (derived-token explanation and extractor description)

## 5. Sync main specs

- [x] 5.1 Apply the delta specs to `openspec/specs/theme-generation/spec.md` and `openspec/specs/semantic-color-suggestion/spec.md`, including updating the theme-generation Purpose line from "LAB space" to "OKLab space"
