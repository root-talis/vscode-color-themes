## Why

The least-common-hue strategy can pick a near-neutral chromatic family for `docComment`, producing a color indistinguishable from the regular comment color. The solarized-light palette hits this: its `pink` slot is a gray (`#657b83`), so the suggested `docComment` resolves to `#7a9199` — a gray of nearly the same lightness as the theme's comment color. The github palettes pass because their `docComment` is genuinely chromatic (hue difference), and solarized-dark passes because its `docComment` is far lighter than the comment. Solarized-light passes on neither axis.

## What Changes

- The least-common-hue slot strategy keeps its current family selection (unclaimed, fewest hue neighbors within 30 degrees, blue tie-break) but adds a distinctness guard: the suggested color must differ from the palette's `fg-muted` slot (the regular comment color) by at least a fixed minimum chroma OR a fixed minimum lightness.
- When the top candidate fails the guard, the resolver moves to the next candidate in the selection order; the first candidate that passes is used. If no candidate passes, the top candidate is kept as a fallback.
- The guard is opt-in per slot: the rust `docComment` slot declares `distinctFrom: "fg-muted"`, keeping the provider language-agnostic.
- Output changes only for palettes where the previous suggestion is too similar to the comment color. Today that is exactly `solarized-light`: its suggested `docComment` moves off the gray `pink` family onto the teal `cyan` family. Every other committed palette keeps its current `docComment` byte-for-byte.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `semantic-color-suggestion`: the least-common-hue slot strategy gains a distinctness guard against the palette's muted foreground.

## Impact

- **Modified**: `lib/suggest-rust.js` — the `docComment` slot declares `distinctFrom: "fg-muted"`.
- **Modified**: `lib/suggest.js` — `resolveLeastCommonHue` applies the distinctness guard and falls back through the candidate order.
- **Changed output**: `palettes/solarized-light.json` (`docComment`) and the built `themes/gk-semantic_solarized-light.json` (`comment.documentation`).
- **Tests**: `test/suggest.test.js` (guard behavior, candidate fallback, determinism, unchanged committed outputs), plus the palette-fixture tests.
- No new dependencies.
