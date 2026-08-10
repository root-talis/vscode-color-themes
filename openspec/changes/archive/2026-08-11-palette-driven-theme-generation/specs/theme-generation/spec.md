## Purpose

Builds full VS Code color themes from a 16-color palette plus a separate Rust semantic color set, deriving every other color in LAB space so that changing the palette produces a coherent new theme while the committed themes are reproduced byte-exactly.

## ADDED Requirements

### Requirement: Palette as the color input
A palette file SHALL define exactly 16 base colors plus a separate Rust semantic set, and SHALL identify the theme type (dark or light). The 16 base slot names SHALL be identical across the dark and light palettes. Every palette color SHALL be a valid 6-digit hex color.

#### Scenario: Valid palette loads
- **WHEN** a palette file contains 16 named base colors, a rust set, and a valid type
- **THEN** the build accepts it and resolves every referenced slot

#### Scenario: Invalid palette is rejected
- **WHEN** a palette is missing a base slot, or contains a color that is not valid 6-digit hex
- **THEN** the build fails with a clear error and produces no theme output

### Requirement: Byte-exact reproduction of committed themes
Building from the committed spec and palette SHALL reproduce the committed theme files byte-for-byte, after stripping `//` comment lines from the committed files.

#### Scenario: Snapshot equality
- **WHEN** the build runs against the committed spec and palette
- **THEN** the output matches the committed `themes/*.json` exactly (comment-stripped)

#### Scenario: No drift on rebuild
- **WHEN** the build runs twice against the same inputs
- **THEN** both outputs are byte-identical

### Requirement: LAB vector-offset derivation
Non-palette colors SHALL be derived as `lab2rgb(rgb2lab(base) + delta)` using absolute LAB vector offsets. Editing a palette color SHALL shift every derived color that references that base by the same absolute LAB vector, and SHALL leave colors referencing other bases unchanged. The color math SHALL round-trip `rgb → lab → rgb` exactly for every color in the palettes and committed themes.

#### Scenario: Base color change propagates
- **WHEN** a base color is changed and the theme is rebuilt
- **THEN** only colors whose derivation references that base change, each shifting by its stored LAB offset
- **AND** colors referencing other bases are byte-identical to the previous build

#### Scenario: Round-trip exactness
- **WHEN** every color in the palettes and committed themes is converted `rgb → lab → rgb`
- **THEN** each round-trip returns the original color exactly

### Requirement: Auto-extracted, per-theme rule tables
The spec SHALL be produced automatically from a current theme and its palette. Each theme SHALL own an independent rule table; dark and light MAY assign the same theme key to different palette slots.

#### Scenario: Extraction reproduces its input
- **WHEN** the extractor runs on a current theme with its palette
- **THEN** the resulting spec builds back to the input theme byte-for-byte

#### Scenario: Independent theme mappings
- **WHEN** dark and light extraction assign the same theme key to different palette slots
- **THEN** each theme still builds byte-exact against its own committed file

### Requirement: Spec expression grammar
A spec SHALL express each color as one of: a palette reference; a palette reference with a derived LAB delta and an optional alpha byte; a literal hex fallback; or a pass-through non-color value (bold, italic, underline).

#### Scenario: Expression resolution
- **WHEN** a spec value is `blue.d1@44`
- **THEN** the build resolves slot `blue`, applies delta `d1`, and applies alpha byte `0x44`

#### Scenario: Pass-through settings
- **WHEN** a spec value is `bold: true`
- **THEN** the build emits `bold: true` unchanged

### Requirement: Deterministic theme output
The build SHALL emit a valid theme JSON with the same keys as the committed themes, color keys ordered deterministically, and every emitted color a valid 6- or 8-digit hex.

#### Scenario: Structural completeness
- **WHEN** the build emits a theme
- **THEN** the output has identical key sets (colors / tokenColors / semanticTokenColors) to the committed theme
- **AND** every emitted color value is valid 6- or 8-digit hex

### Requirement: Commented entries dropped
Regenerated theme files SHALL NOT contain commented-out entries. Snapshot comparison SHALL strip comment lines from the committed files before comparing.

#### Scenario: Clean regenerated output
- **WHEN** the build emits a theme from a spec
- **THEN** the output contains no JSONC comment lines

### Requirement: Separate Rust semantic color set
The palette SHALL define the Rust semantic colors in a section separate from the 16 base colors.

#### Scenario: Rust set isolated from base set
- **WHEN** a palette is loaded
- **THEN** the Rust semantic set is enumerated separately from the 16 base colors and the build resolves semantic-token colors against it
