## Context

See proposal.md — Why. The suggestion provider (`lib/suggest.js`) resolves a language's registered slots against a validated palette: `validatePalette` first (which requires a non-empty `rust` section), then each fixed-family slot via `resolveFixedSlot`, then the least-common-hue slot via `resolveLeastCommonHue(slot, slots, palette)`, which computes its claimed-family set from the `slots` argument. The rust module (`lib/suggest-rust.js`) registers six slots. Two callers consume `suggest('rust', palette)`: extraction (`extract-spec.js` `runExtract` overwrites the derived palette's `rust` section with the full suggestion set) and the palette suggestion-fill command (`lib/suggest-palette.js` merges missing slots into a palette's `rust` section). Every committed palette defines `rust.string`, so the gate described here is inert for committed outputs.

## Goals / Non-Goals

**Goals:**
- The `string` slot is suggested only when the target palette's `rust` section defines `string`.
- The other five rust slots are always suggested, regardless of the palette's `rust` section contents.
- A skipped `string` slot claims no family for the least-common-hue assignment.
- The gate lives in `suggest()` so extraction and the fill command both honor it without per-caller logic.
- Extraction never fabricates `rust.string`: a theme that defines no semantic `string` rule derives and writes a palette without `string`.
- Byte-exact output for every committed palette, spec, and theme.

**Non-Goals:**
- Generalizing the gate to other rust slots or to other languages.
- Changing the least-common-hue algorithm, the fill command's conflict semantics, or extraction's overwrite behavior.
- Adding or removing slots from the rust registry.

## Decisions

1. **Gate the slot with a descriptor flag, filtered in `suggest()`.** Mark the rust `string` slot with a module-level flag (e.g. `requirePaletteSlot: true`) in `lib/suggest-rust.js`. After `validatePalette`, `suggest()` filters to `activeSlots = slots.filter((s) => !s.requirePaletteSlot || palette.rust[s.name] !== undefined)` and resolves against `activeSlots`.
   - *Why a flag, not a hardcoded name:* keeps `lib/suggest.js` language-agnostic and lets a future language reuse the same contract. `validatePalette` guarantees a non-empty `palette.rust` object, so `palette.rust[s.name] !== undefined` is the exact "included in the existing palette" test; a slot that is absent, or present with an empty rust section (defensive only, since validation rejects that), is skipped.
   - *Alternative considered:* filtering only in `lib/suggest-palette.js`. Rejected — extraction would still invent a `string` rule, and the user chose to apply the rule in `suggest()` itself.

2. **Filter before resolution, and pass `activeSlots` to the least-common-hue resolver.** A skipped slot neither emits an entry nor contributes to the claimed-family set, matching the spec requirement "Skipped slots claim no family". On a palette lacking `rust.string`, `green` is no longer claimed, so `docComment` selection is computed over the five active slots.
   - *Alternative considered:* resolve everything, then drop `string` from the result. Rejected — `string` would still claim `green` for `docComment`, contradicting the spec.

3. **Derivation drops `rust.string` when the theme has no semantic string rule.** `derive-palette.js` omits `rust.string` unless the theme's `semanticTokenColors` defines a `string` color. Without this, extraction's derived palette always resolves the slot through the token-scope probe (TextMate `string` scope, then `editor.foreground`), so the `suggest()` gate could never fire for extraction and the generated palette would still invent `rust.string`. The omission is `string`-specific: the other five rust slots keep the probe fallback, and a theme that defines a semantic string rule derives `string` exactly as before.
   - *Alternative considered:* keeping the probe fallback and gating only `suggest()`. Rejected — the derived palette always defines `string`, so the gate stays inert at extraction; a UAT extraction run on TextMate-only themes (solarized dark/light) still produced `rust.string` in the generated palette.

4. **Registration stays static.** The registry keeps all six rust slots; the gate is a per-call decision against the target palette. This preserves the registry contract (a registered module contributes its slots) and avoids registration-time errors.

5. **No change to fill or extraction bookkeeping.** The fill command's merge adds "every suggested slot the section lacks"; since the suggested set no longer contains `string` when the palette lacks it, `string` is never added. `--conflict-overwrite` replaces the section with the suggested set, so an overwrite also omits `string` for such palettes — consistent with the rule. Extraction output is unchanged for every committed built theme because each defines a semantic `string` rule, so `palette.rust.string` is present.

## Risks / Trade-offs

- **`docComment` family may differ on palettes lacking `rust.string`** → Intended per the spec; every committed palette defines `rust.string`, so no committed output changes. Tests pin determinism and the no-claim behavior on a crafted palette.
- **Extraction of TextMate-only themes changes** → A theme that colors strings only through TextMate rules (solarized dark/light, correia-gruvbox) now derives and writes a palette without `rust.string`. Intended per the spec; every committed built theme defines a semantic `string` rule, so committed extraction output is unchanged.
- **`--conflict-overwrite` on a palette that omits `rust.string` writes a section without `string`.** Consistent with the rule, but worth stating so no caller treats overwrite as a way to restore the full six-slot set. A palette that does define `string` is unaffected.
- **The flag is a new slot-descriptor contract.** The `string` slot already carries `families`, `factor`, and `floor`, so the flagged slot satisfies every resolver's requirements unchanged.
- **Semantic coupling between `string` and `docComment`** (skipping one shifts the other's family on some palettes) → Documented in the spec as "Skipped slots claim no family"; deterministic by construction and covered by tests.

## Migration Plan

Implementation and tests only — no config or data migration. The gate is inert for every committed palette and built theme (each defines `rust.string` / a semantic string rule), so existing byte-exact outputs are untouched and no rollback surface exists beyond reverting the filter, the flag, and the derivation gate.

## Open Questions

None that would change the specs, approach, or tasks. The exact family `docComment` selects on a future palette that omits `rust.string` is an output of the existing algorithm, not a design question.
