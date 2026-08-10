## ADDED Requirements

### Requirement: Missing rust slot drops the color, keeps the rest
When a color reference in `semanticTokenColors`, `colors`, or `tokenColors` targets a rust slot absent from the palette's `rust` section, the build SHALL NOT fail. `semanticTokenColors` SHALL emit the affected entry without the unresolvable color: tokens with a formatting rule in `generator.json`'s `formatting.rust` SHALL be emitted with that formatting only, and tokens without one SHALL be omitted. `colors` SHALL omit the unresolvable key. `tokenColors` SHALL drop the unresolvable property and SHALL omit the entry when no settings remain. All other entries in all three sections SHALL resolve normally and, for `semanticTokenColors`, receive the rust formatting layer unchanged. A malformed expression or a resolution error other than a missing slot SHALL still fail the build with the current error.

#### Scenario: Derived token with missing rust slot keeps formatting
- **WHEN** a spec's `semanticTokenColors` colors a token through a derived token whose `ref` is a rust slot absent from the palette (for example `macro` = `{ "foreground": "rust.macro" }` with no `rust.macro` in the palette)
- **THEN** the build succeeds and the theme emits that token with the formatting layer's properties and no color (for example `macro` = `{ "underline": true }`)

#### Scenario: Direct reference to missing rust slot is omitted
- **WHEN** a spec's `semanticTokenColors` references a rust slot directly that the palette lacks (for example `string` = `"rust.string"` with no `rust.string` in the palette)
- **THEN** the build succeeds and the theme contains no entry for that token

#### Scenario: Formatting-only tokens are still added
- **WHEN** a rust slot is missing and the spec defines no color for a formatting-only token (for example `struct`)
- **THEN** the theme still emits that token's formatting-only entry (for example `struct` = `{ "bold": true }`)

#### Scenario: Unaffected entries resolve and format normally
- **WHEN** only one rust slot is missing from the palette
- **THEN** every other `semanticTokenColors` entry keeps its resolved color and receives the formatting layer exactly as today

#### Scenario: Missing rust slot in colors omits the key
- **WHEN** a `colors` key references a derived token whose rust slot is absent from the palette (for example `editor.findMatchBackground` = `"rust.string.d0@44"` with no `rust.string`)
- **THEN** the build succeeds, that key is omitted from the theme's `colors`, and every other `colors` key resolves normally

#### Scenario: Missing rust slot in tokenColors drops the property
- **WHEN** a `tokenColors` entry's `settings.foreground` references a derived token whose rust slot is absent from the palette (for example `settings.foreground` = `"rust.string.d0"` with no `rust.string`)
- **THEN** the build succeeds, the entry keeps its remaining `settings` properties, and an entry left with no settings is omitted

#### Scenario: Malformed expression still fails the build
- **WHEN** a color expression is malformed (for example an invalid alpha byte) or not a string, in any section
- **THEN** the build fails with the current error and produces no theme output
