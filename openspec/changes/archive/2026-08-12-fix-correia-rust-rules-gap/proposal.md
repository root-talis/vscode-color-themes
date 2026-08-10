## Why

`correia-gruvbox-dark-rust` is generated without any rust semantics: consumed values are not bold, macros are not underlined, and consts are not italic. The base theme (`themes/correia-gruvbox.json`) and its extracted spec carry no `semanticTokenColors` section, and `applyRustRules` bails out entirely when the theme has none (`if (!theme.semanticTokenColors) return theme`), so the palette's rust colors (`macro #d3869b`, `const #d3869b`, `consuming #d4be98`, `string #d8a657`, `method #a9b665`) never reach the emitted theme either.

## What Changes

- The rust formatting layer (the bold, italic, and underline properties) is decoupled from the palette entirely: it applies unconditionally at build time, with no gate on the palette's `rust` section and no gate on the spec's `semanticTokenColors` section. It merges onto colors the spec defines and adds formatting-only entries for tokens the spec omits.
- Only color seeding is gated on the palette: when the palette declares a non-empty `rust` section, the build seeds the standard rust semantic-token colors from the palette's rust slots for tokens the spec leaves colorless, then applies the formatting layer. Colors the spec already defines are untouched (spec wins over the palette seed). A palette with no `rust` section yields no rust colors but still gets the formatting.
- `applyRustRules` stops early-returning on a missing `semanticTokenColors` section or an empty rust palette.
- `themes/correia-gruvbox-dark-rust.json` is regenerated with the full `semanticTokenColors` (formatting plus palette rust colors); the other committed `themes/*.json` stay byte-identical.
- Tests and docs updated: the "layer skipped without semanticTokenColors / without a rust palette" behaviors are replaced by "formatting always applies, colors only when the palette has a rust section"; snapshot coverage is extended to `correia-gruvbox-dark-rust`.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `theme-generation`: The "Separate Rust semantic color set" requirement changes so the build's rust semantic layer has two independent triggers — the formatting (bold/italic/underline) applies unconditionally, while the standard rust semantic colors are seeded only when the palette has a non-empty `rust` section; the spec's `semanticTokenColors` section is no longer a precondition for either.

## Impact

- **Modified**: `lib/rust-rules.js` (apply formatting unconditionally; seed standard rust colors from `palette.rust` only when the palette has a rust section; remove the no-`semanticTokenColors` and no-rust-palette early returns), `themes/correia-gruvbox-dark-rust.json` (regenerated with rust semantic colors + formatting), `test/snapshot.test.js` (replace the skip-without-STC and skip-without-rust-palette assertions; add correia coverage), `test/extract.test.js` (assert rust semantics are seeded for specs without `semanticTokenColors`), `README.md` (layer precondition wording).
- **Behavior preserved**: all other committed `themes/*.json` rebuild byte-identically; extraction of `themes/correia-gruvbox.json` still round-trips through the pure build; extraction of the regenerated correia rust theme strips the formatting layer to a color-only spec.
