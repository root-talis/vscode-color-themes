## Context

Today `generator.json` is a bare array of theme registrations `{name, spec, palette}`, read only by `lib/build-themes.js loadThemes`. The theme-independent rust formatting layer styles (semantic token selector → bold/italic/underline) are hardcoded as `RUST_FORMATTING_RULES` in `lib/rust-rules.js`, which is imported by `lib/build-themes.js`, `lib/extract-spec.js`, and the tests. See proposal.md - Why for motivation; the requirements are in `specs/theme-generation/spec.md` (delta).

## Goals / Non-Goals

**Goals:**
- `generator.json` becomes the single source of truth for both the theme registrations and the rust formatting layer styles.
- The formatting layer's styles are imported from `generator.json`'s `formatting.rust` key; nothing in code hardcodes them.
- Committed `themes/*.json` stay byte-identical; `npm run build`, `npm run extract`, and `npm test` keep passing.

**Non-Goals:**
- No change to the layer's mechanics (`RUST_SEMANTIC_ORDER`, `RUST_SEMANTIC_SLOTS`, `FORMATTING_BEFORE_FOREGROUND`, the merge/strip helpers).
- No change to palette, spec, or color-derivation formats.
- No change to the formatting values themselves — they move verbatim.

## Decisions

### D1: `generator.json` becomes `{themes, formatting: {rust}}`
The current array moves under a `themes` key; a new `formatting` object carries a `rust` subkey with the current `RUST_FORMATTING_RULES` table verbatim, preserving per-entry property order (e.g. `enum` as `{bold, italic}`).

Rationale: `themes` names the existing contents plainly; nesting the styles under `formatting.rust` keeps the config future-proof for other formatting layers without a top-level key per layer, and matches the structure chosen by the user. Alternatives considered: a flat `rustFormattingRules` top-level key — rejected as less extensible; keeping the array at top level and adding a sibling key — rejected because a single object with named keys is the cleaner committed format.

### D2: `lib/rust-rules.js` imports the styles from the config
`RUST_FORMATTING_RULES` is derived once at module load from `require('../generator.json').formatting.rust` and kept as an export, so `applyRustRules`, `stripRustFormatting`, and the tests that import `RUST_FORMATTING_RULES` continue to work unchanged. A missing `formatting.rust` key or malformed JSON fails fast at module load (build, extract, and tests all import this module).

Rationale: one load site, no plumbing of the table through callers, and the existing exports stay stable. Alternatives considered: reading the config in `build-themes.js` and passing the table into `applyRustRules` — rejected, because `stripRustFormatting` and the extract path need the same table and every caller would have to fetch it.

### D3: `lib/build-themes.js loadThemes` reads `config.themes`
The only change in the build CLI is reading the registrations from the `themes` key instead of treating the file as the array.

Rationale: minimal diff; theme registration semantics are unchanged.

### D4: Only the styles table moves to config
`RUST_SEMANTIC_ORDER`, `RUST_SEMANTIC_SLOTS`, `RUST_SEMANTIC_FOREGROUND_KEYS`, and `FORMATTING_BEFORE_FOREGROUND` stay in code. These encode ordering and merge behavior that reproduces the committed themes byte-for-byte; moving them would be data/behavior mixing for no user-facing gain.

Rationale: the config carries the reviewable "what formatting applies" data; the code carries the "how it's applied" mechanics. Alternatives considered: moving the whole layer (order + slots + styles) into config — rejected, larger and noisier config for no functional difference.

## Risks / Trade-offs

- **Byte-exactness depends on config property order** → The `formatting.rust` entries are copied verbatim from the current literal (JSON key order is preserved on parse), and the snapshot tests assert byte-identical themes; any divergence fails `npm test`.
- **Config format is breaking** → `generator.json` is a committed, tool-only config; the build, extract, and test flows all read it through the same two load points, so the change is contained. README updated to document the new shape.
- **Module-load failure on bad config** → `require('../generator.json')` fails loudly on malformed JSON or a missing `formatting.rust`; this is desirable fail-fast and is caught by every test run.
