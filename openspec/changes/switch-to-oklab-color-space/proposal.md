## Why

The system derives and matches colors in CIELAB space. CIELAB is not perceptually uniform. Its hue is compressed in the blue region, so saturated blues read as violet. Its chroma overestimates the colorfulness of blue. Its Euclidean distance is a poor perceptual metric. Every decision that depends on human perception — nearest-slot matching, chromatic slot naming, the distinctness guard, and least-common-hue selection — inherits these flaws.

OKLab is a more perceptually uniform color space with the same rectangular `[L, a, b]` shape as CIELAB. The swap is mechanical, and the perceptual decisions become more faithful.

## What Changes

- Replace the LAB color math in `lib/color.js` with OKLab: `rgb2lab`/`lab2rgb` become `rgb2oklab`/`oklab2rgb`; `labDelta`, `applyDelta`, and `validateDelta` operate on OKLab components; validation bounds become `L ∈ [0,1]`, `|a|,|b| ≤ 0.4`.
- Store derived deltas as OKLab offsets `[ΔL, Δa, Δb]`, the same shape as today's LAB offsets. The color math SHALL round-trip `rgb → oklab → rgb` exactly for every palette and committed-theme color.
- Use OKLab for the perceptual decision points: Euclidean distance for nearest-slot and chromatic-slot matching, the lightness bisection in the suggestion provider, and the distinctness guard.
- Recalibrate the suggestion constants in OKLab terms: `MIN_CHROMA ≈ 0.04`, `MIN_LIGHTNESS_DELTA ≈ 0.20`, `BLUE_HUE ≈ 250°` (final values calibrated against the committed fixtures).
- Allow rules that operate on hue explicitly (the least-common-hue selection) to use OKLCH hue angles. OKLCH hue equals `atan2(b, a)` of OKLab, so this is a vocabulary allowance with no structural cost.
- **BREAKING**: Every stored spec delta changes. `spec/*.json` files regenerate via extraction; byte-exact rebuild holds because the round-trip is exact in the new space.
- **BREAKING**: Two palettes' chromatic slot names change. Under OKLab distance, `correia-gruvbox` and `solarized-light` reassignments differ, and the new names are more accurate (for example `#0431fa` moves from `purple` to `blue`).
- **BREAKING**: Suggested semantic colors drift. The suggestion provider now solves in OKLab, so the `rust` sections of `palettes/*.json` and the docComment rules derived from them may differ from committed values.
- **BREAKING**: Composite themes change. Themes built from a github spec and a non-github palette (`gk-semantic_github-tomorrow`, `gk-semantic_github-tomorrow-night`, `gk-semantic_github-gruvbox-dark`, `gk-semantic_github-gruvbox-light`) are excluded from byte-exact equality testing; their committed files regenerate.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `theme-generation`: LAB vector-offset derivation becomes OKLab vector-offset derivation; chromatic slot naming uses OKLab distance; the spec expression grammar carries an OKLab delta; byte-exact reproduction excludes composite themes (github spec combined with a non-github palette).
- `semantic-color-suggestion`: hue and chroma preservation is stated in OKLab terms; the distinctness guard uses recalibrated OKLab/OKLCH thresholds; hue-explicit rules (least-common-hue selection) may use OKLCH hue angles.

## Impact

- `lib/color.js` — OKLab conversion math and validation bounds; the API shape (`rgb2lab`, `lab2rgb`, `labDelta`, `applyDelta`, `validateDelta`) is unchanged.
- `lib/suggest.js`, `lib/suggest-rust.js` — lightness solve, distinctness guard, and hue matching move to OKLab/OKLCH; constants recalibrated.
- `lib/resolve.js`, `lib/extract-spec.js`, `lib/derive-palette.js` — consume the OKLab functions; distance metrics change.
- `spec/*.json`, `palettes/*.json`, `themes/gk-semantic_*.json` — regenerate; drift expected in the areas listed above.
- Tests — `test/color.test.js` (round-trip corpus), `test/suggest.test.js` (guard and committed-rust assertions), `test/snapshot.test.js` (composite exemption), `test/extract.test.js` (fixture recovery).
- `README.md` — references to the Lab space update.
