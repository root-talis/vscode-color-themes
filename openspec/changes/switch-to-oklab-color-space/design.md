## Context

See proposal.md — Why. The system uses CIELAB in four roles: delta storage (`lib/color.js`), distance matching (`lib/extract-spec.js`, `lib/derive-palette.js`), and the suggestion provider's lightness solve, distinctness guard, and hue matching (`lib/suggest.js`). The spec contract states these in LAB terms in `theme-generation` and `semantic-color-suggestion`.

Investigation with an OKLab probe (read-only, against the committed data) established three facts that shape this design:

- OKLab conversion round-trips `rgb → oklab → rgb` exactly for every committed palette color, so the byte-exact reproduction contract survives a space swap.
- Chromatic slot reassignment stays identical for 7 of 9 themes. It differs for `correia-gruvbox` and `solarized-light`, and the OKLab assignments are more accurate names (for example `#0431fa` at OKLab hue 264° lands on `blue`, where LAB hue 303° read it as violet).
- The distinctness guard classifies the three fixture cases identically at a new scale: `#72a59e` (OKLab chroma 0.055, |ΔL| 0.316) passes, `#7a9199` (0.029, 0.118) fails, `#b2b2b2` (0.000, 0.236) passes by lightness.

## Goals / Non-Goals

**Goals:**
- One color space, OKLab, across storage, matching, solve, guard, and hue — no hybrid.
- Round-trip `rgb → oklab → rgb` exact for every color in the palettes and committed themes.
- Byte-exact rebuild for the matched extraction pairs (`github-dark`, `github-light`, `solarized-dark`, `solarized-light`, `correia-gruvbox`).
- Perceptual decision constants recalibrated in OKLab/OKLCH terms and pinned by tests.
- Hue-explicit rules stated in OKLCH vocabulary at no structural cost.

**Non-Goals:**
- Changing the delta expression grammar shape (`ref` + `d: [ΔL, Δa, Δb]` + optional `@alpha`).
- Changing the least-common-hue family rule (unclaimed, fewest neighbors, blue tie-break) — only the space and the blue constant change.
- Changing the WCAG contrast math; relative luminance stays sRGB-based.
- Re-deriving the relative-contrast band factors and floors.
- Keeping the four composite themes byte-identical (explicitly exempted).

## Decisions

1. **OKLab rectangular everywhere for storage and math.** Replace the bodies of `rgb2lab`/`lab2rgb` with OKLab (Ottosson's matrices with cube roots), keeping the exported names and the delta shape. `labDelta`, `applyDelta`, and `validateDelta` stay as-is in structure; validation bounds become `L ∈ [0,1]`, `|a|,|b| ≤ 0.4`. `oklab2rgb` clamps to the sRGB gamut with the same final rounding policy as `lab2rgb`.
   - *Why OKLab, not OKLCH, for storage:* rectangular `[L, a, b]` composes linearly as vector deltas. Cylindrical `[L, C, h]` does not — hue wraps at 360° and is unstable near the neutral axis. This mirrors the existing design's choice of rectangular LAB `a, b` over LCH (see the archived `distinct-doc-comment` design).
   - *Alternatives considered:* (a) keep LAB for storage, use OKLab only for decisions — rejected, the change commits to one space end-to-end; (b) OKLCH cylindrical deltas — rejected above.

2. **OKLCH hue for the hue-explicit rules.** The least-common-hue selection computes hue as `atan2(b, a)` of OKLab — which is exactly OKLCH hue. `HUE_TOLERANCE` stays 30°, `BLUE_HUE` becomes 260° (the OKLab hue of the canonical `blue` reference `#3b82f6`; github's `blue` sits at 252°).
   - *Why:* the value is identical whether read as "OKLab derived hue" or "OKLCH hue," so the spec may say OKLCH where it operates on hue explicitly, with zero structural cost.

3. **Recalibrated distinctness guard constants.** `MIN_CHROMA = 0.04`, `MIN_LIGHTNESS_DELTA = 0.20`, computed as `hypot(a, b)` and `|ΔL|` in OKLab. These reproduce the observed classification exactly: the passing teal (0.055) clears 0.04, the failing gray (0.029) does not, and the lightness-passing gray (0.236) clears 0.20.
   - *Why fixed values, not derived:* the same calibration method as the archived `distinct-doc-comment` change — thresholds chosen so the guard classifies the observed cases exactly, pinned by tests across all nine committed palettes.

4. **Distance metrics move to OKLab.** `extractSpec`'s nearest-slot and `derivePalette`'s Hungarian assignment both use Euclidean distance in OKLab. Expected consequences: `correia-gruvbox` and `solarized-light` reassignments change to more accurate names; `github-dark`/`github-light` stay identity. Matched extraction pairs still rebuild byte-exact because the round-trip is exact.

5. **Round-trip exactness is a hard gate.** Add a regression test that converts every color in the palettes and committed themes `rgb → oklab → rgb` and asserts exact reconstruction, mirroring today's `test/color.test.js` corpus. Extraction recomputes deltas at full float precision, so stored delta precision is not a concern.

6. **Composite themes are exempt from byte-exact equality.** Themes built from a github spec and a non-github palette (`gk-semantic_github-tomorrow`, `gk-semantic_github-tomorrow-night`, `gk-semantic_github-gruvbox-dark`, `gk-semantic_github-gruvbox-light`) are cross-products, not extractions. Their committed files encode LAB-tuned deltas applied to foreign palettes; under OKLab the results legitimately differ. The snapshot test scopes byte-exact equality to the matched pairs and regenerates the four composite files.

7. **Suggestion drift is accepted and pinned by regeneration.** The extract command seeds each palette's `rust` section from the suggestion provider, so under OKLab the committed `rust` colors and the docComment rules derived from them regenerate. Tests that assert committed rust colors are updated to the regenerated values.

## Risks / Trade-offs

- **Two palettes' chromatic slot names change** → Intended: the new names are perceptually more accurate (`#0431fa` → `blue`, `#e78a4e` → `orange`). The `correia-gruvbox` and `solarized-light` fixtures re-commit; the deep-equality scenarios in the spec are limited to the github pairs, which stay identity.
- **Guard constants are empirical, not derived from theory** → They reproduce the accepted/rejected classification across all nine palettes and are pinned by tests. If implementation surfaces a counterexample, the constants and the spec scenarios are revised together.
- **Composite themes change** → Expected and explicitly exempted; the four files regenerate and re-commit.
- **OKLab hue crowding near red/pink** → github-dark's `red` (hue 15°) and `pink` (hue 12°) are nearly the same OKLab hue; family separation depends on the canonical references. Checked during implementation; no spec impact.
- **OKLab conversion has more operations (cube roots) than LAB** → Round-trip exactness is verified over the full committed corpus, not just the palettes, before fixtures re-commit.

## Migration Plan

Implementation and tests only; no data migration. Sequence:

1. Replace the conversion math and validation bounds in `lib/color.js`; run the round-trip corpus test over every committed palette and theme color.
2. Recalibrate the suggestion constants; regenerate all nine palettes (`rust` sections) and the four composite themes via extract and build.
3. Regenerate `spec/*.json` deltas via extraction; verify the matched pairs rebuild byte-exact.
4. Update snapshot/extract/suggest tests, including the composite exemption.
5. Re-commit regenerated `spec/*.json`, `palettes/*.json`, and `themes/*.json`.

Rollback is reverting `lib/color.js` and the regenerated artifacts. The composite exemption is the only committed-fixture behavior that does not restore by re-extraction; rolling back the color math restores it.

## Open Questions

None.
