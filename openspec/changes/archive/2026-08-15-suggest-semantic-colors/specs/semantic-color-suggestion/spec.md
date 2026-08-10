## Purpose

Suggests a language's semantic color set from an extracted base palette, matching each slot to a hue family and generating a color whose contrast against the background is relative to that family's chromatic center.

## ADDED Requirements

### Requirement: Language suggestion registry
Suggestions SHALL be requested by language name through a registry. A registered language module SHALL contribute the semantic slots for that language, each with an ordered family preference list, a contrast factor, and a contrast floor. An unregistered language SHALL fail with a clear error naming the language and the registered languages.

#### Scenario: Registered language returns suggestions
- **WHEN** suggestions are requested for the registered language `rust` with a valid palette
- **THEN** a semantic color set is returned with a color for every registered rust slot

#### Scenario: Unregistered language is rejected
- **WHEN** suggestions are requested for a language that is not registered
- **THEN** the request fails with a clear error that names the requested language and the registered languages

### Requirement: Hue-family borrowing
A slot with an ordered family list SHALL be derived from the extracted chromatic center of the first family in the list. The suggested color SHALL preserve that center's hue and chroma in LAB space and SHALL differ from the center at most in lightness.

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
A slot registered with the least-common-hue strategy SHALL be assigned after all fixed-family slots. It SHALL select the chromatic family that is not claimed by any other registered slot, has the fewest unclaimed families within a fixed hue tolerance of 30 degrees, and, when tied, is closest to the blue family at 210 degrees. The suggested color then follows the relative-contrast band rule against that family's center.

#### Scenario: docComment selects an under-used family
- **WHEN** the rust module assigns `method` to `blue` and the palette's remaining families include `cyan`
- **THEN** `docComment` resolves to the `cyan` family, which no other slot claims

#### Scenario: Strategy assignment is stable
- **WHEN** a palette is suggested twice with the least-common-hue strategy
- **THEN** both runs select the same family for the strategy slot

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
