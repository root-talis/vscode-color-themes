## Context

See proposal.md - Why. The rust semantic layer lives in `lib/rust-rules.js` (`RUST_FORMATTING_RULES`, `RUST_SEMANTIC_ORDER`, `applyRustRules`, `stripRustFormatting`), composed in `lib/build-themes.js` as `applyRustRules(buildTheme(palette, spec), palette)`. Today the layer is a single block gated twice: `if (!palette.rust || Object.keys(palette.rust).length === 0) return theme` and `if (!theme.semanticTokenColors) return theme`. `spec/correia-gruvbox.json` (extracted from `themes/correia-gruvbox.json`, which carries no `semanticTokenColors`) therefore emits no semantic tokens at all, and the palette's `rust` slots (`palettes/correia-gruvbox.json`: `string #d8a657`, `docComment #928374`, `macro #d3869b`, `consuming #d4be98`, `const #d3869b`, `method #a9b665`) never reach the theme. The `github-dark`/`github-light` specs define `semanticTokenColors` for all eight standard rust keys, so only the correia build is affected. The current delta spec (auto-apply-rust-formatting-rules) encodes the old gate as scenarios. Requirements are in `specs/theme-generation/spec.md` (delta).

## Goals / Non-Goals

**Goals:**
- The formatting layer (bold/italic/underline) is unconditional: it merges on every build, with no gate on the palette's `rust` section and no gate on the spec's `semanticTokenColors` section.
- The palette's `rust` section is the single source of the standard rust semantic colors: the build seeds them (when the spec leaves them colorless) only when the section is non-empty.
- Committed `themes/*.json` other than `correia-gruvbox-dark-rust.json` stay byte-identical; the correia theme gains the rust semantics.

**Non-Goals:**
- No change to the color-bearing semantic entries the specs already define (spec wins over the seed).
- No change to `RUST_FORMATTING_RULES`, `RUST_SEMANTIC_ORDER`, extraction stripping, or the `--no-rust-rules` flag's contract (flag output = exactly palette + spec alone, i.e. the whole layer excluded).

## Decisions

### D1: Split the layer into an unconditional formatting merge and a palette-gated color seed
`applyRustRules(theme, palette)` becomes two effects:

1. **Formatting (unconditional):** drop both early returns. Start from `{ ...(theme.semanticTokenColors || {}) }`, run the existing merge over `RUST_SEMANTIC_ORDER` (formatting merges onto existing entries, formatting-only entries are created for tokens the spec omits), and emit a `semanticTokenColors` section.
2. **Color seed (gated on the palette):** before the merge, if `palette.rust` is non-empty, seed each standard rust key that is absent from the spec's entries from its palette rust slot, using exactly the shapes the `github-{dark,light}` specs use — plain-string entries (`string` → `rust.string`, `comment.documentation` → `rust.docComment`, `decorator` → `rust.macro`, `method` → `rust.method`) and `{ foreground }` entries (`macro` → `rust.macro`, `derive` → `rust.macro`, `variable.consuming` → `rust.consuming`, `const` → `rust.const`). The seed fills only absent keys, so spec-defined entries are never overwritten. Palette slots absent from `palette.rust` are skipped, so hand-written partial rust sections still build.

The two effects live in the one `RUST_SEMANTIC_SLOTS` map + one function so the `--no-rust-rules` exclusion stays a single switch. Alternatives considered: (a) hand-adding a `semanticTokenColors` section to `spec/correia-gruvbox.json` — rejected: the spec is a generated artifact extracted from a theme that genuinely has no semantic tokens, so the section would be lost on regeneration and drift; (b) gating formatting on the palette as today — rejected: that is the reported bug, and formatting is a fixed property of the theme variants, not palette-dependent.

