## Why

The suggestion provider always returns a `string` rule for rust, even when the palette being suggested for does not define `rust.string` in its rust section. A palette may intentionally omit `rust.string` (the theme already colors strings through TextMate rules, or the semantic string rule is not wanted), and the build already tolerates rust slots missing from the palette. The suggestion provider should respect that omission: it must not invent a `rust.string` rule the palette does not include.

## What Changes

- The rust suggestion module's `string` slot is suggested only when the palette's `rust` section already defines `string`.
- When the palette's `rust` section is absent, empty, or lacks `string`, the suggested set omits `string` and still includes every other registered rust slot (`macro`, `consuming`, `const`, `method`, `docComment`).
- A skipped `string` slot takes no part in suggestion: it does not claim its preferred family for the least-common-hue assignment, so `docComment` selection is computed over the slots that are actually suggested.
- The filter lives in the suggestion provider (`suggest`), so every caller — extraction and the palette suggestion-fill command — honors it. The fill command's merge therefore never adds `string` to a palette that lacks it.
- Extraction honors the same omission: derivation omits `rust.string` whenever the theme defines no semantic `string` rule (the theme colors strings through TextMate rules, or not at all), so the generated palette never invents it.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `semantic-color-suggestion`: the rust `string` slot is suggested only when the palette's `rust` section already defines it; a skipped slot claims no family for the least-common-hue assignment.

## Impact

- **Modified**: `lib/suggest.js` — `suggest()` filters the rust `string` slot against the palette's `rust` section before processing slots.
- **Modified**: `lib/suggest-rust.js` — marks the `string` slot as conditional on the palette's `rust.string` presence.
- **Modified**: `lib/derive-palette.js` — derivation omits `rust.string` when the theme defines no semantic `string` rule, so the provider gate is reachable from extraction.
- **Tests**: `test/suggest.test.js` (provider behavior with and without `rust.string`), `test/suggest-palette.test.js` (fill never adds `string` to a palette that lacks it), `test/extract.test.js` (extraction never fabricates `string` for a theme without a semantic string rule).
- **No change** to committed `themes/`, `spec/`, `palettes/`, or `generator.json`: every committed built theme defines a semantic `string` rule, so the suggested set and extraction output for the committed rust themes are unchanged. Themes that color strings only through TextMate rules (solarized dark/light, correia-gruvbox) now extract without `rust.string`.
- No new dependencies.
