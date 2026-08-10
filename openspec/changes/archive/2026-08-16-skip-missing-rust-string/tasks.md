## 1. Suggestion provider gating

- [x] 1.1 Mark the `string` slot in `lib/suggest-rust.js` with the palette-presence flag (`requirePaletteSlot: true`), keeping its families, factor, and floor unchanged
- [x] 1.2 In `lib/suggest.js`, after `validatePalette`, build `activeSlots` by dropping flagged slots whose name is `undefined` in `palette.rust`, and resolve both the fixed-slot loop and the least-common-hue loop against `activeSlots`, passing `activeSlots` to `resolveLeastCommonHue` so a skipped slot claims no family
- [x] 1.3 In `lib/derive-palette.js`, omit `rust.string` from the derived palette when the theme's `semanticTokenColors` defines no `string` rule, so the provider gate takes effect for extraction and the generated palette never invents `string`

## 2. Tests

- [x] 2.1 Provider contract (test/suggest.test.js): `suggest('rust', palette)` still returns all six slots for every committed palette, and returns exactly `macro`, `consuming`, `const`, `method`, and `docComment` — no `string` — when `rust.string` is deleted from a committed palette
- [x] 2.2 No-claim mechanism (test/suggest.test.js): with a crafted palette whose chromatic base set is `{blue, green, red, purple, yellow}`, `docComment` throws (no unclaimed family) while `rust.string` is present, and resolves on the green hue ray once `rust.string` is removed (green becomes the only candidate)
- [x] 2.3 Determinism (test/suggest.test.js): suggesting a palette without `rust.string` twice yields byte-identical sets
- [x] 2.4 Fill merge (test/suggest-palette.test.js): merging into a palette whose `rust` section lacks `string` adds the other missing suggested slots and never adds `string`
- [x] 2.5 Fill overwrite (test/suggest-palette.test.js): overwriting a palette whose `rust` section lacks `string` writes a `rust` section without `string`
- [x] 2.6 Extraction contract (test/extract.test.js): extracting a theme without a semantic `string` rule (solarized dark/light, correia-gruvbox) derives and writes a palette whose `rust` omits `string` and keeps the other five slots; an empty or TextMate-only `semanticTokenColors` never recovers `string`

## 3. Verification

- [x] 3.1 Run `npm test` and confirm every suite passes
- [x] 3.2 Run `npm run build` and confirm the built themes still match the committed theme files byte-for-byte (snapshot suite unchanged)
- [x] 3.3 Run `npm run extract` on the solarized dark/light fixtures and confirm neither generated palette contains `rust.string`

