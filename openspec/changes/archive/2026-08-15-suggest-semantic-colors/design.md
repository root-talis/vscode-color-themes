## Context

See proposal.md - Why. The extractor derives a 16-color palette and a rust semantic set from a theme via role anchors (`lib/derive-palette.js`). The palette shape is fixed: 16 base colors (8 neutral, 8 chromatic) plus a `rust` section of 6 semantic colors. Color math lives in `lib/color.js` (LAB conversions, HSL, relative luminance). When a theme defines no usable rust colors, the rust section has no palette-grounded hue — this change lets extraction seed it from suggestions derived from the extracted palette itself.

## Goals / Non-Goals

**Goals:**
- A language-agnostic suggestion algorithm whose only inputs are the extracted palette and a per-language slot configuration.
- A `rust` configuration module following the safe/harmonious "borrow" convention: each slot takes its hue and chroma from a chromatic family center and adjusts only lightness.
- A registry so a future language adds one config module and one registry entry.
- Deterministic, validated output; reuse of `lib/color.js`; no new dependencies.

**Non-Goals:**
- Reproducing the hand-authored github rust palettes or any committed palette. Suggestions are "acceptable" defaults, not reconstructions.
- Per-slot chroma boosts (the github-dark "pop" slots are a taste choice, not a rule).
- Language modules beyond Rust in this change.
- Changing default extraction output.

## Decisions

**D1: Registry with config-only language modules.**
`lib/suggest.js` hosts the registry and the shared algorithm; `lib/suggest-rust.js` exports `{ name: 'rust', slots: [...] }` and nothing else. A slot is `{ families: [...] }` (ordered preference) or `{ strategy: 'least-common-hue', factor, floor }`. Future languages are new config files plus a registry line. Alternative rejected: per-language algorithm subclasses — adds a class hierarchy for what is currently pure data.

**D2: Borrow convention, factor 1.0, floor as the only nudge.**
Six palettes were analyzed. Four (tomorrow, tomorrow-night, gruvbox-dark, gruvbox-light) map each rust slot to a chromatic center identically (contrast ratio 1.00, LAB distance 0). github-dark/light use dedicated colors on the same hue ray at 0.76-0.99 of the center's contrast. Defaulting to factor 1.0 reproduces the four-palette plurality exactly where the floor is met; the floor is the safety net that rescues weak families (github-light's 2.13:1 yellow, where `const` is pushed to 3.5:1; tomorrow's 1.86:1 yellow `const`; and gruvbox-light's 2.73:1 green `string` and 2.19:1 yellow `const`, each pushed to 3.5:1 on the same hue ray). Alternative rejected: github-style soft factors (0.8-0.9) — less safe for arbitrary themes.

**D3: docComment uses a least-common-hue strategy, not a fixed family.**
The palettes split on docComment (github: blue; tomorrow/gruvbox: neutral gray). The chosen rule: after fixed-family slots are assigned, pick the chromatic family no other slot claims that has the fewest unclaimed neighbors within 30 degrees, tie-breaking toward blue (210 degrees). Validated across all six palettes: it converges on `cyan` every time, because `method` already claims `blue`. This gives a genuinely chromatic, under-used hue (teal) without a fixed-family table that would collide with `method`. Alternative rejected: neutral gray (safe but colorless) and fixed blue (collides with `method` under the borrow convention).

**D4: Lightness-solve with preserved hue and chroma.**
The suggested color = the family center's LAB `(a, b)` at a lightness `L` found by bisection so `contrast(color, bg)` hits the target; sRGB-clamped. Alternative rejected: interpolating on the `bg -> center` ray. The ray model matches github's soft slots but its "pop" slots sit off-ray with boosted chroma, and the ray is unnecessary once chroma stays fixed — lightness-solve reproduces the four identity palettes within ~3 LAB units.

**D5: Opt-in CLI flag on the extract command.**
`extract-spec.js` gains a flag that, when set, fills the derived palette's `rust` section from the rust suggestion module. Default output is byte-identical to today, so committed palettes/specs and the byte-exact rebuild self-check are untouched.

## Risks / Trade-offs

- Gamut clipping: at extreme lightness targets (light themes pushing a slot very dark) hue/chroma can clip in sRGB → the suggested color may desaturate. Mitigation: targets are capped by the floor, which is modest (3.0-3.5); the bisection stays in-gamut by clamping to black/white.
- Palette hue mislabels: a family whose name lies about its hue (gruvbox's `cyan` `#8ec07c` is numerically green) propagates the mislabel into the suggestion. Mitigation: accept — the rule operates on the palette as given; a suggestion cannot know the designer's intent.
- Loud comments: github-dark's `cyan` is the brightest family (9.35:1), so `docComment` lands near 7:1. Mitigation: `docComment`'s factor is 0.75; if it still reads too loud, lower the factor without changing the algorithm.
- Calibrated constants (families, factor, floor, tolerance) are empirical, drawn from six palettes. Mitigation: they live in config modules, so they are tunable without code changes.

## Migration Plan

No migration: the flag is additive and default output is unchanged. Rollback is removing the flag wiring.

## Open Questions

None — the deferred tunables (exact factors, the 30-degree tolerance) are constants in config, adjustable without changing specs, design, or task breakdown.
