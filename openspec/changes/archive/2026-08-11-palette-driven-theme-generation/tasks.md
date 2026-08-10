## 1. Setup

- [x] 1.1 Add `build`, `extract`, and `test` scripts to package.json (`test` uses built-in `node --test`)
- [x] 1.2 Create `palettes/github-dark.json` and `palettes/github-light.json`: 16 base slots (same slot names both themes) + separate rust set, with values drawn from the committed themes (per design D1)
- [x] 1.3 Create `spec/` and `test/` directory scaffolding

## 2. Color math (TDD slice 1)

- [x] 2.1 Write failing unit tests in `test/color.test.js`: hex parse/format (6 & 8 digit, lowercase), alpha extraction, `rgb→lab→rgb` round-trip exact on known and random values, `base + delta` reproduces known GitHub pairs (e.g. `#0366d6→#79b8ff`), rejection of invalid hex and out-of-range deltas
- [x] 2.2 Implement `lib/color.js` porting the verified LAB reference (see TASK.md §8) until all color tests pass

## 3. Palette, expression, and theme assembly

- [x] 3.1 Implement `lib/palette.js`: load + validate exactly 16 base colors + rust set, valid hex, theme type
- [x] 3.2 Implement `lib/resolve.js`: parse spec expressions (`blue.d1`, `blue.d1@44`, literal hex, pass-through non-color settings) against palette + derived-token table
- [x] 3.3 Implement `lib/theme.js`: assemble the theme object (colors / tokenColors / semanticTokenColors) from palette + spec, deterministic alphabetical color-key ordering

## 4. Bootstrap extractor

- [x] 4.1 Implement `lib/extract-spec.js`: per theme, reuse palette color when exact, else compute `delta = lab(target) − lab(nearestBase)`, emit derived token + expression, preserve alpha bytes
- [x] 4.2 Run the extractor against both committed themes; commit the generated `spec/github-dark.json` and `spec/github-light.json`

## 5. Build and snapshot test (TDD slice 2)

- [x] 5.1 Implement `lib/build-themes.js` CLI: palette + spec → `themes/*.json`
- [x] 5.2 Write failing `test/snapshot.test.js`: build both themes in-memory, deep-equal against committed themes with normalization (strip `//` lines, fix JSONC trailing commas, lowercase hex), plus a sanity assertion that every emitted color is valid 6/8-digit hex
- [x] 5.3 Regenerate `themes/*.json` from the committed specs; confirm the snapshot test passes

## 6. Verification

- [x] 6.1 Run `npm test`; all color and snapshot tests pass
- [x] 6.2 Spot-check a palette edit: change one base color, rebuild, confirm only colors referencing that base change (per spec — Base color change propagates) and revert
