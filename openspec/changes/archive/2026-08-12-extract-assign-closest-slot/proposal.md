## Why

Palette derivation names the 16 base slots from theme role anchors, so a slot's name can contradict its color. Extracting `themes/correia-gruvbox.json` yields `blue: #ffd700` (gold), `green: #e78a4e` (orange), `orange: #da70d6` (orchid), and `purple: #179fff` (blue). The recovered palette is a bijection of the right colors under the wrong names, so a theme built from it or read by a human lies about its ink.

## What Changes

- After `derivePalette` resolves the 16 base colors, reassign the **8 color-named (chromatic) slots** — `blue`, `green`, `red`, `orange`, `yellow`, `purple`, `pink`, `cyan` — among the 8 derived chromatic colors by minimum total distance in LAB space to a fixed canonical reference color per slot. The 8 neutral slots (`bg`/`bg-soft`/`bg-muted`/`fg`/`fg-muted`/`fg-subtle`/`border`/`border-muted`) keep their role-anchored values: their names are structural (background vs. foreground vs. border), not hue-based, and reassigning them scrambles the committed fixtures (e.g. `github-dark`'s `bg`/`border` and `fg-muted`/`fg-subtle` pairs swap).
- The canonical reference per chromatic slot is a fixed, theme-independent table of representative hues (blue, green, red, orange, yellow, purple, pink, cyan), not VS Code defaults (which are themselves misnamed, e.g. the blue anchor's default is gold `#FFD700`) and not another theme's palette (a dark palette can't serve as the identity for light themes).
- Assignment is a one-to-one matching (Hungarian algorithm on the 8×8 distance matrix) with deterministic tie-breaking, so identical colors (correia's tripled `#1d2021`) resolve to a stable, deterministic slot order.
- The regenerated spec follows automatically: `extractSpec` runs against the reassigned palette, so every spec expression references the renamed slots.
- Extraction stays byte-exact: the reassignment only relabels the color set, so each theme color's nearest palette color is unchanged and only the slot *name* in the spec changes; `verifyRebuild` keeps passing.
- `github-dark` and `github-light` derive the identity assignment (their chromatic colors already match their names), so the committed-palette and committed-spec fixture tests stay green unchanged.
- No CLI change, no change to the build path (`palette + spec → theme`), no new dependencies.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `theme-generation`: The "palette derived from theme" behavior (introduced by `derive-palette-on-extract`) changes so that the 8 chromatic base slots are reassigned among the 8 derived chromatic colors by closest color distance instead of keeping their role-anchor names. This is a spec-level behavior change to the extraction contract.

## Impact

- **Modified**: `lib/derive-palette.js` (chromatic slot reassignment step after anchor resolution), `test/extract.test.js` (chromatic-reassignment fixture tests, byte-exact rebuild assertions, identity assertions for the github fixtures), and `openspec/specs/theme-generation/spec.md` (delta synced after this change).
- **Behavior preserved**: build path untouched; committed themes still rebuild byte-for-byte; `github-dark`/`github-light` extraction still recovers the committed palette and spec exactly; `themes/correia-gruvbox.json` still extracts end-to-end and rebuilds byte-exact, now with truthfully-named chromatic slots.
- **Fixture ground truth**: `themes/correia-gruvbox.json` becomes the reassignment fixture — its derived chromatic slots must hold `blue #179fff`, `yellow #ffd700`, and the remaining slots assigned by closest distance; `themes/github-{dark,light}-rust.json` pin the identity case.
