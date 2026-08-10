## Why

Palette derivation still aborts on missing colors: `activityBar.border` is the one role anchor with no registered VS Code default (its registered default is `null`, meaning VS Code paints no border), so any real theme that omits it fails extraction with `cannot derive palette: theme is missing colors activityBar.border (slot border)`. The bundled `themes/solarized-dark-color-theme.json` and `themes/solarized-light-color-theme.json` (101 and 90 colors, dark and light, empty `semanticTokenColors`) both omit it, so extraction fails on both. Even with that fallback added, extraction still fails their byte-for-byte self-check because the two themes are not in the tool's canonical format (see below). The fix completes the fallback story started by `derive-palette-missing-color-fallback` and makes the extraction self-check accept any real-world theme, not just themes already in canonical form.

## What Changes

- `activityBar.border` gains a registered default of kind `chain` with `op: ref` on `activityBar.background`. When a theme omits the border key, VS Code draws no border, so the effective color at that edge is the activity bar's own background; `ref(activityBar.background)` recovers exactly that, theme-first. `activityBar.background` itself is registered as a literal (`#333333` dark / `#2C2C2C` light, VS Code's registered defaults) so the chain terminates when the theme also omits it. No role anchor has a null default anymore, so a missing key can never abort derivation; the `cannot derive palette: theme is missing <section> <key> (slot <slot>)` error path remains only for structural failures (invalid type, non-object theme, malformed color).
- The extraction self-check (`verifyRebuild`) compares the rebuilt theme against a canonically-normalized form of the input theme instead of the raw bytes. The canonical form is the tool's own output shape: lowercase hex, `ff` alpha bytes dropped, `colors` keys sorted, canonical top-level key order (`name`, `$schema`, `type`, `colors`, `tokenColors`, `semanticTokenColors`, `semanticHighlighting`), token-rule `name` fields dropped, and empty-settings token rules dropped. The committed `github-*` and `correia-gruvbox` themes are already in this canonical form, so their byte-exact reproduction guarantee is unchanged.
- `extractSpec` stops writing empty-settings `tokenColors` entries into the spec, matching the build (which already drops them); this keeps the spec and the rebuilt output consistent.
- `themes/solarized-dark-color-theme.json` and `themes/solarized-light-color-theme.json` now extract end-to-end: derivation succeeds, the byte-exact self-check passes (canonical form), and palette + spec artifacts are written.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `theme-generation`: The "missing-color fallback" requirement changes so that every role anchor has a registered default — `activityBar.border` resolves through `activityBar.background` instead of erroring, and derivation no longer fails on missing keys at all. The "extraction reproduces its input" and "output self-check" requirements change so the byte-for-byte rebuild guarantee is expressed against the canonical theme form, accepting non-canonical input themes (uppercase hex, `ff` alpha, unsorted `colors`, different top-level order, token-rule names, empty token rules).

## Impact

- **Modified**: `lib/derive-palette.js` (`DEFAULTS` gains `activityBar.background`; `activityBar.border` becomes a `ref` chain), `lib/extract-spec.js` (`verifyRebuild` canonicalizes the input; `extractSpec` drops empty-settings token rules; a `canonicalTheme` helper is added), `lib/theme.js` or `lib/extract-spec.js` (canonical form helper placement), `test/extract.test.js` (stub-error expectations move to structural failures; new solarized end-to-end and canonical-form tests), and `openspec/specs/theme-generation/spec.md` (delta synced after this change).
- **Behavior preserved**: committed themes still extract and rebuild byte-for-byte; themes that resolve every slot from anchor keys alone derive exactly as before; the stub theme no longer fails (every anchor has a default) and the stub-error tests are replaced by structural-failure tests (invalid type).
- **Fixture ground truth**: `themes/solarized-dark-color-theme.json` and `themes/solarized-light-color-theme.json` become the end-to-end success fixtures — extraction succeeds, writes palette and spec artifacts, and the artifacts rebuild the theme byte-for-byte in canonical form. The solarized derived palettes put `border` at the theme's `activityBar.background` (`#003847` dark / `#DDD6C1` light).
