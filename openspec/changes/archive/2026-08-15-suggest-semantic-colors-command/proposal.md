## Why

The suggestion provider can compute a language's semantic color set from a palette, but there is no CLI to apply those suggestions to a palette file. Palettes whose per-language semantic colors are missing, stale, or incomplete must be edited by hand. A command that fills missing semantic colors from the current suggestion registry — asking what to do when a language's colors already exist — closes that gap.

## What Changes

- Add a CLI command (`npm run suggest`) that takes a palette file, validates it, and fills its per-language semantic color sections using the language suggestion provider.
- By default the command fills every language registered in the suggestion registry (today: `rust`); a `--language <name>` flag targets a single language instead.
- When a language's section already has colors, the command interactively asks the user to skip the language, overwrite its colors, or merge (insert only the missing colors) — unless a conflict flag or a non-interactive stdin determines the behavior.
- Non-interactive behavior: merge by default; `--conflict-skip` leaves existing colors untouched; `--conflict-overwrite` replaces the language's entire color set.
- The palette is written back in place, formatted as 2-space JSON like the committed palettes. An invalid palette fails with a clear error and nothing is written.

## Capabilities

### New Capabilities
- `palette-suggestion-fill`: Filling a palette file's per-language semantic color sections from the language suggestion provider, with interactive or flag-driven conflict resolution.

### Modified Capabilities
None.

## Impact

- New file `lib/suggest-palette.js` implementing the CLI.
- New `suggest` script entry in `package.json`.
- New tests under `test/`.
- Reuses `lib/suggest.js` (language registry and suggestion algorithm) and `lib/palette.js` (`loadPalette` / `validatePalette`).
- No new dependencies; the interactive prompt uses Node's built-in `readline`.
- No change to existing build or extract behavior or to committed palette/spec/theme outputs.