### D2: Byte-exactness for the committed github themes is preserved by construction
Every seeded key is already present in the `github-{dark,light}` specs' `semanticTokenColors`, and their palettes have non-empty rust sections, so seeding adds nothing there; the unconditional formatting merge reproduces the existing merged output (verified by simulation: `JSON.stringify` of the corrected build equals the current build's output for the github themes). For the correia build the seeded entries take the same shapes and `RUST_SEMANTIC_ORDER` ordering the github themes use, so the regenerated `themes/correia-gruvbox-dark-rust.json` has the same structure as the other rust themes (verified by simulation: `macro {underline, foreground}`, `const {foreground, italic}`, `variable.consuming {foreground, bold}`). Property placement inside mixed entries follows the existing `FORMATTING_BEFORE_FOREGROUND` table, so byte-exactness rules from the auto-apply design (D3) hold unchanged.

### D3: Extraction and the exclusion flag are unaffected
- The base `themes/correia-gruvbox.json` extraction round-trips through the pure `buildTheme` path of the adaptive self-check (`verifyRebuild` tries the composed build, then the pure build), so it still passes and the extracted spec stays colorless.
- Extracting the regenerated `themes/correia-gruvbox-dark-rust.json` strips the layer (`stripRustFormatting`) to a color-only `semanticTokenColors` referencing the palette's rust slots — the same shape the github specs use — and round-trips through the composed build.
- `--no-rust-rules` skips the whole layer (formatting + seed), so its output is exactly palette + spec alone, matching its documented purpose.

### D4: Test and doc updates match the new triggers
The snapshot test "rust layer is skipped without a rust palette or semanticTokenColors (5.2)" asserts both old early returns and must be replaced with two assertions: a rust palette with a spec lacking `semanticTokenColors` yields seeded colors + formatting (the correia case), and a palette with no rust section yields formatting merged onto the spec's entries with no seeded colors. Snapshot `THEMES` gains `correia-gruvbox-dark-rust` (spec `spec/correia-gruvbox.json`, palette `palettes/correia-gruvbox.json`) so the fixed output is locked in. README's "build applies that layer automatically whenever the palette has a `rust` section and the spec has a `semanticTokenColors` section" is reworded: formatting applies on every build; the palette's rust section only supplies the standard rust semantic colors when the spec leaves them colorless.

## Risks / Trade-offs

- **In-flight delta contradiction** → the open `auto-apply-rust-formatting-rules` delta encodes the old gates ("or the spec has no `semanticTokenColors` section THEN the build adds no rust formatting entries" and its "Rust palette enables formatting layer" scenario). If both changes archive without reconciliation, the main spec gets contradictory scenarios. Mitigation: tasks include updating that change's delta scenarios to the new triggers before this change archives (apply/archive order noted in tasks).
- **Formatting now reaches specs without rust palettes** → any theme whose spec has `semanticTokenColors` but whose palette has no rust section gains the formatting properties (e.g. `macro` gains underline) and a theme with neither gains formatting-only entries. That is the requested behavior; no committed theme is affected (all committed palettes have rust sections), and the snapshot suite guards the committed set.
- **Partial rust palettes** → slots missing from `palette.rust` are skipped, leaving those tokens colorless; the validation error path is unchanged. Documented; not a regression since `derivePalette` always emits all six rust slots.
- **`--no-rust-rules` users of correia** → output now differs from the default build by the whole semantic layer, exactly as the flag promises; no committed file depends on it.

## Migration Plan

1. Restructure `applyRustRules` in `lib/rust-rules.js`: remove both early returns; add `RUST_SEMANTIC_SLOTS`; seed absent standard rust keys from a non-empty `palette.rust`, then run the unconditional formatting merge.
2. Regenerate themes with `node lib/build-themes.js`; confirm `git diff` shows only `themes/correia-gruvbox-dark-rust.json` changed and the new semantic block matches the github themes' structure.
3. Update `test/snapshot.test.js` (replace the skip assertions, add correia to `THEMES`) and `test/extract.test.js` (assert seeding for a spec without `semanticTokenColors`; assert formatting applies without a rust palette).
4. Update README wording.
5. Reconcile the open `auto-apply-rust-formatting-rules` delta scenarios with the new triggers.
6. `npm test` green; `openspec validate` green.

Rollback: revert `lib/rust-rules.js` and the regenerated `themes/correia-gruvbox-dark-rust.json`; previous build reproduces all committed themes unchanged.
