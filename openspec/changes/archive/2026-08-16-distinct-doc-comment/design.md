## Context

See proposal.md — Why. The suggestion provider (`lib/suggest.js`) resolves a language's registered slots against a validated palette. `resolveLeastCommonHue(slot, slots, palette)` orders the unclaimed chromatic families by fewest hue neighbors within the 30-degree tolerance, tie-breaking toward blue at 210 degrees, then applies the relative-contrast band (`max(centerContrast * factor, floor)`, `solveLightness`) against the winning family's center. The rust module (`lib/suggest-rust.js`) registers `docComment` with this strategy and factor 0.75, floor 3.0.

The failure mode is a palette whose chosen family is near-neutral: the suggested color inherits the family's low chroma, so it lands close to the regular comment color. `solarized-light` is the live case — its `pink` slot is the gray `#657b83`, and `docComment` currently resolves to `#7a9199`, a gray nearly the same lightness as the theme's comment color.

## Goals / Non-Goals

**Goals:**
- A least-common-hue suggestion is distinguishable from the palette's regular comment color (`fg-muted`): either chromatic enough or lightness-different enough.
- When the top candidate fails the guard, the next candidate in the existing selection order is tried; the first passing family wins.
- Output is byte-identical for every committed palette except `solarized-light`.
- The guard is opt-in per slot, keeping the provider language-agnostic.

**Non-Goals:**
- Changing the family selection rule (unclaimed, fewest neighbors, blue tie-break) or the relative-contrast band.
- Extending the guard to fixed-family slots or other languages.
- Comparing against the theme's literal `comment` token color — the provider only sees the palette; `fg-muted` is its comment-color proxy.

## Decisions

1. **Per-slot opt-in via a `distinctFrom` descriptor field.** The rust `docComment` slot becomes `{ name: 'docComment', strategy: 'least-common-hue', factor: 0.75, floor: 3.0, distinctFrom: 'fg-muted' }`. `resolveLeastCommonHue` reads the referenced base slot as the comparison color.
   - *Why a field, not a hardcoded name:* keeps `lib/suggest.js` language-agnostic, mirrors the existing `requirePaletteSlot` slot-contract pattern, and lets a future language opt in with its own reference.
   - *Alternative considered:* hardcoding the guard into every least-common-hue slot. Rejected — the guard is a docComment-specific contract, not an inherent property of the strategy.

2. **Compare the resolved color against the reference, not the family center.** The guard computes the final suggested color per candidate (relative-contrast band against that family) and tests it against the reference: pass iff `LAB chroma >= 15` OR `|ΔL| >= 20`. Testing the resolved color is what keeps `solarized-dark`'s currently-good gray `docComment` (`#b2b2b2`, chroma 0) passing via its lightness gap to `fg-muted` `#ffffff` (ΔL 27), while rejecting `solarized-light`'s `#7a9199` (chroma 9.4, ΔL 17.5). A center-based test would wrongly reject both.
   - *Threshold values:* 15 (LAB chroma) and 20 (LAB lightness) are design parameters chosen so the guard classifies the observed cases exactly: `tomorrow-night`'s muted-teal `#72a59e` (chroma 18.5) passes, `solarized-light`'s gray `#7a9199` fails. They live as module constants next to `HUE_TOLERANCE` and `BLUE_HUE`.
   - *Alternatives considered:* (a) requiring a fixed minimum chroma only — rejected, it would reject `solarized-dark`'s lightness-distinguished gray; (b) a single LAB distance threshold — rejected, a uniform ΔE mixes the two acceptable axes and is harder to state as a contract; (c) hue-distance threshold — rejected, hue angle is unstable for near-neutral colors, exactly the failing case.

3. **Walk the selection order and return the first passing family; fall back to the first family when none passes.** The candidate order is exactly today's ordering (fewest neighbors, then blue tie-break, over `CHROMATIC_FAMILIES`). The resolver iterates it, computes each candidate's band color, and returns the first that passes the guard. If no candidate passes, the first candidate's color is returned so the resolver stays total (no new error path). The `no unclaimed chromatic family` error is unchanged.
   - *Why iterate rather than re-rank:* the guard is a veto, not a new priority — the least-common-hue family rule stays the primary ordering, and the guard only skips candidates that would produce a comment-like color.

4. **Reference lookup falls back safely.** The comparison color is `palette.base[slot.distinctFrom]`, falling back to `palette.base.fg`, then to "no guard" when neither exists. Validation guarantees 16 base colors but not their names, so a crafted palette without `fg-muted` must not crash; the guard is a quality improvement, not a hard contract in that edge.

5. **Update the committed solarized-light outputs.** `palettes/solarized-light.json` `docComment` moves to the cyan-derived teal (`#289f96`, chroma 34), and the built `themes/gk-semantic_solarized-light.json` `comment.documentation` follows when the theme is rebuilt. No other palette or theme changes.

## Risks / Trade-offs

- **`solarized-dark` keeps a gray `docComment`** → Intended: it is lightness-distinguished from the comment color, which the user classifies as acceptable. The guard's resolved-color check (decision 2) is what preserves it.
- **Thresholds are design parameters, not derived from theory** → They reproduce the accepted/rejected classification across all nine committed palettes. They are pinned by tests so future palettes can be checked against the same contract.
- **A palette with no passing family falls back to a possibly comment-like color** → The resolver stays total; the guard degrades gracefully rather than failing suggestion for the whole language.
- **Only `solarized-light` output changes** → Confirmed by prototype against all nine committed palettes; the regression test asserts the other eight keep their committed `docComment`.

## Migration Plan

Implementation and tests only — no config or data migration. Re-suggesting `solarized-light` (extract or fill) produces the new `docComment`; other palettes are untouched. Rollback is reverting the resolver change and the two output files.

## Open Questions

None.
