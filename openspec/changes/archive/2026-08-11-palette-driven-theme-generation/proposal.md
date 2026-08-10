## Why

Each theme currently hardcodes ~180 workbench colors, 49 TextMate rules, and 19 semantic token rules in a 51KB JSONC file. There is no way to change the color palette and get a coherent theme — every color must be edited by hand. The goal is to drop any palette into a script and get a new theme that follows the same semantic rules, while reproducing the current themes byte-exactly.

## What Changes

- Add palette files (`palettes/`) holding a 16-color base set plus a separate Rust semantic color set, for each of dark and light.
- Add a theme spec (`spec/`) per theme: the theme structure (colors / tokenColors / semanticTokenColors) where color values are expressions (`"blue.d1"`, `"blue.d1@44"`) referencing the palette.
- Add a Node.js build script that resolves palette + spec into a theme JSON file.
- Add a bootstrap extractor that derives the spec from the current themes by computing LAB color-space vector offsets from the nearest palette color to each target color.
- Derivation is **absolute LAB vector offsets** (not relative recipes): the extracted spec reproduces the current themes byte-exactly, with zero drift.
- Rule tables are **auto-extracted and independent per theme** — dark and light may map the same key to different palette slots.
- Add snapshot tests pinning the current theme files, plus unit tests for the color math.
- Regenerated theme files drop the ~750 commented-out JSONC entries; snapshot comparison strips comments from the current files.
- Add npm scripts (`build`, `extract`, `test`) using the built-in `node --test` runner — no new dependencies.

## Capabilities

### New Capabilities
- `theme-generation`: Palette-driven theme generation — palette format, spec expression grammar, LAB vector-offset derivation, per-theme auto-extracted rule tables, and the byte-exact reproduction contract.

### Modified Capabilities
- None. `openspec/specs/` is empty; existing behavior (the semantic token adjustments documented in the repo-root `SPEC.md`) is preserved as data by this change, not modified.

## Impact

- **New files**: `palettes/{github-dark,github-light}.json`, `spec/{github-dark,github-light}.json`, `lib/` (color, palette, resolve, theme, extract-spec, build-themes), `test/` (color, snapshot).
- **Modified**: `package.json` (scripts), `themes/*.json` (regenerated, byte-identical to current content minus commented lines).
- **Behavior preserved**: current theme output is reproduced byte-exactly (snapshot-tested).
- **No dependencies added**; Node v24 `node --test` only.
