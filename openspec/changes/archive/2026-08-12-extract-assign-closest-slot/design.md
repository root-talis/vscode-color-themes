## Context

See proposal.md — Why. Current state that shapes this design:

- `lib/derive-palette.js` `derivePalette(theme)` resolves all 22 slots from a type-keyed role-anchor table, then `validatePalette` shapes the result (`{ type, base, rust, slots }`). The 16 base colors are correct as a *set*; the chromatic slot *names* can lie about the colors because each name comes from a role anchor, not from the color (correia: `blue #ffd700`, `green #e78a4e`, `orange #da70d6`, `purple #179fff`).
- `extractSpec` (`lib/extract-spec.js`) maps every theme color to its nearest palette slot and stores absolute LAB deltas; exact matches reference the slot by name with no delta. Because the palette is only used as a color→name map, relabeling the 8 chromatic colors leaves every theme color's nearest *color* unchanged — only the slot *name* in the spec changes. Verified empirically (prototype): reassigning the chromatic slots keeps `github-dark`, `github-light`, and `correia-gruvbox` rebuilds byte-exact.
- The committed `palettes/github-{dark,light}.json` and `spec/github-{dark,light}.json` are the exact-recovery fixtures pinned by tests 3.1/3.2 in `test/extract.test.js`. Their chromatic colors already match their names, so the correct behavior for them is the identity assignment.

## Goals / Non-Goals

**Goals:**
- The 8 chromatic base slots are named by color proximity, not by role anchor, so a derived palette's `blue` holds the closest-to-blue color.
- The github fixtures recover exactly as today (identity assignment); correia-gruvbox's chromatic slots get truthful names.
- The byte-exact rebuild self-check keeps passing for every theme, including correia.
- Deterministic output: identical duplicate colors resolve to a stable slot order.

**Non-Goals:**
- No change to the neutral slots — their names are structural (background/foreground/border families), not hue-based.
- No change to the Rust semantic slots — they are semantic roles (`string`, `docComment`, …), not color names.
- No change to the build path, the CLI, or committed palettes/specs/themes.
- No clustering, no color-gamut discovery, no "find the designer's missing green in the theme" heuristics.

## Decisions

### D1: Reassign only the 8 chromatic slots
The 16 base slots split into 8 neutral (`bg`, `bg-soft`, `bg-muted`, `fg`, `fg-muted`, `fg-subtle`, `border`, `border-muted`) and 8 chromatic (`blue`, `green`, `red`, `orange`, `yellow`, `purple`, `pink`, `cyan`). Only the chromatic ones are reassigned by distance.

Alternatives rejected:
- **All 16 slots** — prototyped. Global matching scrambles the github-dark neutrals (`bg #24292e` swaps with `border #1b1f23`, `fg-muted #6a737d` swaps with `fg-subtle #959da5`) because the neutral reference ladder doesn't align with each theme's actual neutral ladder. That breaks the committed-palette fixture tests. The neutral names encode role, not hue, so distance is the wrong criterion there.
- **Reassign nothing, just fix the anchor table** — the anchor keys are structurally forced (the `blue` anchor is `editorBracketHighlight.foreground1`, which VS Code defaults to gold `#FFD700`). The misnaming is inherent to role-based naming for themes like correia that don't pin those keys; reassignment is the only fix that works regardless of which theme keys a theme defines.

### D2: A fixed, theme-independent canonical reference per chromatic slot
The distance target for each chromatic slot is a hard-coded representative hex of that hue family:

| slot | reference | slot | reference |
|---|---|---|---|
| blue | `#3b82f6` | yellow | `#facc15` |
| green | `#4caf50` | purple | `#8b5cf6` |
| red | `#ef4444` | pink | `#f472b6` |
| orange | `#f97316` | cyan | `#06b6d4` |

Alternatives rejected:
- **VS Code registered defaults** — they are themselves misnamed (`editorBracketHighlight.foreground1` → gold, `.foreground2` → orchid, `.foreground3` → blue), so they would reproduce the exact bug.
- **The committed `github-dark` palette as reference** — it is a dark palette; its neutral/chromatic balance is wrong as identity for light themes, and it makes the tool's behavior depend on one theme's ink.
- **Hue/threshold classification** (e.g. "hue in [15°,45°] ⇒ orange") — a reference table is the same classification expressed as a distance, with no magic thresholds, and it degrades gracefully for grayish colors (LAB distance to the nearest reference).

