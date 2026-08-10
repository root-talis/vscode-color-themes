## MODIFIED Requirements

### Requirement: Language suggestion registry
Suggestions SHALL be requested by language name through a registry. A registered language module SHALL contribute the semantic slots for that language, each with an ordered family preference list, a contrast factor, and a contrast floor. An unregistered language SHALL fail with a clear error naming the language and the registered languages.

#### Scenario: Registered language returns suggestions
- **WHEN** suggestions are requested for the registered language `rust` with a valid palette
- **THEN** a semantic color set is returned with a color for every registered rust slot, except `string` when the palette's `rust` section does not define it

#### Scenario: Unregistered language is rejected
- **WHEN** suggestions are requested for a language that is not registered
- **THEN** the request fails with a clear error that names the requested language and the registered languages

## ADDED Requirements

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
