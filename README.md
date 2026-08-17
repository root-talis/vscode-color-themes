# GK Semantic color themes

A collection of semantic color themes, each with custom semantic fixes:

   - GitHub:
      - GitHub Dark
      - GitHub Light
      - GitHub Dark (Tomorrow Night palette)
      - GitHub Light (Tomorrow palette)
      - GitHub Dark (Gruvbox Dark palette)
      - GitHub Light (Gruvbox Light palette)
   - Solarized (dark and light)
   - Correia (gruvbox, github+gruvbox, github+everforst)
   - Catppuccin (Frappe, Latte, Macchiato, Mocha)

Currently supported languages for semantic formatting:

   - Rust

## How a theme is made

Two files make a theme:

- `palettes/<name>.json` supplies the colors.
- `spec/<name>.json` decides which color each VS Code setting gets.

The build script `npm run build` joins them. It reads a spec, loads its palette, and resolves every expression into a hex color. The result goes to `themes/<name>-rust.json`. `generator.json` lists every theme: its `themes` key holds the registrations (each a `name`, a `spec`, and a `palette`), and its `formatting.rust` key holds the formatting layer styles. See `lib/build-themes.js` for the build logic.

A spec's `semanticTokenColors` hold colors only. The rust formatting rules (the `bold`, `italic`, and `underline` properties on `struct`, `enum`, `*.reference`, `variable.mutable`, `keyword.async`, and the other rust selectors) are a single generated layer. The styles live in config, under `formatting.rust` in `generator.json`; `lib/rust-rules.js` applies them but does not hardcode them. The build merges that layer into `semanticTokenColors` on every build, so every theme carries the same formatting without duplicating it in the specs. When the palette has a non-empty `rust` section, the build additionally seeds the standard rust semantic colors from the palette's rust slots (for example `macro` from `rust.macro`, `const` from `rust.const`) for tokens the spec leaves colorless; colors the spec already defines are untouched.

A spec never stores hex colors. It stores expressions over palette slots:

- `bg`, `red`, `rust.string` - a palette slot. The build uses the slot's hex.
- `red.d5`, `fg.d17` - a derived token. The spec's `derived` section defines each one as a slot plus a shift in OKLab color space. See `lib/resolve.js` and `lib/color.js`.
- `cyan@33`, `green.d3@30` - an alpha suffix. The two hex digits set opacity.
- `#ffffff` - a literal hex, used as-is.

The palette is the ink. The spec is the design. Change the ink, and every theme that uses that palette changes with it.

## Add a new palette

1. Create `palettes/<name>.json`. Give it `type` (`"dark"` or `"light"`), a `base` section with exactly 16 colors, and a `rust` section with the Rust semantic colors. Every value is a 6-digit hex. See `palettes/github-dark.json` for a full example.
2. Use the same slot names the spec references. The `github-dark` spec uses `bg`, `bg-muted`, `fg`, `fg-muted`, `border`, `blue`, `green`, `red`, `orange`, `purple`, and the `rust.*` slots. If a name is missing, the build fails with `unknown color expression`.
3. Register the theme in `generator.json`. Add an entry to the `themes` key that pairs your palette with a spec. One spec can serve many palettes; `tomorrow-night` and `gruvbox-dark` both reuse the `github-dark` spec.
4. Register the theme in `package.json` under `contributes.themes` so VS Code lists it.
5. Run `npm run build` to write all themes, or `node lib/build-themes.js <name>` to write just one.
6. Run `npm test` to check that the built theme matches the committed file.

To emit exactly what the palette and spec alone define, with none of the rust formatting layer, pass `--no-rust-rules`: `node lib/build-themes.js <name> --no-rust-rules`. This is how extraction testing reconstructs a theme from an extracted palette and spec to check how well extraction worked.

To point either CLI at a different `generator.json` than the root one, pass `--config <path>`: `node lib/build-themes.js <name> --config test/fixtures/generator.json` or `node lib/extract-spec.js <theme.json> --config test/fixtures/generator.json`. Theme and palette paths in that config resolve relative to the config file's directory, so the same file layout works at any root.

## Reverse direction: extract palette and spec from a theme

If you have a finished theme, `npm run extract` works backwards. It derives the palette from the theme alone (the 16 base colors plus the Rust semantic set, recovered from theme role anchors) and then maps each theme color to the nearest palette slot, storing the distance in OKLab space as a `derived` token. Because role anchors are structural, extraction reassigns the 8 chromatic slots (`blue`, `green`, `red`, `orange`, `yellow`, `purple`, `pink`, `cyan`) to the closest palette color by distance in OKLab space, so a derived palette's slot names match its colors. It writes `palettes/<name>.json` and `spec/<name>.json`, stripping a trailing `-rust` from the theme name. Extracted specs are color-only: the rust formatting layer is stripped before the spec is written.

```
node lib/extract-spec.js themes/github-dark-rust.json
node lib/extract-spec.js themes/github-light-rust.json --out-dir out/
```

Extraction self-checks its work: it rebuilds the theme from the derived palette and spec and compares it byte-for-byte against the input before writing anything. The check passes if either the rule-applying build or the pure build reproduces the input, so rust themes round-trip through the formatting layer while color-only themes round-trip through the pure build. If the rebuilt theme diverges, the command reports where and writes no output files. See `lib/derive-palette.js` for the role-anchor table and `lib/extract-spec.js` for the CLI.

