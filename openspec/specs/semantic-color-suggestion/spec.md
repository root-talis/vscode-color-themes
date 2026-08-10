## Purpose

Suggests a language's semantic color set from an extracted base palette, matching each slot to a hue family and generating a color whose contrast against the background is relative to that family's chromatic center.

## Requirements

### Requirement: Language suggestion registry
Suggestions SHALL be requested by language name through a registry. A registered language module SHALL contribute the semantic slots for that language, each with an ordered family preference list, a contrast factor, and a contrast floor. An unregistered language SHALL fail with a clear error naming the language and the registered languages.

#### Scenario: Registered language returns suggestions
- **WHEN** suggestions are requested for the registered language `rust` with a valid palette
- **THEN** a semantic color set is returned with a color for every registered rust slot, except `string` when the palette's `rust` section does not define it

#### Scenario: Unregistered language is rejected
- **WHEN** suggestions are requested for a language that is not registered
- **THEN** the request fails with a clear error that names the requested language and the registered languages

### Requirement: Rust string slot presence
The rust suggestion module's `string` slot SHALL be suggested only when the palette's `rust` section defines `string`. When the palette's `rust` section is absent, empty, or does not define `string`, the suggested set SHALL omit `string` and SHALL still include every other registered rust slot (`macro`, `consuming`, `const`, `method`, `docComment`).

#### Scenario: Palette defines rust.string
- **WHEN** suggestions are requested for `rust` against a palette whose `rust` section defines `string`
- **THEN** the suggested set includes `string`

#### Scenario: Palette omits rust.string
- **WHEN** suggestions are requested for `rust` against a palette whose `rust` section is absent, empty, or does not define `string`
- **THEN** the suggested set omits `string`
- **AND** the suggested set still includes `macro`, `consuming`, `const`, `method`, and `docComment`

#### Scenario: Extraction never fabricates a semantic string rule
- **WHEN** a theme that defines no semantic `string` rule (strings are colored through TextMate rules, or not at all) is extracted
- **THEN** the derived palette omits `string`
- **AND** the generated palette omits `string` and still includes `macro`, `consuming`, `const`, `method`, and `docComment`

#### Scenario: Extraction keeps a semantic string rule
- **WHEN** a theme whose `semanticTokenColors` defines `string` is extracted
- **THEN** the derived palette includes `string`

### Requirement: Skipped slots claim no family
A slot omitted from the suggested set SHALL take no part in the least-common-hue assignment: it SHALL not claim its preferred family, so family selection is computed over the slots that are actually suggested.

#### Scenario: docComment selection ignores a skipped string
- **WHEN** suggestions are requested for `rust` against a palette that omits `rust.string`
- **THEN** the least-common-hue assignment for `docComment` is computed without `string`'s preferred family being claimed

### Requirement: Hue-family borrowing
A slot with an ordered family list SHALL be derived from the extracted chromatic center of the first family in the list. The suggested color SHALL preserve that center's hue and chroma in OKLab space and SHALL differ from the center at most in lightness.

#### Scenario: Preferred family supplies the hue
- **WHEN** a slot's family list names a chromatic family present in the palette
- **THEN** the suggested color has the same hue angle and chroma as that family's chromatic center

#### Scenario: Lightness is the only adjusted component
- **WHEN** the target contrast differs from the family center's contrast
- **THEN** the suggested color differs from the center only in lightness, keeping hue and chroma

### Requirement: Relative contrast band
The suggested color's contrast against the palette background SHALL equal the family center's contrast times the slot's factor, never below the slot's floor. When the center's contrast times the factor already equals the center's contrast, the suggested color SHALL be the center itself.

#### Scenario: Borrow at factor one
- **WHEN** a slot has factor 1 and its family center's contrast meets the floor
- **THEN** the suggested color equals the family center exactly

#### Scenario: Floor rescues a weak family
- **WHEN** a slot's family center contrast is below the slot's floor
- **THEN** the suggested color keeps the center's hue and chroma and raises contrast to the floor

### Requirement: Least-common-hue slot strategy
A slot registered with the least-common-hue strategy SHALL be assigned after all fixed-family slots. It SHALL select the chromatic family that is not claimed by any other registered slot, has the fewest unclaimed families within a fixed OKLCH hue tolerance of 30 degrees, and, when tied, is closest to the blue family at 260 degrees. The suggested color then follows the relative-contrast band rule against that family's center.

A least-common-hue slot MAY declare a distinctness reference slot. The rust `docComment` slot declares `fg-muted`, the palette's regular comment color. When a distinctness reference is declared, the resolver SHALL walk the candidate families in the selection order above and SHALL use the first family whose suggested color is distinguishable from the reference color: the suggested color differs by at least a fixed minimum OKLab chroma (0.04), or by at least a fixed minimum OKLab lightness (0.20). When no candidate family passes, the resolver SHALL use the first family in the selection order. The reference slot is read from the palette's base; when the palette does not define it, the guard SHALL be skipped.

#### Scenario: docComment selects an under-used family
- **WHEN** the rust module assigns `method` to `blue` and the palette's remaining families include `cyan`
- **THEN** `docComment` resolves to the `cyan` family, which no other slot claims

#### Scenario: Strategy assignment is stable
- **WHEN** a palette is suggested twice with the least-common-hue strategy
- **THEN** both runs select the same family for the strategy slot

#### Scenario: A chromatic docComment passes the distinctness guard
- **WHEN** a palette's first-choice family yields a suggested color whose OKLab chroma meets the fixed minimum
- **THEN** `docComment` is resolved from that family, distinct from the palette's comment color by hue

#### Scenario: A lightness-different docComment passes the distinctness guard
- **WHEN** a palette's first-choice family yields a suggested color whose OKLab lightness differs from the palette's comment color by at least the fixed minimum
- **THEN** `docComment` is resolved from that family, distinct from the palette's comment color by lightness

#### Scenario: A too-similar docComment falls back to the next family
- **WHEN** a palette's first-choice family yields a suggested color that is neither chromatic nor lightness-different enough from the palette's comment color, and a later family in the selection order passes the guard
- **THEN** `docComment` is resolved from the later family

#### Scenario: No passing family falls back to the first choice
- **WHEN** no candidate family yields a suggested color distinguishable from the palette's comment color
- **THEN** `docComment` is resolved from the first family in the selection order

### Requirement: Deterministic suggestions
Suggesting the same language against the same palette SHALL produce byte-identical semantic color sets on every invocation.

#### Scenario: Repeat suggestion is stable
- **WHEN** suggestions are requested twice with the same language and palette
- **THEN** both results are identical

### Requirement: Palette validation
The suggestion provider SHALL accept only valid palettes: exactly 16 named base colors, a dark or light type, and every color a valid 6-digit hex. An invalid palette SHALL fail with a clear error and produce no suggestions.

#### Scenario: Invalid palette is rejected
- **WHEN** suggestions are requested with a palette missing a base slot or containing a non-hex color
- **THEN** the request fails with a clear error and returns no suggestions
