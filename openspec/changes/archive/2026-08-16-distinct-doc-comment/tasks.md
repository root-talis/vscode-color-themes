## 1. Suggestion provider

- [x] 1.1 Declare the `docComment` slot's distinctness reference in `lib/suggest-rust.js` (`distinctFrom: "fg-muted"`), keeping its strategy, factor, and floor unchanged
- [x] 1.2 Add the guard constants (minimum LAB chroma 15, minimum LAB lightness difference 20) to `lib/suggest.js` next to `HUE_TOLERANCE` and `BLUE_HUE`
- [x] 1.3 In `lib/suggest.js`, refactor `resolveLeastCommonHue` to walk the candidate families in the existing selection order, compute each candidate's relative-contrast band color, and return the first whose color passes the distinctness guard against the `distinctFrom` reference (falling back to `fg`, then to no guard); when no candidate passes, return the first candidate's color

## 2. Tests

- [x] 2.1 Guard contract (test/suggest.test.js): a chromatic suggested color passes via chroma (github-dark, github-light, tomorrow, tomorrow-night, gruvbox dark/light, correia-gruvbox), and `docComment` stays byte-identical to the committed color for all nine palettes except solarized-light
- [x] 2.2 Lightness-distinguished pass (test/suggest.test.js): solarized-dark's gray `docComment` still resolves from the cyan (gray) family, unchanged from the committed color, because its lightness differs from `fg-muted` by at least the minimum
- [x] 2.3 Fallback to the next family (test/suggest.test.js): solarized-light's top candidate (gray `pink` family) fails the guard, `docComment` falls back to the `cyan` family, and the result matches the committed `#289f96`
- [x] 2.4 No-passing-family fallback (test/suggest.test.js): a crafted palette whose every candidate is near-neutral and lightness-similar to `fg-muted` resolves `docComment` from the first candidate in the selection order instead of throwing
- [x] 2.5 Missing reference (test/suggest.test.js): a crafted palette without `fg-muted` skips the guard and resolves `docComment` from the first candidate without error
- [x] 2.6 Determinism (test/suggest.test.js): suggesting solarized-light twice yields byte-identical sets

## 3. Outputs

- [x] 3.1 Update `palettes/solarized-light.json` so its `docComment` equals the suggested color
- [x] 3.2 Rebuild the themes (`npm run build`) and confirm `themes/gk-semantic_solarized-light.json` `comment.documentation` reflects the new color

## 4. Verification

- [x] 4.1 Run `npm test` and confirm every suite passes
- [x] 4.2 Run `npm run build` and confirm no committed theme other than `gk-semantic_solarized-light.json` changes
