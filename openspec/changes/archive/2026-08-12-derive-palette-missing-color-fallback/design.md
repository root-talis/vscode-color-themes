## Context

See proposal.md — Why. Current state that shapes this design:

- `lib/derive-palette.js` `derivePalette(theme)` resolves each of the 22 slots from a type-keyed role-anchor table (`BASE_ANCHORS` + `LIGHT_SWAPS`); a missing anchor key currently throws `cannot derive palette: theme is missing <section> <key> (slot <slot>)`.
- The motivating theme `themes/correia-gruvbox.json` (dark, 176 colors, `semanticTokenColors: {}`) is missing eight base anchors (`activityBar.inactiveForeground`, `breadcrumb.foreground`, `button.secondaryBackground`, `editorBracketHighlight.foreground1/2/3`, and token-scope `invalid.broken`) plus all six `rust.*` semantic anchors. It defines `activityBar.foreground`, `editorError.foreground`, `editorWarning.foreground`, and `editor.selectionHighlightBackground`, and its `tokenColors` carry full gruvbox rules as comma-joined scope lists.
- Extraction is already byte-exact self-checked: `extractSpec` (`lib/extract-spec.js`) only encodes keys present in the input theme, so fallback-resolved slots never add phantom keys to the rebuilt theme.
- Verified against VS Code `main` source: `colorRegistry` defaults in `src/vs/platform/theme/common/colors/{baseColors,inputColors,listColors,editorColors}.ts`, `src/vs/workbench/common/theme.ts`, `src/vs/workbench/contrib/terminal/common/terminalColorRegistry.ts`, and `src/vs/workbench/contrib/scm/common/quickDiff.ts`; semantic-type→scope mappings in `src/vs/editor/common/languages/semanticTokensRegistry.ts`; default-theme token colors in `dark_plus.json` / `light_plus.json`.

## Goals / Non-Goals

**Goals:**
- Every anchor has a registered default, so missing keys resolve the way VS Code resolves them — literal colors and reference chains for `colors` keys, scope probes into the theme's own token rules for token/semantic keys — and extraction succeeds for themes like correia-gruvbox.
- Recursive chain resolution: a referenced key that is also missing resolves via its own registered default, so chains terminate at a theme value or a registered literal.
- Scope splitting: comma-joined token scope lists and array scopes index as individual scopes.
- Themes that resolve every slot from anchors alone derive byte-identically to today; committed fixtures and the byte-exact rebuild self-check keep passing.

**Non-Goals:**
- No new capabilities, no CLI change, no build-path change.
- No "guess the designer's intent" heuristics — fallbacks come from VS Code's registered defaults and the theme's own token colors, not clustering or distance heuristics.
- No full VS Code `colorRegistry` port. Only the anchors this tool uses get registered defaults; the registry mirrors VS Code for those keys.

## Decisions

### D1: Every anchor gets a registered default
The current `FALLBACK_CHAINS` (reference-only) is replaced by a `DEFAULTS` registry, one entry per anchor key (dark/light swap keys share an entry), with four kinds:

- **literal** — a fixed color per type, from VS Code's registered default.
- **chain** — an operation over other registered color keys: `transparent(ref, p)`, `lighten(ref, p)`, `ref`, `lessProminent(base, background, f, t)`.
- **probe** — an ordered list of token scopes; the first scope present in the theme's token colors wins, else `editor.foreground`.
- **null** — no default; the anchor errors.

Registered `colors` defaults (dark / light), verified from VS Code `main`:

| key | default |
|---|---|
| `editor.background` | `#1E1E1E` / `#FFFFFF` |
| `editorGroupHeader.tabsBackground` | `#252526` / `#F3F3F3` |
| `dropdown.background` | `#3C3C3C` / `#FFFFFF` |
| `editor.foreground` | `#BBBBBB` / `#333333` |
| `activityBar.foreground` | `#FFFFFF` / `#FFFFFF` |
| `foreground` | `#CCCCCC` / `#616161` |
| `list.hoverBackground` | `#2A2D2E` / `#F0F0F0` |
| `editor.selectionBackground` | `#264F78` / `#ADD6FF` |
| `editorBracketHighlight.foreground1` | `#FFD700` / `#0431FA` |
| `editorBracketHighlight.foreground2` | `#DA70D6` / `#319331` |
| `editorBracketHighlight.foreground3` | `#179FFF` / `#7B3814` |
| `editorError.foreground` | `#F14C4C` / `#E51400` |
| `editorWarning.foreground` | `#CCA700` / `#BF8803` |
| `terminal.ansiYellow` | `#E5E510` / `#949800` |
| `terminal.ansiCyan` | `#11A8CD` / `#0598BC` |
| `activityBar.inactiveForeground` | chain `transparent(activityBar.foreground, 0.4)` |
| `breadcrumb.foreground` | chain `transparent(foreground, 0.8)` |
| `editor.selectionHighlightBackground` | chain `lessProminent(editor.selectionBackground, editor.background, 0.3, 0.6)` |
| `button.secondaryBackground` | chain `ref(list.hoverBackground)` |
| `button.secondaryHoverBackground` | chain `lighten(list.hoverBackground, 0.2)` |
| `editorGutter.deletedBackground` | chain `ref(editorError.foreground)` |
| `activityBar.border` | **null** (no default; the only erroring anchor) |

Registered token-scope defaults (dark / light), from VS Code's default theme (`dark_plus.json` / `light_plus.json`):

| key | default |
|---|---|
| `entity.name.tag` | `#569CD6` / `#800000` |
| `invalid.broken` | `#F44747` / `#CD3131` |
| `entity` | chain `ref(editor.foreground)` |