The exact hex values are a design parameter; the observable contract they must satisfy is pinned by the fixture tests (identity for `github-dark`/`github-light`, `blue #179fff` + gold not-on-blue for correia). If a future fixture palette's chromatic colors drift, the table stays in one clearly-commented block next to the assignment.

### D3: Minimum-total-distance perfect matching (Hungarian)
The 8 derived chromatic colors are matched to the 8 chromatic slots minimizing the sum of LAB distances to the references. `rgb2lab` already exists in `lib/color.js`; distances are Euclidean in LAB (the same space `extractSpec` uses for nearest-slot and deltas). With n=8, an O(n³) Hungarian implementation is trivially small and fast.

Alternatives rejected:
- **Greedy nearest-first** (take closest pair, remove, repeat) — can mis-assign when two colors are both near one reference and a third is an orphan, producing a higher total distance than the global optimum for no simplicity gain at n=8.
- **Per-color independent nearest** — violates one-to-one (two colors could claim the same slot); the palette requires exactly one color per slot.

### D4: Deterministic ties
Identical derived colors (correia's `#1d2021` ×3, `#ebdbb2` ×3) are interchangeable; the Hungarian tie-break resolves by iterating in a stable slot/color order. Deterministic implementation ⇒ byte-identical outputs on repeated runs (scenario "Duplicate colors assign deterministically").

### D5: Placement inside `derivePalette`, before validation
The reassignment runs in `derivePalette` after the anchors resolve and before `validatePalette(data, 'derived palette')`. Consequences:
- `extractTheme` (`extract-spec.js`) is unchanged: `derivePalette` then `extractSpec` already produces the spec against the reassigned palette.
- Every caller of `derivePalette` (currently only extraction) receives the truthfully-named palette; validation still runs on the final shape and hex values (unchanged under relabeling).
- `lib/derive-palette.js` gains the reference table + assignment as one self-contained block; `lib/extract-spec.js` is untouched.

### D6: Byte-exactness is preserved structurally, not by re-verification
Reassignment relabels the color set; it never changes which color is nearest to a theme color. `extractSpec`'s exact-slot map is keyed by RGB (the color set is the same, so exact matches still hit), and nearest-slot is by LAB of the palette colors (name-invariant). The regenerated spec therefore encodes each theme color against its same nearest color, now under the corrected name; `buildTheme` resolves it back to the identical hex. Prototype confirmed byte-exact rebuild for `github-dark`, `github-light`, and `correia-gruvbox`.

## Risks / Trade-offs

- [Reference table is designer-arbitrary] → Mitigation: one clearly-commented block; the observable contract is pinned by fixture tests (github identity, correia's `blue #179fff`), not by the specific hexes.
- [Degenerate chromatic sets produce odd leftovers] → correia's derived set has no green and no cyan, so two warm colors must fill those slots; the assignment picks the closest available (verified: gold → yellow, orchid → purple, the user-visible misnames are all fixed). This is inherent to a one-to-one matching and does not affect byte-exactness.
- [Re-extracting `tomorrow`/`tomorrow-night` swaps `red`/`pink` vs. the committed palettes] → The committed palettes are hand-authored and no fixture test re-derives them; the swap is the intended consequence of the new rule (those slots hold the VS Code default pink `#f44747`, which is closer to the red reference than the palette's muted red `#cc6666`). Documented; no committed file changes.
- [Fixture identity depends on the reference table staying consistent with github's chromatic colors] → The identity case is tested explicitly (3.1/3.2 keep asserting exact committed-palette recovery); a reference tweak that breaks identity fails those tests immediately.

## Migration Plan

- Update `test/extract.test.js`: add reassignment assertions (correia's derived chromatic slots), a byte-exact rebuild test for the reassigned correia extraction, and a determinism test (run twice, compare bytes). Existing 3.1/3.2 fixture tests stay as-is and pin the identity case.
- Rollback: revert to the previous commit; committed themes, palettes, and specs are untouched (only extraction-time naming changes).

## Open Questions

- None. The exact reference hexes (D2) are a design parameter whose observable contract the fixture tests pin; adjusting them during implementation does not change the specs, approach, or task breakdown.
