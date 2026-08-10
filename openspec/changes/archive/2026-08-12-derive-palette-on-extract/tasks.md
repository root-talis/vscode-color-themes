## 1. Palette recovery module

- [x] 1.1 Create `lib/derive-palette.js` with a color collector: walks `theme.colors`, `theme.tokenColors` (foreground/background settings), and `theme.semanticTokenColors` (string / `.foreground`), normalizing every value with `parseHex`/`formatHex` and stripping the alpha byte (design D3)
- [x] 1.2 Add the type-keyed role-anchor table from design D2 (dark and light variants for the swapped keys: `fg-muted`/`fg-subtle`, `border-muted`, `red`, `yellow`, `purple`, `pink`, `cyan`), including tokenColors (`entity.name.tag`, `invalid.broken`, `entity`) and semanticTokenColors (`string`, `comment.documentation`, `macro`, `variable.consuming`, `const`, `method`) anchors
- [x] 1.3 Implement `derivePalette(theme)` that resolves each slot from its anchor key and returns the same shape as `loadPalette` (`{ type, base, rust, slots }`), normalizing colors to 6-digit hex
- [x] 1.4 Factor palette validation (design D4): extract the checks from `lib/palette.js` `loadPalette` into a shared `validatePalette(data, source)` helper, and have both `loadPalette` and `derivePalette` use it, so a malformed recovery raises a clear error

## 2. Extract orchestration and CLI

- [x] 2.1 Add `extractTheme(theme)` in `lib/extract-spec.js` (or a thin wrapper): `derivePalette(theme)` then the existing `extractSpec(theme, palette)`, returning `{ palette, spec }`
- [x] 2.2 Add the self-check (design D6): `buildTheme(derivedPalette, derivedSpec)` writes a rebuilt theme into a temporary file, compared byte-for-byte against the input theme with `//` comment lines stripped; on mismatch the command notifies the user and writes no outputs
- [x] 2.3 Change the CLI to `node lib/extract-spec.js <theme.json> [--out-dir <dir>]`: derive output names by stripping a trailing `-rust` from the theme stem, defaulting to `palettes/<name>.json` and `spec/<name>.json`, honoring `--out-dir`, and writing files only after the self-check passes
- [x] 2.4 Update the `extract` script in `package.json` to the new invocation
- [x] 2.5 Update the README "Reverse direction" section to document the theme-in / palette+spec-out flow and the new usage

## 3. Tests

- [x] 3.1 Fixture test: `extractTheme` on `themes/github-dark-rust.json` and `themes/github-light-rust.json` returns a palette deep-equal to `palettes/github-dark.json` and `palettes/github-light.json`
- [x] 3.2 Fixture test: the derived spec deep-equals `spec/github-dark.json` and `spec/github-light.json`
- [x] 3.3 Fixture test: `buildTheme(derivedPalette, derivedSpec)` reproduces the committed theme byte-for-byte (comment-stripped, hex-normalized)
- [x] 3.4 Test that an alpha-only color is recovered: derive from a synthetic theme where `cyan` appears only as `#17e5e633`-style values and assert the palette slot is `#17e5e6`
- [x] 3.5 Test deterministic extraction: two runs on the same theme produce byte-identical palette and spec outputs
- [x] 3.6 Test failure handling: a theme that cannot be mapped to a complete valid palette (e.g. a stub theme missing role keys) raises a clear error and writes no output files; a simulated verification failure (injected broken build result) notifies the user and writes no palette or spec files
- [x] 3.7 CLI test: invoking the command with a single theme argument writes the expected palette and spec paths
- [x] 3.8 Regression: existing `test/snapshot.test.js` and `test/color.test.js` still pass unchanged

## 4. Verification

- [x] 4.1 `npm test` passes (new extraction tests + existing snapshot and color tests)
- [x] 4.2 `npm run build` regenerates all committed themes byte-identical to the checked-in files (no drift)
