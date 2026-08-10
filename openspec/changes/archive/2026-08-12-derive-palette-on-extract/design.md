## Context

See proposal.md for motivation. Current state that shapes this design:

- `lib/extract-spec.js` is `node lib/extract-spec.js <theme.json> <palette.json> <out.json>`: it needs a palette, maps each theme color to its nearest slot, and emits a spec whose `derived` tokens are absolute LAB vector offsets.
- `lib/build-themes.js` + `lib/theme.js` resolve a spec against a palette and write a theme.
- **The spec problem is already solved.** Verified empirically: running the current extractor with the committed palette reproduces the committed spec byte-identically for both `github-dark` and `github-light`. So the entire new work is palette recovery; everything downstream reuses existing, tested code.
- The committed `themes/github-{dark,light}-rust.json`, `palettes/github-{dark,light}.json`, and `spec/github-{dark,light}.json` are the fixtures. In `github-dark`, `cyan` (`#17e5e6`) appears in the theme only as alpha-suffixed colors (e.g. `#17e5e633`).

## Goals / Non-Goals

**Goals:**
- Extract derives the 16-base + 6-Rust palette from the theme alone, so the CLI needs no palette argument.
- Derived palette + spec are validated to rebuild the input theme byte-for-byte.
- Exact fixture recovery for `github-dark` and `github-light` (palette and spec deep-equal the committed files).

**Non-Goals:**
- No change to the build path (palette + spec → theme); committed themes keep building byte-for-byte.
- No generic "recover the designer's palette for arbitrary third-party themes". The committed palette is not recoverable from color statistics alone (see Risks), so recovery is scoped to themes built from this tool's spec structure.

## Decisions

