## 1. Suggestion algorithm

- [x] 1.1 Create `lib/suggest.js` with a language registry: `register(module)` and `suggest(language, palette)`, where requesting an unregistered language fails with a clear error naming the language and registered languages
- [x] 1.2 Validate the palette before suggesting by reusing `validatePalette` from `lib/palette.js`; reject invalid palettes with the existing error style
- [x] 1.3 Implement the shared family lookup: for a slot's ordered family list, use the palette's chromatic center of the first family, preserving its LAB hue and chroma
- [x] 1.4 Implement the relative-contrast lightness solve: bisect lightness in LAB (keeping the center's `a,b`) so `contrast(color, bg)` equals `max(centerContrast * factor, floor)`, clamping to the sRGB gamut, and returning the center itself when the target equals the center's contrast
- [x] 1.5 Implement the least-common-hue strategy: among families not claimed by earlier slots, pick the one with the fewest unclaimed families within a 30-degree hue tolerance, tie-breaking toward the blue family at 210 degrees, then apply the lightness solve against that family's center
- [x] 1.6 Assign slots in registration order so family claims are deterministic and the least-common-hue slot resolves last

## 2. Rust suggestion module

- [x] 2.1 Create `lib/suggest-rust.js` registering the `rust` language with the six slots in order: `string` (`[green, yellow]`), `macro` (`[purple, pink]`), `consuming` (`[red]`), `const` (`[yellow, orange]`), `method` (`[blue, cyan]`), then `docComment` (least-common-hue strategy), each with factor and floor (text slots 3.5, `docComment` 0.75 factor and 3.0 floor, others factor 1.0)
- [x] 2.2 Register `lib/suggest-rust.js` in the `lib/suggest.js` registry

## 3. Extract integration

- [x] 3.1 Fill the derived palette's `rust` section from `suggest('rust', palette)` on every extraction run, keeping the base palette, the spec, and the byte-exact rebuild self-check unchanged
- [x] 3.2 Remove the `--suggest-rust` flag from `parseArgs` and the CLI usage text in `lib/extract-spec.js`
- [x] 3.3 Express every `colors` and `tokenColors` color in the derived spec as a base-slot reference (never `rust.*`), keeping `rust.*` references only in `semanticTokenColors`, so rebuilding a theme with the suggested-rust palette changes only the semantic colors

## 4. Tests

- [x] 4.1 Test registry behavior: registered language returns all six rust slots; unregistered language errors with the language and registered languages named
- [x] 4.2 Test palette validation: missing base slot or non-hex color is rejected with a clear error
- [x] 4.3 Test borrow identity against the six committed palettes: with factor 1.0, every fixed slot whose family center contrast meets the 3.5 floor equals its family center; where the floor is not met (tomorrow `const`, gruvbox-light `string`/`const`) the suggestion is rescued to 3.5:1 keeping the family hue, so the committed fixed-slot colors are reproduced exactly wherever their centers meet the floor
- [x] 4.4 Test the floor rescue: github-light `const` (yellow center 2.13:1) is suggested at 3.5:1 keeping the yellow hue
- [x] 4.5 Test least-common-hue determinism: `docComment` resolves to the `cyan` family on the six committed palettes and is stable across repeated calls
- [x] 4.6 Test determinism: suggesting the same palette twice yields byte-identical output
- [x] 4.7 Test extraction end-to-end: the derived palette's `rust` section always holds the six suggested colors while the base palette and spec deep-equal today's committed palette and spec

## 5. Verification

- [x] 5.1 Run `npm test` and confirm all suites pass
- [x] 5.2 Run the extract command on a committed theme and confirm the byte-exact rebuild self-check passes
