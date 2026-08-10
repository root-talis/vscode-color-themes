## ADDED Requirements

### Requirement: Generator config structure
`generator.json` SHALL be a single object with a `themes` key and a `formatting` key. The `themes` key SHALL hold the array of theme registrations, each containing `name`, `spec`, and `palette`. The `formatting` key SHALL hold a `rust` subkey whose value is the map from semantic token selector to the formatting properties (bold, italic, underline) the rust semantic formatting layer applies to that selector on every build.

#### Scenario: Theme registrations read from the themes key
- **WHEN** the build loads `generator.json`
- **THEN** it reads the theme registrations from the `themes` key

#### Scenario: Formatting styles read from the formatting.rust key
- **WHEN** the build loads `generator.json`
- **THEN** the rust semantic formatting layer's styles are the `formatting.rust` map

## MODIFIED Requirements

### Requirement: Rust semantic formatting layer
The generator SHALL apply a single, theme-independent rust formatting layer to the emitted theme on every build, whether or not the palette has a `rust` section and whether or not the spec has a `semanticTokenColors` section. The layer SHALL add the rust-specific formatting properties (bold, italic, underline) for the semantic token selectors that distinguish the rust variants from the standard GitHub variants, merging formatting into entries the spec defines and adding formatting-only entries the spec omits. The layer SHALL NOT change any color. The layer's styles (the selector to formatting-property map) SHALL be defined in `generator.json`'s `formatting.rust` key and imported by the generator from that key on every build; the generator SHALL NOT hardcode the styles in code.

#### Scenario: Layer is added on every build
- **WHEN** the build runs
- **THEN** the emitted `semanticTokenColors` include the rust formatting entries, among them `struct` bold, `enum` bold+italic, `namespace` italic, `*.reference` italic, `variable.mutable` underline, `*.consuming` bold, and `keyword.async` italic
- **AND** no color value differs from a build without the layer

#### Scenario: Styles are imported from generator config
- **WHEN** the build loads `generator.json`
- **THEN** the formatting properties applied for each rust selector are exactly the ones declared in the `formatting.rust` key

#### Scenario: Config edit changes every theme's formatting
- **WHEN** a formatting property in `generator.json`'s `formatting.rust` key is edited and the build runs
- **THEN** every emitted theme reflects the edited property for that selector

#### Scenario: Colors are merged, not replaced
- **WHEN** the spec defines a color for a semantic token that the layer also formats (for example `macro`, `derive`, `variable.consuming`, or `const`)
- **THEN** the emitted entry keeps the spec's color expression and gains the layer's formatting properties

#### Scenario: Formatting-only tokens are added
- **WHEN** the spec defines no color for a formatting-only token in the layer (for example `struct`, `enumMember`, or `typeParameter`)
- **THEN** the emitted entry is the layer's formatting alone

#### Scenario: Formatting applies without a rust palette
- **WHEN** the palette's `rust` section is empty or absent
- **THEN** the build adds no seeded rust colors but SHALL still merge the rust formatting entries into `semanticTokenColors`

#### Scenario: Committed themes are unchanged
- **WHEN** the build runs against the committed color-only specs and their palettes
- **THEN** every committed `themes/*.json` is reproduced byte-for-byte
