## 1. Registered-defaults resolution in palette derivation

- [x] 1.1 Split scopes in `collectColors`: treat each `scope` entry as a comma-separated list and each array element as a comma-separated list, indexing every individual scope (last-wins) so single-scope lookups resolve in comma-heavy themes (design D1b)
- [x] 1.2 Add the `DEFAULTS` registry to `lib/derive-palette.js` (design D1) replacing `FALLBACK_CHAINS`: the 15 color literals, the six existing chains (`activityBar.inactiveForeground`, `breadcrumb.foreground`, `editor.selectionHighlightBackground`, `button.secondaryBackground`, `button.secondaryHoverBackground`, `editorGutter.deletedBackground`), the token literals (`entity.name.tag`, `invalid.broken`) and the `entity` → `editor.foreground` chain, the semantic probes for the six `rust.*` slots, and `null` for `activityBar.border`
- [x] 1.3 Implement `resolveKey(section, key, type, slot)` (design D2): theme value → literal → chain (recursive over referenced keys, applying `transparent` / `lighten` / `ref` / `lessProminent`) → probe (first token-scope hit, else `editor.foreground`) → null/unregistered error
- [x] 1.4 Keep the `lessProminent` and `lighten` implementations unchanged, feeding their base/ref keys through `resolveKey` (design D3)
- [x] 1.5 Wire `derivePalette` to `resolveKey` per anchor; confirm the only error path left is `activityBar.border` with the unchanged `cannot derive palette: theme is missing <section> <key> (slot <slot>)` message, still before `validatePalette` (design D4)

## 2. Tests

- [x] 2.1 Replace 2.5c with a correia-gruvbox end-to-end success test: extraction succeeds, the derived palette has the expected gruvbox values (spot-check `fg` `#ebdbb2`, `bg` `#1d2021`, `red` `#cc241d`, `yellow` `#d79921`, `green` `#e78a4e`, `border` `#3c3836`, `rust.string` `#d8a657`, `rust.macro` `#d3869b`), the CLI writes palette + spec artifacts, and rebuilding from those artifact files into a temporary file reproduces the input theme byte-for-byte
- [x] 2.2 Rework 2.5a: a theme missing `editorBracketHighlight.foreground1` now derives `blue` from the registered literal (`#FFD700` dark), rebuilds byte-for-byte, and writes outputs
- [x] 2.3 Rework 2.5b: a theme missing both `button.secondaryBackground` and `list.hoverBackground` now derives `border-muted` from the literal `#2A2D2E` (chain → literal), rebuilds byte-for-byte
- [x] 2.4 Update 3.6a: the stub theme (only `editor.background`) still errors with `/cannot derive palette: theme is missing/`, now naming `activityBar.border`, and writes no outputs
- [x] 2.5 Keep and re-verify 2.1–2.4 (fallback chains), 2.6 (stub + fixture regression), and 3.1–3.8 (fixture recovery, determinism, CLI, verification failure) against the new resolver
- [x] 2.6 New scope-splitting test: a theme whose token rules use comma-joined scopes (for example `"storage, modifier, keyword.var, entity.name.tag"`) resolves `green` from the `entity.name.tag` color
- [x] 2.7 New probe test: a theme with empty `semanticTokenColors` but `string` / `comment` / `support.function` token rules resolves `rust.string` / `rust.docComment` / `rust.method` from those colors; a theme with none of a probe's scopes falls back to `editor.foreground`

## 3. Verification

- [x] 3.1 `npm test` passes (new fallback tests + existing extraction, snapshot, and color suites)
- [x] 3.2 `npm run build` regenerates all committed themes byte-identical to the checked-in files (no drift)
- [x] 3.3 `openspec validate --all` passes
