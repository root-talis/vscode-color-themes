## Why

The rust themes differ from their standard variants by a set of semantic-token formatting rules (bold, italic, underline on `struct`, `enum`, `*.reference`, `variable.mutable`, `keyword.async`, etc.). Today those rules are duplicated inside every spec's `semanticTokenColors`, so a new palette with a rust section must re-copy them by hand and extraction cannot tell them apart from palette-driven colors. They should be a single generated layer applied automatically when the palette declares rust rules, with a flag to turn that layer off so a theme can be reconstructed exactly from an extracted palette and spec.

## What Changes

- Identify and enumerate the rust-specific formatting rules (the non-color properties in `semanticTokenColors`: `bold`, `italic`, `underline`) that exist in `github-dark-rust` / `github-light-rust` but not in the standard GitHub variants. The `tokenColors` font styles (markup.bold, invalid italic, ...) are standard-inherited and stay untouched.
- Introduce a shared, theme-independent rust formatting table (semantic token selector -> formatting properties) in the generator.
- **BREAKING (spec format)** Strip those formatting properties from the committed specs' `semanticTokenColors`, leaving color-only entries. Formatting-only entries (`struct`, `enum`, `namespace`, `*.reference`, `variable.mutable`, ...) disappear from the specs entirely.
- The build automatically merges the rust formatting layer into `semanticTokenColors` whenever the palette has a non-empty `rust` section and the spec has a `semanticTokenColors` section. Committed `themes/*.json` remain byte-identical.
- Add a `--no-rust-rules` flag to the build CLI (`node lib/build-themes.js --no-rust-rules ...`) that excludes the layer, so the output is exactly what the palette and spec alone define.
- Extraction (`lib/extract-spec.js`) writes color-only specs: it strips the rust formatting layer before writing, and its rebuild self-check uses the rule-applying build so rust themes still round-trip byte-for-byte.
- Update snapshot and extract tests for the new spec format and the flag.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `theme-generation`: The build path gains an auto-applied rust formatting layer (conditional on the palette's rust section) and a `--no-rust-rules` exclusion flag; the spec's `semanticTokenColors` becomes color-only; the extract path strips the rust formatting layer and self-checks with the rule-applying build.

## Impact

- **Modified**: `lib/build-themes.js` (flag + arg parsing, layer application), `lib/theme.js` (rule merge / options), `lib/extract-spec.js` (strip layer on extract, rule-applying rebuild check), `spec/github-dark.json`, `spec/github-light.json` (color-only semantic entries), `test/snapshot.test.js`, `test/extract.test.js`, `README.md` (spec format + flag docs), `openspec/specs/theme-generation/spec.md`.
- **New**: `lib/rust-rules.js` (the formatting table and its merge/strip helpers).
- **Behavior preserved**: committed `themes/*.json` build byte-identically; extraction of the github fixtures still recovers the (now color-only) committed specs and still rebuilds the committed themes byte-for-byte.
