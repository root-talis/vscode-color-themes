## Context

See proposal.md — Why. Current state that shapes this design:

- `lib/derive-palette.js` `DEFAULTS` gives every role-anchor key a registered default except `activityBar.border`, which is `null` (VS Code registers `activityBar.border` as `{ dark: null, light: null }` — a missing key paints no border, so the effective color at that edge is the activity bar's own background). A missing `activityBar.border` therefore throws `cannot derive palette: theme is missing colors activityBar.border (slot border)`.
- `themes/solarized-dark-color-theme.json` and `themes/solarized-light-color-theme.json` both omit `activityBar.border`, so `derivePalette` aborts on both. They are not in the tool's canonical format either: `tokenColors` before `colors`, unsorted `colors` keys, uppercase hex, 8-digit hex with an `ff` alpha byte, token-rule `name` fields, and empty-settings token rules. Fixing only the fallback still fails their `verifyRebuild` byte-exact self-check.
- `verifyRebuild` currently compares the rebuilt JSON against `stripComments(themeText)` — the raw input bytes minus comment lines. The committed `github-*` / `correia-gruvbox` themes happen to match the build's output shape exactly (sorted `colors`, lowercase hex, `colors` before `tokenColors`, no `name` fields, no empty token rules), which is why byte-exact passes today.
- `extractSpec`'s `tokenColorOut` writes every input token rule, including `settings: {}` entries, while `buildTheme`'s `flatMap` drops any entry whose settings resolve to empty — so today the spec can encode entries the build discards.

A prototype of this design (patched copies of `lib/derive-palette.js` and `lib/extract-spec.js`, no repo files touched) extracts both solarized themes end-to-end — derivation succeeds, palette and spec artifacts write, the self-check passes — and the full test suite passes 87/89, failing only the two stub-error tests that assert the old `activityBar.border` behavior. Solarized-derived palettes put `border` at the theme's `activityBar.background` (`#003847` dark / `#DDD6C1` light).

## Goals / Non-Goals

**Goals:**
- `activityBar.border` has a registered default, so no role anchor can fail on a missing key; derivation fails only on structural problems (invalid `type`, non-object theme, malformed color).
- Extraction accepts arbitrary real-world themes, not just themes already in the tool's canonical format, while keeping the "the spec rebuilds the input theme with nothing lost" guarantee.
- The committed `github-*` and `correia-gruvbox` themes keep their exact byte-for-byte reproduction; their extraction tests are unchanged in outcome.
- `themes/solarized-{dark,light}-color-theme.json` extract end-to-end and become success fixtures.

**Non-Goals:**
- No change to the build path, the CLI surface, the palette/spec file formats, or the derived `border` color of existing committed themes.
- No recording of input formatting (key order, hex case, token-rule names) in the spec. The spec keeps expressing the theme in the tool's canonical form.
- No full VS Code `colorRegistry` port — only the new `activityBar.background` entry is added to `DEFAULTS`.

## Decisions

### D1: `activityBar.border` defaults to `ref(activityBar.background)`
`DEFAULTS` gains one literal entry and one chain entry:

- `'activityBar.background'`: `{ kind: 'literal', dark: '#333333', light: '#2C2C2C' }` — VS Code's registered `ACTIVITY_BAR_BACKGROUND` defaults (verified against `src/vs/workbench/common/theme.ts`).
- `'activityBar.border'`: `{ kind: 'chain', op: 'ref', ref: 'activityBar.background' }` replacing the current `null`.

`resolveKey` already resolves chains theme-first, then by each referenced key's registered default, so: theme defines `activityBar.border` → theme wins; omits it but defines `activityBar.background` → that color (solarized `#003847` / `#DDD6C1`); omits both → `#333333` / `#2C2C2C`. This mirrors what VS Code paints when the border key is absent: no border, so the activity bar background shows at that edge.

**Alternatives considered:** a fixed literal `#333333`/`#2C2C2C` per type (rejected: not theme-aware — for solarized it would put a non-theme color in the palette and leave the `border` slot unused by any theme color); `ref(sideBar.background)` (rejected: `sideBar.background` is also a registered default but its literal is what VS Code paints only when the *sidebar* key is absent, which is not what the omitted activity-bar border resolves to).

### D2: The extraction self-check compares against a canonical theme form
A new `canonicalTheme(theme)` helper normalizes any parsed theme into the tool's canonical output shape:

- top-level key order `name`, `$schema`, `type`, `colors`, `tokenColors`, `semanticTokenColors`, `semanticHighlighting`;
- `colors` keys sorted, values via `normalizeHex` (lowercase; an `ff` alpha byte drops because `formatHex` omits alpha 255);
- `tokenColors` entries: `name` dropped, entries with an empty `settings` object dropped, hex settings values normalized (lowercase, `ff` stripped), non-hex settings (`fontStyle`) passed through;
- `semanticTokenColors` normalized via `normalizeHexInObject`.

`verifyRebuild`'s expected value becomes `JSON.stringify(canonicalTheme(parseJsonc(themeText)), null, '\t') + '\n'` instead of `stripComments(themeText)`. The rebuilt output is already canonical (buildTheme sorts `colors`, formats lowercase hex, omits `name`, drops empty-settings token rules, emits the canonical top-level order), so the comparison is now exact for arbitrary inputs. For the committed themes `canonicalTheme` is effectively the identity (they are already canonical), so their byte-exact guarantee and all existing fixture assertions are unchanged.

This is the same spirit as the existing `stripComments` normalization: the check guarantees no theme content is lost in extraction, judged against the tool's canonical representation rather than incidental formatting.

**Alternatives considered:** recording input formatting (top-level/`colors` key order, hex case, token-rule names) in the spec so the build reproduces it literally — rejected: it changes the spec grammar, every committed spec, and the build's deterministic-output contract (a spec would then emit different key orders depending on metadata); strict byte-for-byte with pre-normalized inputs — rejected: that makes "extraction of a current theme" depend on the input already being canonical, which is exactly the gap this change closes.

### D3: `canonicalTheme` lives in `lib/theme.js`
The canonical form is the build's output shape, so the helper sits next to `buildTheme` in `lib/theme.js` (importing `normalizeHex` / `normalizeHexInObject` from `lib/color.js`) and is imported by `lib/extract-spec.js`. This keeps the "what the build emits" definition in one place. Keeping it in `extract-spec.js` was considered; it works but splits the canonical-output definition away from the component that produces it.

### D4: `extractSpec` drops empty-settings token rules
`tokenColorOut` gains a filter that skips input token rules with an empty `settings` object, matching `buildTheme`'s existing `flatMap` drop. This keeps the spec consistent with what the build emits and with the canonical input form (D2), so the spec never encodes a rule the rebuild discards. Rules that keep only pass-through settings (`markup.bold` → `fontStyle: bold`) are unaffected — `resolveSettings` keeps them, so they survive in both spec and build.

### D5: The null-default error path stays as defense, no anchor triggers it
`resolveKey` keeps throwing for an unregistered or `null` default. After D1 no current anchor has one, so a missing key never aborts derivation. Structural failures still throw with the existing clear messages and write no outputs: invalid `type` (`cannot derive palette: "type" must be "dark" or "light"`), non-object theme, malformed color (`invalid hex: ...`). The `DEFAULTS` block comment that names `activityBar.border` as the only null default is updated.

### D6: Stub-error tests become structural-failure tests; solarized becomes a fixture
The two tests that assert the stub theme errors on `activityBar.border` (extract.test.js 3.6a and 2.6's stub half) no longer describe reality: with every anchor defaulted, a theme containing only `editor.background` derives successfully. They are replaced by:
- a structural-failure test (invalid `type`, e.g. `"gray"`) asserting the clear error and that no output files are written;
- keeping the "committed fixtures recover unchanged" assertions (2.6's fixture half) exactly as-is.
`themes/solarized-dark-color-theme.json` and `themes/solarized-light-color-theme.json` are copied to `test/fixtures/themes/` (per the `test-fixtures` capability) and get an end-to-end test mirroring the correia one: derive, assert key palette slots (`border` `#003847` / `#DDD6C1`, `bg` `#002b36` / `#fdf6e3`, `fg` `#839496` / `#657b83`), run `runExtract`, assert artifacts exist, rebuild into a temp file and compare against the canonical form of the fixture.

## Risks / Trade-offs

- [The canonical self-check weakens the headline "byte-for-byte" claim for non-canonical inputs] → Mitigation: the committed themes are canonical and their byte-for-byte reproduction is unchanged and still asserted by the fixture tests; the spec now states the guarantee as "byte-for-byte in canonical form", and the canonical normalizations only touch formatting/no-op content that VS Code does not render differently.
- [`normalizeHex` throws on malformed color strings] → Mitigation: `canonicalTheme` only feeds it real hex (guarded with the hex-pattern check for `tokenColors` settings), and a malformed theme color already fails derivation before `verifyRebuild` runs.
- [`activityBar.background` literal defaults could drift from future VS Code versions] → Mitigation: one commented entry in the `DEFAULTS` block, consistent with the existing registry; fixtures pin current behavior.
- [Dropping empty-settings token rules loses their `scope` declarations] → Mitigation: those rules render nothing (no colors, no font style), so the loss is content-free; the canonical input form (D2) drops the same entries so the self-check stays honest.
- [Two new solarized fixtures increase the extraction surface] → Mitigation: they are end-to-end fixtures exactly like correia-gruvbox (derive + rebuild self-check), so any regression is caught by the same gate that guards the committed themes.

## Migration Plan

1. `lib/derive-palette.js`: add `activityBar.background` literal to `DEFAULTS`; change `activityBar.border` from `null` to the `ref` chain; update the `DEFAULTS` comment.
2. `lib/theme.js`: add and export `canonicalTheme`.
3. `lib/extract-spec.js`: import `canonicalTheme`; use it in `verifyRebuild`; filter empty-settings token rules in `extractSpec`.
4. `test/fixtures/themes/`: copy both solarized themes (the repo-root copies are the source of truth).
5. `test/extract.test.js`: replace the two stub-error assertions; add the solarized end-to-end tests.
6. Run `npm test` (all suites), `node lib/extract-spec.js` on both solarized themes via `--out-dir` to confirm end-to-end, and re-verify the committed github/correia extraction still passes byte-exact.
7. Sync the delta into `openspec/specs/theme-generation/spec.md` on archive.
- Rollback: revert the commit; the change touches only `lib/derive-palette.js`, `lib/theme.js`, `lib/extract-spec.js`, the extraction tests, and fixtures.

## Open Questions

- None.
