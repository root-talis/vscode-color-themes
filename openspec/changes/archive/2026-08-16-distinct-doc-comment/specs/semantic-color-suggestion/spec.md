## MODIFIED Requirements

### Requirement: Least-common-hue slot strategy
A slot registered with the least-common-hue strategy SHALL be assigned after all fixed-family slots. It SHALL select the chromatic family that is not claimed by any other registered slot, has the fewest unclaimed families within a fixed hue tolerance of 30 degrees, and, when tied, is closest to the blue family at 210 degrees. The suggested color then follows the relative-contrast band rule against that family's center.

A least-common-hue slot MAY declare a distinctness reference slot. The rust `docComment` slot declares `fg-muted`, the palette's regular comment color. When a distinctness reference is declared, the resolver SHALL walk the candidate families in the selection order above and SHALL use the first family whose suggested color is distinguishable from the reference color: the suggested color differs by at least a fixed minimum LAB chroma, or by at least a fixed minimum LAB lightness. When no candidate family passes, the resolver SHALL use the first family in the selection order. The reference slot is read from the palette's base; when the palette does not define it, the guard SHALL be skipped.

#### Scenario: docComment selects an under-used family
- **WHEN** the rust module assigns `method` to `blue` and the palette's remaining families include `cyan`
- **THEN** `docComment` resolves to the `cyan` family, which no other slot claims

#### Scenario: Strategy assignment is stable
- **WHEN** a palette is suggested twice with the least-common-hue strategy
- **THEN** both runs select the same family for the strategy slot

#### Scenario: A chromatic docComment passes the distinctness guard
- **WHEN** a palette's first-choice family yields a suggested color whose LAB chroma meets the fixed minimum
- **THEN** `docComment` is resolved from that family, distinct from the palette's comment color by hue

#### Scenario: A lightness-different docComment passes the distinctness guard
- **WHEN** a palette's first-choice family yields a suggested color whose LAB lightness differs from the palette's comment color by at least the fixed minimum
- **THEN** `docComment` is resolved from that family, distinct from the palette's comment color by lightness

#### Scenario: A too-similar docComment falls back to the next family
- **WHEN** a palette's first-choice family yields a suggested color that is neither chromatic nor lightness-different enough from the palette's comment color, and a later family in the selection order passes the guard
- **THEN** `docComment` is resolved from the later family

#### Scenario: No passing family falls back to the first choice
- **WHEN** no candidate family yields a suggested color distinguishable from the palette's comment color
- **THEN** `docComment` is resolved from the first family in the selection order
