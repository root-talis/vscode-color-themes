## Why

Extraction recovers a base palette and a rust semantic set from a theme's own colors, but a theme that defines no rust semantic colors produces no `rust` section, so the built theme lacks readable, hue-consistent semantic colors. The extractor should be able to suggest a language's semantic color set from the extracted palette alone, so arbitrary themes get a coherent and legible semantic layer. The suggestion logic is language-shaped (Rust has six slots; other languages differ), so it must be structured to admit new languages as modules.

## What Changes

- Add a language-agnostic suggestion algorithm that generates a semantic color for a slot from the extracted palette, honoring hue (family matching) and a contrast target expressed relative to the palette's chromatic center colors.
- Add a Rust suggestion module registering the six rust semantic slots (`string`, `docComment`, `macro`, `consuming`, `const`, `method`) with their preferred hue families and contrast factors, following the safe/harmonious "borrow" convention.
- Add a suggestion registry keyed by language so future languages (Go, Python, TypeScript, ...) add a config module and one registry entry without touching the algorithm.
- Make the extract path able to fill a palette's `rust` section from suggestions when the theme defines no rust colors, behind an opt-in flag.

## Capabilities

### New Capabilities
- `semantic-color-suggestion`: Suggesting a language semantic color set from an extracted base palette, by matching each slot to a hue family and generating a color whose contrast against the background is relative to that family's chromatic center.

### Modified Capabilities
- `theme-generation`: The extract command's palette output gains an opt-in mode that seeds the `rust` section from `semantic-color-suggestion` when the theme defines no rust semantic colors, instead of emitting an empty `rust` section.

## Impact

- New files: `lib/suggest.js` (registry + shared algorithm), `lib/suggest-rust.js` (Rust slot configuration).
- Modified: `lib/extract-spec.js` (opt-in flag wiring), its CLI usage, and tests.
- No change to committed palette/spec byte-exactness: the flag is opt-in and default extraction output is unchanged.
- No new dependencies; color math reuses `lib/color.js`.
