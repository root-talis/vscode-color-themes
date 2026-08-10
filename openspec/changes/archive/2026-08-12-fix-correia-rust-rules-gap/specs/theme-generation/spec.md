## MODIFIED Requirements

### Requirement: Separate Rust semantic color set
The palette SHALL define the Rust semantic colors in a section separate from the 16 base colors. The build's rust semantic layer SHALL apply regardless of the palette: the formatting properties (bold, italic, underline) SHALL be merged into `semanticTokenColors` on every build, whether or not the spec has a `semanticTokenColors` section and whether or not the palette has a `rust` section. The standard rust semantic colors SHALL be seeded from the palette's rust slots only when the palette has a non-empty `rust` section, for tokens the spec does not color; colors the spec defines SHALL take precedence over the seed.

#### Scenario: Rust set isolated from base set
- **WHEN** a palette is loaded
- **THEN** the Rust semantic set is enumerated separately from the 16 base colors and the build resolves semantic-token colors against it

#### Scenario: Rust palette seeds colors without spec semantics
- **WHEN** a palette has a non-empty `rust` section and the spec has no `semanticTokenColors` section (for example `palettes/correia-gruvbox.json` with `spec/correia-gruvbox.json`)
- **THEN** the build emits a `semanticTokenColors` section containing the standard rust tokens, each colored by the palette's rust slot (for example `macro` from `rust.macro`, `const` from `rust.const`, `variable.consuming` from `rust.consuming`, `string` from `rust.string`, `comment.documentation` from `rust.docComment`, `method` from `rust.method`)
- **AND** the formatting layer is applied, so `variable.consuming` is bold, `macro` is underlined, and `const` is italic

#### Scenario: Spec colors take precedence over the palette seed
- **WHEN** a spec defines a color for a standard rust token and the palette also declares a color for the same slot
- **THEN** the emitted entry keeps the spec's color and gains the layer's formatting properties

#### Scenario: Formatting applies without a rust palette
- **WHEN** the palette's `rust` section is empty or absent
- **THEN** the build adds no rust colors but SHALL still merge the formatting layer, adding the bold, italic, and underline properties to the entries in `semanticTokenColors` and adding formatting-only entries for formatting-only tokens the spec omits