Registered semantic probes for the six `rust.*` slots, ordered after VS Code's `semanticTokensRegistry` scope mappings (widened with progressively more general scopes for recovery):

| slot | probe chain |
|---|---|
| `string` | `string` |
| `comment.documentation` | `comment.documentation`, `comment` |
| `macro` | `entity.name.function.preprocessor`, `support.function.macro` |
| `variable.consuming` | `variable.other.readwrite`, `variable` |
| `const` | `variable.other.constant`, `constant`, `constant.numeric`, `constant.language` |
| `method` | `entity.name.function.member`, `support.function`, `entity.name.function` |

### D1b: Why scopes split
correia (and many published themes) write token rules as comma-joined scope lists: `"storage, modifier, keyword.var, entity.name.tag, ..."`. An exact-match lookup for `entity.name.tag` would miss that entry entirely. `collectColors` therefore splits every `scope` — string lists on commas, array entries element-wise (each element also comma-split) — and indexes each individual scope, last-wins on duplicates. This is what lets the green anchor and the `rust.*` probes resolve to real gruvbox colors: `entity.name.tag` → `#E78A4E`, `string` → `#D8A657`, `comment` → `#928374`, `support.function` → `#A9B665`, `entity.name.function.preprocessor` → `#D3869B`.

### D2: Resolution is recursive, theme-first
`resolveKey(section, key, type, slot)` returns the theme's value when present; otherwise it looks up the registered default and:

- literal → the type's hex;
- chain → resolve each referenced key through the same path (theme first, then its default) and apply the operation;
- probe → first token scope present in the theme's token colors, else `editor.foreground`;
- null/unregistered → throw `cannot derive palette: theme is missing <section> <key> (slot <slot>)`.

Because referenced keys resolve through the registry, chains terminate at a theme value or a registered literal; they never "terminate at an absent color". Example: correia lacks `button.secondaryBackground` → `ref(list.hoverBackground)`; correia also lacks `list.hoverBackground` → literal `#2A2D2E` (dark). `transparent(X, p)` and the plain `ref` chains collapse to X's RGB because the palette stores 6-digit hex (alpha stripped, unchanged from on-extract design D3); `lighten` and `lessProminent` keep their math (D3 below).

### D3: Blend ops are unchanged
`lessProminent(base, bg, 0.3, 0.6)` and `lighten(X, 0.2)` keep the semantics already implemented and pinned by tests 2.4 and 2.2b: WCAG relative-luminance comparison, luminance-scaled HSL lighten/darken for `lessProminent`, `l + l·p` HSL lightness for `lighten`, 0.6 alpha for `lessProminent` stripped downstream. Only the lookup of the base/ref keys changes (now through `resolveKey`, so they may themselves resolve by default).

### D4: Only null-default anchors error
The error path is now exactly: a missing anchor whose registered default is `null` or unregistered. In the current anchor set that is only `activityBar.border`. The error message is unchanged (`cannot derive palette: theme is missing <section> <key> (slot <slot>)`) and resolution still runs before `validatePalette(data, 'derived palette')`, so a malformed recovery fails fast with no outputs.

### D5: Byte-exactness is preserved structurally, not by adding keys
Because `extractSpec` iterates only over keys present in the input theme, fallback-resolved slots never emit the missing key in the spec; the rebuilt theme matches the input byte-for-byte. The recovered slot still participates in nearest-slot extraction for the keys that do exist. No change to `verifyRebuild`. This is what makes correia-gruvbox's end-to-end rebuild byte-exact: every theme color maps to a slot whose value is either the theme color itself or a fallback whose derived delta reproduces the theme color exactly.

### D6: Error-surface mitigation for the stub test
The stub theme (only `editor.background`) previously failed on `editorGroupHeader.tabsBackground`; with literals registered it now fails on `activityBar.border` (the only null default). The stub test's regex (`/cannot derive palette: theme is missing/`) is unchanged; the test body asserts the border slot and that no outputs are written.

## Risks / Trade-offs

- [The registry is a snapshot of VS Code `main` defaults; VS Code may change them] → Mitigation: one clearly-commented block in `lib/derive-palette.js`; the fixtures pin current behavior. If VS Code changes a default, only that entry changes.
- [`lessProminent` / `lighten` math could drift from VS Code's exact color math] → Mitigation: D3 pins the semantics; tests 2.4 and 2.2b assert the computed hex for known input pairs.
- [Literal defaults are guesses at what the designer intended for omitted slots] → Mitigation: they are exactly what VS Code paints for the omitted key, which is the point — extraction now recovers what the user sees, not a designer guess. No committed fixture changes (none omit anchors).
- [Probe widening beyond the registry's exact scopes could pick a sibling color] → Mitigation: probes are ordered registry-first (exact scope, then the registry's fallback scopes) and only then general scopes; a probe miss falls back to `editor.foreground`, never to an arbitrary theme color.
- [Error surface shrinks to a single anchor] → Mitigation: acceptable and documented — `activityBar.border` is the only key VS Code itself gives no default; the stub test keeps the "clear error + no outputs" contract covered.

## Migration Plan

- Update `test/extract.test.js`: 3.6a's stub expectation moves from the tabs-background error to `activityBar.border` (regex unchanged); 2.5a becomes a literal-default success case (`editorBracketHighlight.foreground1` → `#FFD700`); 2.5b becomes a chain-to-literal success case (`button.secondaryBackground` → `list.hoverBackground` → `#2A2D2E`); 2.5c is replaced by the correia end-to-end success test (palette values asserted, artifacts written, rebuild into a temp file byte-identical); 2.6 keeps the stub-error + fixture-regression checks. New tests cover scope splitting and probe resolution.
- Rollback: revert to the previous commit; the change only touches the derivation fallback, tests, and docs.

## Open Questions

- None.
