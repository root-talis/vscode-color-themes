## Context

See proposal.md — Why. The current themes are two hand-maintained 51KB JSONC files (~180 workbench colors, 49 TextMate scopes, 19 semantic token rules each). The committed themes are the source of truth: the pipeline must reproduce them byte-exactly while making the palette the single input for color changes.

Verified grounding from the actual theme files:
- 179 / 175 color keys, ~756 / 760 commented lines, 44 / 39 distinct base colors (dark / light).
- The 49 TextMate scopes map almost 1:1 onto the 16 color slots (44 byte-exact matches) — the slot model is real.
- The workbench `colors` layer has 15 exact palette matches; the rest are shades of the palette hues.

## Goals / Non-Goals

**Goals:**
- Palette-in → theme-out generation with stable, per-theme semantic rules.
- Byte-exact reproduction of committed themes (zero drift) via absolute LAB vector offsets.
- Rule tables auto-extracted (a build-time detail, not a curated artifact) and independent per theme.
- No new dependencies; built-in `node --test` runner.

**Non-Goals:**
- Relative/transferable derivation recipes (e.g., "darken 35%") — consciously rejected; see Decisions.
- A shared rule table across dark and light — consciously rejected.
- Preserving the ~750 commented-out entries in regenerated themes.
- `.vsix` packaging, version bumps, CHANGELOG, new theme variants.

## Decisions

**D1. Absolute LAB vector offsets, not relative recipes.**
Each non-palette color is stored as `lab2rgb(rgb2lab(slot) + [ΔL, Δa, Δb])`, where the delta is extracted from the current theme. This reproduces every current color byte-exactly (verified: 0/50000 round-trip failures; 12/12 GitHub pairs byte-exact), which is what the snapshot test pins.
*Alternative considered:* relative transforms ("darken 35%", HSL shifts) are more palette-portable but cannot reproduce arbitrary hand-picked colors exactly — the snapshot test would fail. The user's requirement of zero drift rules this out.
*Consequence:* deltas are absolute, so a swapped palette degrades gracefully only for same-hue palettes. Accepted.

**D2. Rule tables auto-extracted and independent per theme.**
The extractor computes, for each distinct theme color, the nearest palette slot (LAB distance) and the delta to it. Dark and light each run extraction against their own palette and emit their own spec. No human curation of assignments.
*Alternative considered:* extracting assignments from one theme and imposing them on the other yields a structurally identical dark/light pair, but the user explicitly chose independent tables.
*Known divergence (measured):* 70 of 175 keys present in both themes assign to different slots (e.g., `progressBar.background` → purple in dark, blue in light). Includes polarity inversions such as `activityBarBadge.foreground` → `fg` in dark but `bg` in light. All accepted.

**D3. Deterministic spec format with derived-token table.**
The spec stores the theme structure; color values are expressions (`blue.d1`, `blue.d1@44`, literal hex fallback). Non-color settings pass through. Extractor names derived tokens per slot, sorted by lightness (`.0..N`) so extraction is deterministic — same input, same spec, same output.

**D4. Comment stripping on snapshot comparison only.**
Regenerated files never contain comments; the snapshot test strips `//` lines and normalizes JSONC trailing commas from the committed files before deep-equality. This keeps committed themes as the golden reference without requiring edits to them.

**D5. One extractor runs per theme; build and extract are separate commands.**
`extract` (bootstrap, recomputes spec from theme + palette) and `build` (spec + palette → theme). The snapshot test exercises the full extract→build round-trip so a structural change to either theme is caught.

## Risks / Trade-offs

- [Polarity inversions from LAB-distance assignment] → `activityBarBadge.foreground` binds to `bg` (light). A palette swap can darken badge text toward the badge background → Mitigation: acknowledged; visible in the generated spec as `*.dN` entries; address per-theme if it ever bites.
- [Pair divergence under palette edits] → dark and light have different slot mappings, so editing "the same" slot in both palettes can move a given UI element in different directions → Mitigation: no mechanism; documented workflow (edit both palette files and review the pair).
- [Large deltas (ΔE up to ~46) mean some "derived" colors are nearly independent] → Mitigation: none required; byte-exactness is guaranteed by construction regardless of delta size.
- [Absolute deltas degrade on radically different palettes] → Mitigation: accepted limitation; palettes are expected to follow the GitHub design language.
- [Float rounding at derivation boundaries] → Mitigation: verified 0/50000 failures on the exact algorithm; round-trip unit test pins it.
