## MODIFIED Requirements

### Requirement: Auto-extracted, per-theme rule tables
The spec SHALL be produced automatically from a current theme and its palette. Each theme SHALL own an independent rule table; dark and light MAY assign the same theme key to different palette slots. The extracted spec SHALL store only color expressions in `semanticTokenColors`; the rust formatting layer (the bold, italic, and underline properties generated from the palette's rust section) SHALL be stripped before the spec is written, and the extraction rebuild self-check SHALL apply that layer so the input theme is reproduced byte-for-byte.

#### Scenario: Extraction reproduces its input
- **WHEN** the extractor runs on a current theme with its palette and rebuilds via the rule-applying build
- **THEN** the resulting spec builds back to the input theme byte-for-byte
- **AND** the extracted spec's `semanticTokenColors` contain none of the rust formatting layer's properties (no generated bold, italic, or underline keys)

#### Scenario: Independent theme mappings
- **WHEN** dark and light extraction assign the same theme key to different palette slots
- **THEN** each theme still builds byte-exact against its own committed file

#### Scenario: Committed spec recovery stays exact
- **WHEN** extraction runs against `themes/github-dark-rust.json` or `themes/github-light-rust.json`
- **THEN** the derived palette and color-only spec deep-equal the committed `palettes/github-{dark,light}.json` and `spec/github-{dark,light}.json`

### Requirement: Separate Rust semantic color set
The palette SHALL define the Rust semantic colors in a section separate from the 16 base colors. A non-empty `rust` section SHALL seed the standard rust semantic colors for tokens the spec leaves colorless, while the rust formatting layer applies on every build regardless of the palette.

#### Scenario: Rust set isolated from base set
- **WHEN** a palette is loaded
- **THEN** the Rust semantic set is enumerated separately from the 16 base colors and the build resolves semantic-token colors against it

#### Scenario: Rust palette seeds the standard rust colors
- **WHEN** a palette has a non-empty `rust` section and the spec leaves a standard rust token colorless
- **THEN** the build seeds that token's color from the palette's rust slot and merges the rust formatting layer into the emitted `semanticTokenColors`

## ADDED Requirements

### Requirement: Rust semantic formatting layer
The generator SHALL apply a single, theme-independent rust formatting layer to the emitted theme on every build, whether or not the palette has a `rust` section and whether or not the spec has a `semanticTokenColors` section. The layer SHALL add the rust-specific formatting properties (bold, italic, underline) for the semantic token selectors that distinguish the rust variants from the standard GitHub variants, merging formatting into entries the spec defines and adding formatting-only entries the spec omits. The layer SHALL NOT change any color.

#### Scenario: Layer is added on every build
- **WHEN** the build runs
- **THEN** the emitted `semanticTokenColors` include the rust formatting entries, among them `struct` bold, `enum` bold+italic, `namespace` italic, `*.reference` italic, `variable.mutable` underline, `*.consuming` bold, and `keyword.async` italic
- **AND** no color value differs from a build without the layer

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

### Requirement: Rust-rules exclusion flag
The build CLI SHALL accept a flag that excludes the rust formatting layer. When the flag is set, the emitted theme SHALL be exactly what the palette and spec alone define, with none of the layer's formatting entries, so that a theme can be reconstructed exactly from an extracted palette and spec when testing how well palette and spec extraction worked.

#### Scenario: Flag disables the layer
- **WHEN** the build runs with the exclusion flag on a rust palette and a spec with a `semanticTokenColors` section
- **THEN** the emitted `semanticTokenColors` contain only the spec's color entries and none of the layer's formatting entries

#### Scenario: Flag output isolates the extraction artifact
- **WHEN** extraction runs on a committed rust theme and the build runs on the extracted palette and spec with the exclusion flag
- **THEN** every emitted color matches the corresponding color of the input theme
- **AND** the emitted `semanticTokenColors` contain none of the rust formatting layer's properties
