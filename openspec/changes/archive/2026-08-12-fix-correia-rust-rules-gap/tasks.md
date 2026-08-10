## 1. Core Implementation

- [x] 1.1 Add the `RUST_SEMANTIC_SLOTS` map to `lib/rust-rules.js` (standard rust semantic key → palette rust slot, mirroring the `github-{dark,light}` spec shapes: `string`→`string`, `comment.documentation`→`docComment`, `macro`→`macro`, `decorator`→`macro`, `derive`→`macro`, `variable.consuming`→`consuming`, `const`→`const`, `method`→`method`, with `macro`/`derive`/`variable.consuming`/`const` as `{ foreground }` entries and the rest plain strings)
- [x] 1.2 Restructure `applyRustRules` in `lib/rust-rules.js`: remove both early returns (`!palette.rust` and `!theme.semanticTokenColors`); start from `{ ...(theme.semanticTokenColors || {}) }`; seed each mapped key that is absent and whose palette rust slot exists (raw hex from `palette.rust`) only when `palette.rust` is non-empty, never overwriting spec-defined entries; then run the formatting merge unconditionally over `RUST_SEMANTIC_ORDER` so the emitted theme always has a `semanticTokenColors` section
- [x] 1.3 Regenerate all themes with `node lib/build-themes.js` and confirm `git diff` shows only `themes/correia-gruvbox-dark-rust.json` changed, with the new `semanticTokenColors` block matching the github themes' structure (key order per `RUST_SEMANTIC_ORDER`; `variable.consuming` bold, `macro` underlined, `const` italic, colors from the correia palette's rust slots)

## 2. Tests and Docs

- [x] 2.1 Update `test/snapshot.test.js`: replace the "rust layer is skipped without a rust palette or semanticTokenColors (5.2)" test with two assertions — a rust palette with a spec lacking `semanticTokenColors` yields seeded colors plus formatting, and a palette with no `rust` section yields formatting merged onto the spec's entries with no seeded colors; add `correia-gruvbox-dark-rust` (spec `spec/correia-gruvbox.json`, palette `palettes/correia-gruvbox.json`) to `THEMES` so the built theme is locked against the committed file
- [x] 2.2 Update `test/extract.test.js`: add a test that a spec without a `semanticTokenColors` section, built with a rust palette, emits seeded standard rust tokens (e.g. `macro` `{ underline, foreground }`, `const` `{ foreground, italic }`, `variable.consuming` `{ foreground, bold }`), that spec-defined colors are not overridden, and that formatting (bold/italic/underline) is applied even with a rust-less palette while no colors are seeded
- [x] 2.3 Update the README rust-layer paragraph: drop the "palette has a `rust` section and the spec has a `semanticTokenColors` section" precondition; document that the formatting layer applies on every build while a non-empty palette `rust` section additionally seeds the standard rust semantic colors when the spec leaves them colorless

## 3. Reconciliation and Verification

- [x] 3.1 Update the open `auto-apply-rust-formatting-rules` delta scenarios ("No layer without a rust palette" and "Rust palette enables formatting layer") so they no longer state that a missing spec `semanticTokenColors` section or a rust-less palette suppresses the formatting layer, keeping the two deltas coherent at archive time
- [x] 3.2 Run `npm test` — all tests green, including the regenerated correia snapshot and the extraction round-trips (base correia via pure build, regenerated rust theme via composed build)
- [x] 3.3 Run `openspec validate --change fix-correia-rust-rules-gap` (and `openspec validate`) — green
