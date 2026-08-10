## Why

A palette's `rust` section can omit a slot that the spec references, either directly (`macro` → `rust.macro`) or through a derived token whose `ref` is a rust slot (for example `editor.findMatchBackground` → `rust.string.d0` → `rust.string`). The build then throws `derived token ${token} references unknown slot ${ref}` and produces no theme at all. A single missing rust slot should not block a theme that is otherwise buildable: the unresolvable color should be dropped while the theme still builds.

## What Changes

- When a color reference in `semanticTokenColors`, `colors`, or `tokenColors` targets a slot absent from the palette's `rust` section, the build no longer throws.
- `semanticTokenColors`: the affected entry keeps the rust formatting layer — if the token has a rule in `generator.json`'s `formatting.rust`, the theme emits the entry with its formatting properties and no color; if the token has no formatting rule, the entry is omitted entirely.
- `colors`: the key whose color references the missing slot is omitted; every other key resolves exactly as today.
- `tokenColors`: the entry loses the unresolvable property; if it is left with no settings, the entry is omitted. All other entries resolve exactly as today.
- All other entries in every section resolve and receive the formatting layer exactly as today; the layer is not disabled by a missing slot.
- The tolerance triggers only on a missing slot. Malformed expressions and resolution errors other than a missing slot still fail the build with the current error.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `theme-generation`: the build SHALL tolerate color references in `semanticTokenColors`, `colors`, and `tokenColors` that target a rust slot missing from the palette, dropping the unresolvable color instead of failing the build.

## Impact

- **Modified**: `lib/theme.js` — `buildTheme` resolves `semanticTokenColors`, `colors`, and `tokenColors` without failing on a missing-slot reference.
- **Modified**: `lib/resolve.js` — the missing-slot failure mode is surfaced to the caller in a distinguishable way (`MissingSlotError`) so the three sections can drop the color while other errors keep throwing.
- **Modified**: `test/missing-rust-slots.test.js` — tests for the missing-rust-slot behavior, including an end-to-end build from the real `palettes/github-dark.json` with a rust slot removed.
- **Untouched**: committed `themes/`, `spec/`, `palettes/`, `generator.json`; byte-for-byte output for complete palettes is unchanged.
