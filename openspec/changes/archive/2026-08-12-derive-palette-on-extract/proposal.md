## Why

The extract command today demands a palette as input (`node lib/extract-spec.js <theme.json> <palette.json> <out.json>`), so you cannot reverse a theme unless you already know its ink. The palette should be an output of extraction, not an input: point the command at a theme and it should recover both the palette and the spec that rebuild it.

## What Changes

- **BREAKING** `extract-spec.js` no longer accepts a palette argument. The CLI becomes `node lib/extract-spec.js <theme.json> [--out-dir <dir>]`, deriving the palette from the theme itself and writing `<name>.palette.json` and `<name>.spec.json` (theme name with a trailing `-rust` stripped, following the repo's `palettes/` + `spec/` convention).
- Add a palette-recovery step that reads the theme's structure: it collects every distinct RGB color (alpha bytes stripped, so colors that only appear with transparency such as `cyan` are recoverable) and assigns the 16 base + 6 Rust slot colors from theme role anchors (theme `type`-aware, because the per-theme rule tables legitimately assign the same key to different slots in dark vs. light).
- The derived palette is validated against the same rules as a hand-written palette (16 base slots, 6 Rust slots, valid 6-digit hex), then fed unchanged into the existing nearest-slot extraction so the derived spec follows automatically.
- Extraction self-checks its work: after deriving palette + spec, it rebuilds the theme into a temporary file and validates it byte-for-byte against the input theme; on mismatch it notifies the user and writes no outputs.
- Test suite gains fixture tests: for `github-dark` and `github-light`, extraction must recover the committed palette and spec **exactly**, and the rebuilt theme must match the committed theme byte-for-byte.
- **BREAKING** `npm run extract` invocation changes: it now takes a theme path (and optional out-dir) instead of theme + palette + out.
- No new dependencies; still plain Node.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `theme-generation`: The extract path changes from "given theme + palette, emit a spec" to "given a theme, emit the palette and the spec". This is a spec-level behavior change to the existing "Auto-extracted, per-theme rule tables" requirement and adds a new "palette derived from theme" requirement plus the exact-recovery fixture contract.

## Impact

- **Modified**: `lib/extract-spec.js` (CLI + entry point), `package.json` (`extract` script), `test/snapshot.test.js` or a new `test/extract.test.js` (fixture recovery tests), and `openspec/specs/theme-generation/spec.md`.
- **New**: `lib/derive-palette.js` (palette recovery), optional CLI test.
- **Behavior preserved**: the build path (`palette + spec → theme`) is untouched; committed themes still rebuild byte-for-byte; existing snapshot and color tests keep passing.
- **Fixture ground truth**: `palettes/github-{dark,light}.json`, `spec/github-{dark,light}.json`, `themes/github-{dark,light}-rust.json` become the recovery fixtures.
