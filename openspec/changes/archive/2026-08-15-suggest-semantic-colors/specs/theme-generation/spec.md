## MODIFIED Requirements

### Requirement: Extract command output contract
The extract command SHALL accept a theme file as its input and SHALL write both the derived palette and the derived spec as output files. The command SHALL NOT require a palette argument. The derived palette's `rust` section SHALL always be filled from the semantic-color-suggestion provider for the Rust language, replacing the theme's own rust anchors. The derived base palette SHALL keep the theme's own colors unchanged. The derived spec SHALL express every `colors` and `tokenColors` color as a reference to a base slot (or a derived token of a base slot), never to a `rust.*` slot, so that replacing the palette's `rust` section changes only the theme's `semanticTokenColors`; the spec's `semanticTokenColors` SHALL keep the theme's own semantic anchors as `rust.*` references unchanged by the suggestion step.

#### Scenario: Theme in, palette and spec out
- **WHEN** the extract command runs with a single theme file argument
- **THEN** it writes one palette file and one spec file, and reports the written paths

#### Scenario: Output self-check
- **WHEN** the extract command has derived a palette and spec from a theme
- **THEN** it rebuilds the theme from them into a temporary file
- **AND** the rebuilt file matches the input theme byte-for-byte

#### Scenario: Verification failure notifies the user
- **WHEN** the rebuilt theme does not match the input theme byte-for-byte
- **THEN** the command notifies the user that verification failed
- **AND** the command writes no palette or spec output files

#### Scenario: Rust section always seeded from suggestions
- **WHEN** the extract command runs on a theme
- **THEN** the derived palette's `rust` section holds the six suggested rust colors produced by the semantic-color-suggestion provider for the `rust` language

#### Scenario: Base and spec preserve the theme
- **WHEN** the extract command runs on a theme
- **THEN** the derived base palette and the spec's `colors`, `tokenColors`, and `semanticTokenColors` hold the theme's own colors and semantic anchors, unchanged by the suggestion step

#### Scenario: Rebuilding with the suggested palette changes only semantic colors
- **WHEN** a theme is extracted, its palette's `rust` section is seeded from suggestions, and the theme is rebuilt from that palette and the derived spec
- **THEN** the rebuilt theme's `colors` and `tokenColors` are byte-identical to the input theme
- **AND** only the `semanticTokenColors` entries differ, taking the suggested rust colors
