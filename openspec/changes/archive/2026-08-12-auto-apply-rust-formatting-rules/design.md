## Context

Today the committed specs (`spec/github-dark.json`, `spec/github-light.json`) carry the full `semanticTokenColors` — both the color expressions and the rust formatting rules (bold/italic/underline) — copied verbatim from the committed themes. The build (`lib/theme.js buildTheme`) is a pure spec→theme resolver; the extract path (`lib/extract-spec.js`) copies `semanticTokenColors` as-is and self-checks with the same pure build. The standard GitHub variants (primer/github-vscode-theme) ship no `semanticTokenColors` at all, so every semantic formatting entry is rust-specific; the `tokenColors` font styles are standard-inherited and stay in the specs.

See proposal.md - Why for motivation. The requirements are in `specs/theme-generation/spec.md` (delta).

## Goals / Non-Goals

**Goals:**
- A single, theme-independent table of the rust semantic formatting rules, applied automatically by the build when the palette has a `rust` section.
- Committed `themes/*.json` stay byte-identical; committed specs become color-only.
- A `--no-rust-rules` build flag that excludes the layer so palette+spec can be reconstructed exactly.
- Extraction writes color-only specs and still round-trips the committed rust themes byte-for-byte.

**Non-Goals:**
- No change to `tokenColors` formatting (standard-inherited, kept in specs).
- No change to color derivation (LAB offsets), palette format, or the derive-palette role anchors.
- No change to which semantic tokens get colors; the layer only adds formatting.

## Decisions

### D1: The rust formatting layer lives in a new `lib/rust-rules.js` module
Exports a fixed, ordered table `RUST_FORMATTING_RULES` (semantic token selector → formatting props) plus `applyRustRules(theme, palette)` and `stripRustFormatting(semanticTokenColors)`. The table is identical for dark and light, derived from the committed themes:

- Formatting-only selectors (no color in the themes): `typeParameter` bold, `namespace` italic, `struct` bold, `enumMember` bold, `type` bold, `enum` bold+italic, `interface` italic+underline, `*.consuming` bold, `*.reference` italic, `variable.mutable` underline, `keyword.async` italic.
- Mixed selectors (spec keeps the color, layer adds formatting): `macro` underline, `derive` italic, `variable.consuming` bold, `const` italic.

Rationale: one source of truth instead of the rules being duplicated in every spec. Alternatives considered: keep the rules in the specs and make the build merge idempotently — rejected, because then the exclusion flag would be a no-op for the committed themes and could not serve the extraction-testing purpose.

### D2: Compose the layer in the build pipeline; keep `buildTheme` pure
`buildTheme(palette, spec)` stays a pure spec→theme resolver. `lib/build-themes.js buildOne` composes: `applyRustRules(buildTheme(palette, spec), palette)`. The extraction rebuild self-check uses the same composed build for the committed fixtures.

Rationale: existing synthetic extraction tests rebuild minimal color-only themes through the pure `buildTheme` and must keep passing; the layer is a pipeline concern gated on the palette. `applyRustRules` returns a shallow-copied theme with a new `semanticTokenColors`, it does not mutate the resolved theme.

### D3: Gate and merge must reproduce the committed output byte-for-byte
The layer applies only when `palette.rust` is non-empty (always true for valid palettes) **and** the theme has a `semanticTokenColors` section. Two ordering constraints make the merged output byte-identical to the committed themes:

- **Key order**: the module defines `RUST_SEMANTIC_ORDER`, the committed key order (`string, comment.documentation, typeParameter, namespace, struct, enumMember, type, enum, interface, macro, decorator, derive, variable.consuming, *.consuming, *.reference, variable.mutable, const, method, keyword.async`). The merge emits keys in that order; spec-only keys not in the list are appended in spec order.
- **Property order inside mixed entries**: the committed themes order `macro` as `{underline, foreground}` but `derive`, `variable.consuming`, `const` as `{foreground, <format>}`. The layer merge follows those placements so `JSON.stringify` output is byte-exact.

Formatting-only keys with no spec entry are created by the layer; mixed keys keep the spec's foreground expression and gain the layer's props; plain-string spec values for a mixed key are normalized to `{foreground: <expr>}` before merging. Alternatives: append-only merge (rejected — breaks committed key order) and anchor-based insertion (more moving parts than a single canonical order list).

### D4: Extraction strips the layer and self-checks adaptively
`extractSpec` post-processes the built `semanticTokenColors` with `stripRustFormatting`: for each selector in the table, remove the layer's formatting props; drop entries left empty; leave plain-string entries and entries with no layer props untouched (so the synthetic extraction fixtures keep their string form). The committed color-only specs are produced by the same logic, keeping test "extracted spec deep-equals committed spec" meaningful.

The rebuild self-check (`verifyRebuild`) matches the input theme through the composed build (rules on, the real pipeline) **or** the pure build, passing if either reproduces the input byte-for-byte. The committed rust themes round-trip via the composed build; the minimal color-only synthetic fixtures round-trip via the pure build. Alternatives: composed-only would break non-rust extraction; pure-only would break rust extraction.

### D5: Committed specs become color-only
`spec/github-dark.json` and `spec/github-light.json` keep only the color-bearing semantic entries, preserving relative order and existing expression form: `string`, `comment.documentation`, `macro {foreground}`, `decorator`, `derive {foreground}`, `variable.consuming {foreground}`, `const {foreground}`, `method`. Formatting-only entries are removed; mixed entries lose only their formatting props. The `tokenColors` and `colors` sections are untouched.

### D6: `--no-rust-rules` flag on the build CLI
`lib/build-themes.js` parses a boolean `--no-rust-rules` flag alongside the existing positional theme names; when set, `buildOne` skips `applyRustRules`. The `npm run build` script stays unchanged (default = rules on). Output with the flag is exactly what palette+spec define — used to reconstruct the extraction artifact and to verify extraction fidelity.

## Risks / Trade-offs

- **Byte-exactness is order-fragile** → The canonical `RUST_SEMANTIC_ORDER` and per-entry property placement are explicit tables, and the snapshot tests assert byte-identical themes after the spec rewrite; any divergence fails `npm test`.
- **Extraction of non-rust themes** → Their derived palette always has a `rust` section, so the composed pipeline would inject formatting they never had. The adaptive self-check keeps extraction working, and `--no-rust-rules` reproduces such themes exactly; documented as the intended use of the flag.
- **Spec format is breaking** → Committed spec files change shape (`semanticTokenColors` color-only). Mitigation: they are generated artifacts consumed only by this tool, the themes are the user-facing output and stay identical; README updated.
- **Themes that deviate from the layer** (e.g., a `macro` entry without underline) cannot round-trip through the composed pipeline → inherent to an unconditional palette-driven layer; the pure build still expresses them, and `--no-rust-rules` reproduces them.

## Migration Plan

1. Add `lib/rust-rules.js` (table, `RUST_SEMANTIC_ORDER`, `applyRustRules`, `stripRustFormatting`).
2. Compose the layer in `buildOne` with the `--no-rust-rules` flag.
3. Rewrite `spec/github-dark.json` and `spec/github-light.json` to color-only semantic entries; run `npm run build` and confirm `git diff` shows no `themes/*` changes (byte-identical).
4. Update `lib/extract-spec.js` (strip on extract, adaptive self-check via composed/pure build).
5. Update `test/extract.test.js` (committed-spec equality against color-only specs, rule-applying rebuild check, flag cases) and add flag tests to `test/snapshot.test.js`; update README.
6. `npm test` green; `openspec validate` green.

Rollback: revert the spec rewrites and the `lib/` changes; the previous build reproduces the committed themes unchanged.
