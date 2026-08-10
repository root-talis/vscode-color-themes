## 1. Rust formatting layer module

- [x] 1.1 Create `lib/rust-rules.js` exporting `RUST_FORMATTING_RULES` — the theme-independent table of rust semantic formatting selectors: formatting-only (`typeParameter` bold, `namespace` italic, `struct` bold, `enumMember` bold, `type` bold, `enum` bold+italic, `interface` italic+underline, `*.consuming` bold, `*.reference` italic, `variable.mutable` underline, `keyword.async` italic) and mixed (`macro` underline, `derive` italic, `variable.consuming` bold, `const` italic), matching the committed themes exactly.
- [x] 1.2 Define `RUST_SEMANTIC_ORDER` — the committed `semanticTokenColors` key order (`string`, `comment.documentation`, `typeParameter`, `namespace`, `struct`, `enumMember`, `type`, `enum`, `interface`, `macro`, `decorator`, `derive`, `variable.consuming`, `*.consuming`, `*.reference`, `variable.mutable`, `const`, `method`, `keyword.async`).
- [x] 1.3 Implement `applyRustRules(theme, palette)` — returns a shallow-copied theme; no-op unless `palette.rust` is non-empty and the theme has `semanticTokenColors`. Emits keys in `RUST_SEMANTIC_ORDER`, appends spec-only keys afterward, merges the layer's formatting into existing entries (normalizing plain-string values to `{foreground}`, keeping the spec's color expression), and creates formatting-only entries. Property order inside mixed entries must match the committed themes (`macro` = `{underline, foreground}`, `derive`/`variable.consuming`/`const` = `{foreground, <format>}`).
- [x] 1.4 Implement `stripRustFormatting(semanticTokenColors)` — removes the layer's formatting props from each entry whose selector is in the table, drops entries left empty, and leaves plain-string entries and entries without layer props untouched.

## 2. Build pipeline integration and flag

- [x] 2.1 Compose the layer in `lib/build-themes.js buildOne`: `applyRustRules(buildTheme(palette, spec), palette)`; thread an options object through `buildOne` and `main`.
- [x] 2.2 Add `--no-rust-rules` flag parsing to `lib/build-themes.js` (recognized alongside positional theme names); when set, skip `applyRustRules`.
- [x] 2.3 Confirm `npm run build` reproduces every committed `themes/*.json` byte-for-byte (no `themes/` diff) once the specs are color-only.

## 3. Committed specs become color-only

- [x] 3.1 Rewrite `spec/github-dark.json` `semanticTokenColors` to color-only entries in committed relative order: `string`, `comment.documentation`, `macro {foreground: "pink"}`, `decorator: "pink"`, `derive {foreground: "pink"}`, `variable.consuming {foreground: "rust.consuming"}`, `const {foreground: "rust.const"}`, `method: "rust.method"`; drop the formatting-only entries and the formatting props on mixed entries.
- [x] 3.2 Rewrite `spec/github-light.json` `semanticTokenColors` with the same structure (using the light spec's expressions).
- [x] 3.3 Verify `npm run build` emits `themes/github-dark-rust.json` and `themes/github-light-rust.json` byte-identical to the committed files.

## 4. Extraction integration

- [x] 4.1 In `lib/extract-spec.js`, post-process the extracted `semanticTokenColors` with `stripRustFormatting` before assembling the spec.
- [x] 4.2 Make the rebuild self-check (`verifyRebuild`/`runExtract`) pass if either the composed build (`applyRustRules` on) or the pure build reproduces the input theme byte-for-byte; keep the existing mismatch error when neither matches.
- [x] 4.3 Confirm `node lib/extract-spec.js themes/github-dark-rust.json` and `themes/github-light-rust.json` (to a temp `--out-dir`) produce specs deep-equal to the color-only committed specs and that the rebuild self-check passes.

## 5. Tests

- [x] 5.1 Update `test/extract.test.js`: committed-spec recovery asserts the color-only specs; the rebuild-reproduces-committed-theme check uses the composed build; add a case that an extracted spec contains none of the layer's formatting props.
- [x] 5.2 Add snapshot/unit coverage for the layer: build with a rust palette adds the formatting entries (`struct` bold, `enum` bold+italic, `*.reference` italic, `variable.mutable` underline, `keyword.async` italic), merges colors for mixed entries, adds nothing when the spec has no `semanticTokenColors` or the palette has no rust section.
- [x] 5.3 Add a test that `--no-rust-rules` (or the equivalent option on the build function) yields `semanticTokenColors` with only the spec's color entries and none of the layer's formatting.
- [x] 5.4 Run `npm test` — all tests pass.

## 6. Docs and validation

- [x] 6.1 Update `README.md`: spec `semanticTokenColors` are color-only, the rust formatting layer is applied automatically for palettes with a `rust` section, and document the `--no-rust-rules` flag and its extraction-testing purpose.
- [x] 6.2 Run `openspec validate` and confirm the change validates.
