## MODIFIED Requirements

### Requirement: Auto-extracted, per-theme rule tables
The spec SHALL be produced automatically from a current theme, and the extract SHALL derive the theme's palette from the theme itself rather than accepting a palette as input. Each theme SHALL own an independent rule table; dark and light MAY assign the same theme key to different palette slots.

#### Scenario: Extraction reproduces its input
- **WHEN** the extractor runs on a current theme
- **THEN** it emits a palette and a spec, and building that palette and spec back reproduces the input theme byte-for-byte

#### Scenario: Extraction requires no palette input
- **WHEN** the extractor runs on a current theme without being given any palette file
- **THEN** the palette is derived from the theme and the extraction succeeds

#### Scenario: Independent theme mappings
- **WHEN** dark and light extraction assign the same theme key to different palette slots
- **THEN** each theme still builds byte-exact against its own committed file

## ADDED Requirements

### Requirement: Palette derived from theme
The extract SHALL recover the 16 base colors and the separate 6-color Rust semantic set from the input theme alone. Recovered palette colors SHALL satisfy the same validity rules as hand-written palettes: exactly 16 named base slots, a non-empty Rust set, a valid theme type, and every color a valid 6-digit hex. A theme color that only ever appears with an alpha byte SHALL still be recoverable from its RGB component.

#### Scenario: Complete palette recovery
- **WHEN** the extractor runs on a theme
- **THEN** the derived palette contains exactly 16 base slots and a 6-slot Rust set, every value is a valid 6-digit hex, and the `type` matches the theme's `type`

#### Scenario: Alpha-only color recovered
- **WHEN** a palette color appears in the theme only inside alpha-suffixed colors (for example `#17e5e633` and never `#17e5e6`)
- **THEN** the extract recovers the color from the RGB component of the alpha-suffixed values

#### Scenario: Invalid recovery is rejected
- **WHEN** the theme's structure cannot be mapped to a complete, valid palette
- **THEN** the extract fails with a clear error and writes no output files

### Requirement: Exact fixture recovery
For the committed `github-dark` and `github-light` fixtures, extraction SHALL recover the committed palette and spec exactly, not merely a byte-exact-equivalent alternative.

#### Scenario: Palette matches committed palette
- **WHEN** the extractor runs on `themes/github-dark-rust.json` and on `themes/github-light-rust.json`
- **THEN** the derived palette deep-equals the committed `palettes/github-dark.json` and `palettes/github-light.json` respectively

#### Scenario: Spec matches committed spec
- **WHEN** the extractor runs on `themes/github-dark-rust.json` and on `themes/github-light-rust.json`
- **THEN** the derived spec deep-equals the committed `spec/github-dark.json` and `spec/github-light.json` respectively

#### Scenario: Rebuild matches committed theme
- **WHEN** the committed github-dark and github-light themes are extracted and the derived palette and spec are built
- **THEN** the rebuilt theme matches the committed `themes/github-dark-rust.json` and `themes/github-light-rust.json` byte-for-byte

### Requirement: Deterministic extraction
Extracting the same theme twice SHALL produce byte-identical palette and spec outputs.

#### Scenario: Repeat extraction is stable
- **WHEN** the extractor runs twice on the same theme
- **THEN** both runs write identical palette and spec files

### Requirement: Extract command output contract
The extract command SHALL accept a theme file as its input and SHALL write both the derived palette and the derived spec as output files. The command SHALL NOT require a palette argument.

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