### D1: Palette recovery uses theme role anchors, not color clustering
Attempted and rejected: k-means (recovered 13/22 dark, 10/22 light), k-medoids (11/22, 12/22), agglomerative clustering (11/22, 6/22), and total-LAB-distance minimization (316/836 single palette swaps improve the committed palette's cost). Root cause: the committed palette is designer-arbitrary. For example `red #f97583` and its own derived `red.d5 #f9826c` are near-identical in LAB space, and swapping them yields an equally-valid, byte-exact-rebuilding palette — no color-only method can prefer one.

Instead the extractor reads the theme's role structure: the tool's themes are built from known spec conventions, so specific theme keys denote specific slots. The palette is then "the colors those roles point to".

### D2: Role anchors are keyed by theme type
The tool's specs are per-theme independent rule tables, so a theme key can mean different slots in dark vs. light. Verified examples: `activityBar.inactiveForeground` is `fg-muted` in dark but `fg-subtle` in light; `breadcrumb.foreground` is `fg-subtle` in dark but `fg-muted` in light; `button.secondaryBackground` is `border-muted` in dark, while light uses `button.secondaryHoverBackground`. A single global table cannot be correct, so the anchor table has a `dark` and a `light` variant selected by `theme.type`.

Validated dark anchors:

| slot | theme key |
|---|---|
| bg | `colors.editor.background` |
| bg-soft | `colors.editorGroupHeader.tabsBackground` |
| bg-muted | `colors.dropdown.background` |
| fg | `colors.editor.foreground` |
| fg-muted | `colors.activityBar.inactiveForeground` |
| fg-subtle | `colors.breadcrumb.foreground` |
| border | `colors.activityBar.border` |
| border-muted | `colors.button.secondaryBackground` |
| blue | `colors.editorBracketHighlight.foreground1` |
| green | tokenColors `entity.name.tag` foreground |
| red | `colors.editorError.foreground` |
| orange | `colors.editorBracketHighlight.foreground2` |
| yellow | `colors.editorWarning.foreground` |
| purple | `colors.editorBracketHighlight.foreground3` |
| pink | tokenColors `invalid.broken` foreground |
| cyan | `colors.editor.selectionHighlightBackground` (alpha-stripped) |
| rust.string | semantic `string` |
| rust.docComment | semantic `comment.documentation` |
| rust.macro | semantic `macro` |
| rust.consuming | semantic `variable.consuming` |
| rust.const | semantic `const` |
| rust.method | semantic `method` |

Light differs only for: `fg-muted` ← `colors.breadcrumb.foreground`, `fg-subtle` ← `colors.activityBar.inactiveForeground`, `border-muted` ← `colors.button.secondaryHoverBackground`, `red` ← `colors.editorGutter.deletedBackground`, `yellow` ← `colors.terminal.ansiYellow`, `purple` ← tokenColors `entity` foreground, `pink` ← semantic `macro` (light's `pink` and `rust.macro` share the same hex), `cyan` ← `colors.terminal.ansiCyan`.

### D3: Alpha bytes are stripped when collecting colors
`parseHex` already yields `a`; the recovery pipeline reads RGB components regardless of alpha so `#17e5e633` recovers slot `cyan = #17e5e6`. Alpha handling downstream is unchanged (the existing extractor re-attaches alpha bytes from the theme values).

### D4: Derived palette is validated with the same rules as a hand-written one
Recovery output must satisfy: `type` in {dark, light}, exactly 16 base slots, non-empty `rust` set, every value valid 6-digit hex. Factor the checks currently inline in `loadPalette` (or add a `validatePalette(data)` helper both can use) so a malformed recovery fails fast with a clear error and no output files are written.

### D5: Output contract and module layout
- New `lib/derive-palette.js` exports `derivePalette(theme)` returning the same shape `loadPalette` returns (`{ type, base, rust, slots }`), so `buildTheme` and `extractSpec` consume it unchanged.
- `extract-spec.js` (or a thin wrapper) exports `extractTheme(theme)` → `{ palette, spec }` = `derivePalette` then the existing `extractSpec(theme, palette)`.
- CLI: `node lib/extract-spec.js <theme.json> [--out-dir <dir>]`. Default output names strip a trailing `-rust` from the theme stem and write `palettes/<name>.json` and `spec/<name>.json` (repo convention, e.g. `themes/github-dark-rust.json` → `palettes/github-dark.json` + `spec/github-dark.json`); `--out-dir` redirects both. Files are written only after the self-check passes, matching the "invalid recovery writes no outputs" spec.

### D6: Self-check rebuilds into a temporary file and compares byte-for-byte
`buildTheme(derivedPalette, derivedSpec)` writes a rebuilt theme into a temporary file (for example under `os.tmpdir()`), formatted exactly as `build-themes.js` formats themes, and the rebuilt file is compared byte-for-byte against the input theme with `//` comment lines stripped (the same contract the snapshot tests use). A temp file keeps the verification from clobbering the committed theme in `themes/`, since the extract command's own outputs are palette and spec, not a theme. On mismatch the CLI notifies the user with a clear message (which theme, and where the comparison diverged) and does not write the palette or spec outputs. Note: because any recovered palette rebuilds byte-exactly, this check alone cannot prove the palette is "right" — the exact-recovery guarantee comes from the role anchors and is pinned by the fixture tests.

## Risks / Trade-offs

- [Anchor table is theme-structure knowledge, not a general algorithm] → Mitigation: keep the table in one place (`lib/derive-palette.js`) with the dark/light variants and a clear comment; the fixture tests pin it. Themes not built from these spec conventions will fail validation with a clear error rather than silently emit a wrong palette.
- [Per-type anchors encode the dark/light conventions of the committed specs] → Mitigation: the independent-rule-table property (same key, different slot per theme) is documented in the main spec; the table is the extractor's mirror of it. If a future spec changes a mapping, both the spec and the anchor table change together.
- [Exact fixture recovery depends on the fixtures staying stable] → Mitigation: the fixture tests compare against committed files; a deliberate palette/spec change to a fixture will require regenerating and updating the committed files together.
- [CLI signature is BREAKING] → Mitigation: update `package.json` `extract` script, README, and any call sites in the same change; old invocations fail fast with the new usage message.

## Migration Plan

- Update `package.json` (`extract` script) and README's "Reverse direction" section to the new invocation in the same change.
- Rollback: revert to the previous commit; committed themes, palettes, and specs are untouched by this change (only the extraction path changes).

## Open Questions

- None. Output naming (D5) is an assumption recorded in the proposal; it does not change the specs or task breakdown.
