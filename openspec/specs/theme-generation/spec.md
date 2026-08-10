## Purpose

Builds full VS Code color themes from a 16-color palette plus a separate Rust semantic color set, deriving every other color in OKLab space so that changing the palette produces a coherent new theme while the committed themes are reproduced byte-exactly.

## Requirements

### Requirement: Palette as the color input
A palette file SHALL define exactly 16 base colors plus a separate Rust semantic set, and SHALL identify the theme type (dark or light). The 16 base slot names SHALL be identical across the dark and light palettes. Every palette color SHALL be a valid 6-digit hex color.

#### Scenario: Valid palette loads
- **WHEN** a palette file contains 16 named base colors, a rust set, and a valid type
- **THEN** the build accepts it and resolves every referenced slot

#### Scenario: Invalid palette is rejected
- **WHEN** a palette is missing a base slot, or contains a color that is not valid 6-digit hex
- **THEN** the build fails with a clear error and produces no theme output

### Requirement: Byte-exact reproduction of committed themes
Building from the committed spec and palette SHALL reproduce the committed theme files byte-for-byte, after stripping `//` comment lines from the committed files. Themes built from a github spec combined with a non-github palette SHALL be excluded from byte-for-byte reproduction; their committed files MAY differ from the rebuilt output.

#### Scenario: Snapshot equality
- **WHEN** the build runs against a committed spec and palette whose spec was extracted from that same theme (for example `github-dark`, `github-light`, `solarized-dark`, `solarized-light`, or `correia-gruvbox`)
- **THEN** the output matches the committed `themes/*.json` exactly (comment-stripped)

#### Scenario: Composite themes may differ
- **WHEN** the build runs against a github spec combined with a non-github palette (for example `spec/github-dark.json` with `palettes/tomorrow-night.json`, producing `gk-semantic_github-tomorrow-night`)
- **THEN** the output is exempt from byte-for-byte equality with the committed file and MAY differ from it

#### Scenario: No drift on rebuild
- **WHEN** the build runs twice against the same inputs
- **THEN** both outputs are byte-identical

### Requirement: OKLab vector-offset derivation
Non-palette colors SHALL be derived as `oklab2rgb(rgb2oklab(base) + delta)` using absolute OKLab vector offsets. Editing a palette color SHALL shift every derived color that references that base by the same absolute OKLab vector, and SHALL leave colors referencing other bases unchanged. The color math SHALL round-trip `rgb → oklab → rgb` exactly for every color in the palettes and committed themes.

#### Scenario: Base color change propagates
- **WHEN** a base color is changed and the theme is rebuilt
- **THEN** only colors whose derivation references that base change, each shifting by its stored OKLab offset
- **AND** colors referencing other bases are byte-identical to the previous build

#### Scenario: Round-trip exactness
- **WHEN** every color in the palettes and committed themes is converted `rgb → oklab → rgb`
- **THEN** each round-trip returns the original color exactly

### Requirement: Auto-extracted, per-theme rule tables
The spec SHALL be produced automatically from a current theme, and the extract SHALL derive the theme's palette from the theme itself rather than accepting a palette as input. Each theme SHALL own an independent rule table; dark and light MAY assign the same theme key to different palette slots. The extracted spec SHALL store only color expressions in `semanticTokenColors`; the rust formatting layer (the bold, italic, and underline properties generated from the palette's rust section) SHALL be stripped before the spec is written, and the extraction rebuild self-check SHALL apply that layer so the input theme is reproduced byte-for-byte in canonical form. The canonical theme form SHALL be the build's own output shape: lowercase hex, `ff` alpha bytes dropped, `colors` keys sorted, canonical top-level key order (`name`, `$schema`, `type`, `colors`, `tokenColors`, `semanticTokenColors`, `semanticHighlighting`), no token-rule `name` fields, and no empty-settings token rules. Input themes in that canonical form SHALL be reproduced byte-for-byte unchanged; non-canonical input themes SHALL be reproduced byte-for-byte after the canonical normalization is applied to the input.

#### Scenario: Extraction reproduces its input
- **WHEN** the extractor runs on a current theme and rebuilds via the rule-applying build
- **THEN** it emits a palette and a spec, and building that palette and spec back reproduces the input theme byte-for-byte in canonical form
- **AND** the extracted spec's `semanticTokenColors` contain none of the rust formatting layer's properties (no generated bold, italic, or underline keys)

#### Scenario: Non-canonical input themes extract
- **WHEN** the extractor runs on a theme that is not in canonical form — `tokenColors` before `colors`, unsorted `colors` keys, uppercase hex, 8-digit hex with an `ff` alpha byte, token-rule `name` fields, and empty-settings token rules (for example `themes/solarized-dark-color-theme.json` and `themes/solarized-light-color-theme.json`)
- **THEN** extraction succeeds, the derived palette and spec are written, and rebuilding from them reproduces the input theme byte-for-byte in canonical form
- **AND** the extracted spec contains no token-rule `name` fields and no empty-settings token rules

#### Scenario: Extraction requires no palette input
- **WHEN** the extractor runs on a current theme without being given any palette file
- **THEN** the palette is derived from the theme and the extraction succeeds

#### Scenario: Independent theme mappings
- **WHEN** dark and light extraction assign the same theme key to different palette slots
- **THEN** each theme still builds byte-exact against its own committed file

#### Scenario: Committed spec recovery stays exact
- **WHEN** extraction runs against `themes/github-dark-rust.json` or `themes/github-light-rust.json`
- **THEN** the derived palette and color-only spec deep-equal the committed `palettes/github-{dark,light}.json` and `spec/github-{dark,light}.json`

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
The extract command SHALL accept a theme file as its input and SHALL write both the derived palette and the derived spec as output files. The command SHALL NOT require a palette argument. The derived palette's `rust` section SHALL always be filled from the semantic-color-suggestion provider for the Rust language, replacing the theme's own rust anchors. The derived base palette SHALL keep the theme's own colors unchanged. The derived spec SHALL express every `colors` and `tokenColors` color as a reference to a base slot (or a derived token of a base slot), never to a `rust.*` slot, so that replacing the palette's `rust` section changes only the theme's `semanticTokenColors`; the spec's `semanticTokenColors` SHALL keep the theme's own semantic anchors as `rust.*` references unchanged by the suggestion step.

#### Scenario: Theme in, palette and spec out
- **WHEN** the extract command runs with a single theme file argument
- **THEN** it writes one palette file and one spec file, and reports the written paths

#### Scenario: Output self-check
- **WHEN** the extract command has derived a palette and spec from a theme
- **THEN** it rebuilds the theme from them into a temporary file
- **AND** the rebuilt file matches the input theme byte-for-byte in canonical form

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

### Requirement: Missing-color fallback follows VS Code color defaults
When deriving a palette, a role-anchor color that is absent from the theme SHALL be resolved by following that color's VS Code registered default. A default SHALL be one of: a reference to another color key (optionally with an alpha or lightness transformation), a literal color per theme type, or a probe of the theme's own token color scopes. A referenced key SHALL itself be resolved theme-first, then by its own registered default. Every role anchor SHALL have a registered default, so a missing anchor key never aborts derivation. Derivation SHALL fail with a clear error and SHALL write no output files only when the theme's structure cannot be mapped to a valid palette (for example an invalid `type`, a theme that is not an object, or a malformed color).

#### Scenario: Borrowable default fills the slot
- **WHEN** a theme lacks `activityBar.inactiveForeground` but defines `activityBar.foreground`
- **THEN** the `fg-muted` slot is filled from `activityBar.foreground`'s RGB, and the alpha implied by VS Code's default (40%) does not change the recovered 6-digit hex

#### Scenario: Fallback respects the light variant
- **WHEN** a light theme lacks `breadcrumb.foreground` but defines the global `foreground`
- **THEN** the `fg-muted` slot is filled from `foreground`'s RGB per VS Code's 80% default, while the dark variant of the same slot keeps `activityBar.inactiveForeground` as its anchor

#### Scenario: Literal default fills the slot
- **WHEN** a theme lacks `editorBracketHighlight.foreground1`, whose VS Code default is the literal `#FFD700` (dark) / `#0431FA` (light)
- **THEN** the `blue` slot is filled from the type's registered literal and extraction succeeds

#### Scenario: Chain resolves through nested defaults
- **WHEN** a theme lacks both `button.secondaryBackground` and the `list.hoverBackground` that its default references
- **THEN** the `border-muted` slot is filled from `list.hoverBackground`'s own registered literal (`#2A2D2E` dark) rather than failing

#### Scenario: Semantic slots recover from the theme's token colors
- **WHEN** a theme has empty `semanticTokenColors` but its `tokenColors` define scopes VS Code maps to semantic token types (for example `string` → `#D8A657`, `comment` → `#928374`, `entity.name.function.preprocessor` → `#D3869B`)
- **THEN** the `rust.string`, `rust.docComment`, and `rust.macro` slots are filled from those token colors
- **AND** a slot whose probe scopes are all absent falls back to `editor.foreground`

#### Scenario: Comma-joined token scopes resolve
- **WHEN** a theme defines a token rule whose scope is a comma-joined list (for example `"storage, modifier, keyword.var, entity.name.tag"` with a foreground)
- **THEN** each listed scope is indexed individually and a lookup for `entity.name.tag` returns that foreground

#### Scenario: Omitted border resolves from the activity bar background
- **WHEN** a theme lacks `activityBar.border` but defines `activityBar.background` (for example `themes/solarized-dark-color-theme.json` with `#003847` and `themes/solarized-light-color-theme.json` with `#DDD6C1`)
- **THEN** the `border` slot is filled from `activityBar.background`'s color, mirroring VS Code painting no border at that edge, and extraction succeeds

#### Scenario: Border fallback chain terminates in the registered literal
- **WHEN** a theme lacks both `activityBar.border` and `activityBar.background`
- **THEN** the `border` slot is filled from `activityBar.background`'s registered literal (`#333333` dark / `#2C2C2C` light) rather than failing

#### Scenario: Missing keys never abort derivation
- **WHEN** a theme defines none of the role-anchor keys
- **THEN** every slot resolves through its registered default and derivation succeeds
- **AND** only structural problems (for example an invalid `type` or a malformed color) fail with a clear error and write no output files

#### Scenario: Only null-default anchors fail
- **WHEN** a role anchor whose registered default is null or unregistered is missing from the theme
- **THEN** derivation fails with a clear error naming the slot and writes no output files
- **AND** in the current anchor set every anchor has a registered default (including `activityBar.border`), so no missing key can trigger this path

#### Scenario: Fallback extraction remains byte-exact
- **WHEN** a theme resolves one or more slots through fallback and extraction succeeds (including `themes/correia-gruvbox.json` end-to-end)
- **THEN** the derived spec encodes only color keys present in the input theme
- **AND** rebuilding the theme from the derived palette and spec reproduces the input theme byte-for-byte

### Requirement: Chromatic base slots named by closest color
When deriving a palette from a theme, the 8 color-named base slots (`blue`, `green`, `red`, `orange`, `yellow`, `purple`, `pink`, `cyan`) SHALL be reassigned among the 8 derived chromatic colors so that each chromatic color lands on the slot whose fixed canonical reference color is closest in OKLab space, with the assignment minimizing total distance across the 8 slots. The 8 neutral base slots (`bg`, `bg-soft`, `bg-muted`, `fg`, `fg-muted`, `fg-subtle`, `border`, `border-muted`) SHALL keep the colors assigned by their role anchors. Assignment SHALL be deterministic. A palette derived this way, together with the spec extracted from it, SHALL rebuild the input theme byte-for-byte.

#### Scenario: Misnamed chromatic color lands on its true slot
- **WHEN** extraction derives `themes/correia-gruvbox.json`, whose role anchors produce `blue #ffd700` (gold), `purple #179fff` (blue), `green #e78a4e` (orange), and `orange #da70d6` (orchid)
- **THEN** the derived palette assigns `#179fff` to `blue`, `#ffd700` to a slot whose reference is closest to gold, `#e78a4e` to the slot closest to orange, and `#da70d6` to the slot closest to orchid
- **AND** the assignment is a one-to-one matching in which no two chromatic slots share a color and no chromatic color is dropped

#### Scenario: Already-correct palettes recover unchanged
- **WHEN** extraction derives `themes/github-dark-rust.json` or `themes/github-light-rust.json`, whose chromatic colors already match their slot names
- **THEN** the chromatic reassignment is the identity
- **AND** the derived palette and spec deep-equal the committed `palettes/github-{dark,light}.json` and `spec/github-{dark,light}.json`

#### Scenario: Neutral slots are not reassigned
- **WHEN** extraction derives a palette whose role anchors resolve the neutral slots (for example `github-dark`'s `bg #24292e`, `border #1b1f23`, `fg-muted #6a737d`, `fg-subtle #959da5`)
- **THEN** each neutral slot keeps its role-anchored color regardless of distance to any reference
- **AND** the derived palette and spec still deep-equal the committed fixtures for `github-dark` and `github-light`

#### Scenario: Duplicate colors assign deterministically
- **WHEN** extraction derives a theme whose role anchors resolve the same hex to multiple slots (for example `correia-gruvbox`'s `#1d2021` for `bg`, `bg-soft`, and `bg-muted`, and `#ebdbb2` for `fg`, `fg-muted`, `fg-subtle`)
- **THEN** the assignment resolves to a deterministic slot order for the identical colors
- **AND** running extraction twice on the same theme yields byte-identical palette and spec outputs

#### Scenario: Reassigned extraction stays byte-exact
- **WHEN** a theme's chromatic slots are reassigned and `extractSpec` regenerates the spec against the reassigned palette
- **THEN** rebuilding the theme from the derived palette and spec reproduces the input theme byte-for-byte (the `verifyRebuild` self-check still passes, including for `themes/correia-gruvbox.json`)

### Requirement: Spec expression grammar
A spec SHALL express each color as one of: a palette reference; a palette reference with a derived OKLab delta and an optional alpha byte; a literal hex fallback; or a pass-through non-color value (bold, italic, underline).

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

### Requirement: Rust-rules exclusion flag
The build CLI SHALL accept a flag that excludes the rust formatting layer. When the flag is set, the emitted theme SHALL be exactly what the palette and spec alone define, with none of the layer's formatting entries, so that a theme can be reconstructed exactly from an extracted palette and spec when testing how well palette and spec extraction worked.

#### Scenario: Flag disables the layer
- **WHEN** the build runs with the exclusion flag on a rust palette and a spec with a `semanticTokenColors` section
- **THEN** the emitted `semanticTokenColors` contain only the spec's color entries and none of the layer's formatting entries

#### Scenario: Flag output isolates the extraction artifact
- **WHEN** extraction runs on a committed rust theme and the build runs on the extracted palette and spec with the exclusion flag
- **THEN** every emitted color matches the corresponding color of the input theme
- **AND** the emitted `semanticTokenColors` contain none of the rust formatting layer's properties

### Requirement: Separate Rust semantic color set
The palette SHALL define the Rust semantic colors in a section separate from the 16 base colors. The build's rust semantic layer SHALL apply regardless of the palette: the formatting properties (bold, italic, underline) SHALL be merged into `semanticTokenColors` on every build, whether or not the spec has a `semanticTokenColors` section and whether or not the palette has a `rust` section. The standard rust semantic colors SHALL be seeded from the palette's rust slots only when the palette has a non-empty `rust` section, for tokens the spec does not color; colors the spec defines SHALL take precedence over the seed.

#### Scenario: Rust set isolated from base set
- **WHEN** a palette is loaded
- **THEN** the Rust semantic set is enumerated separately from the 16 base colors and the build resolves semantic-token colors against it

#### Scenario: Rust palette seeds the standard rust colors
- **WHEN** a palette has a non-empty `rust` section and the spec leaves a standard rust token colorless
- **THEN** the build seeds that token's color from the palette's rust slot and merges the rust formatting layer into the emitted `semanticTokenColors`

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

### Requirement: Generator config structure
`generator.json` SHALL be a single object with a `themes` key and a `formatting` key. The `themes` key SHALL hold the array of theme registrations, each containing `name`, `spec`, and `palette`. The `formatting` key SHALL hold a `rust` subkey whose value is the map from semantic token selector to the formatting properties (bold, italic, underline) the rust semantic formatting layer applies to that selector on every build.

#### Scenario: Theme registrations read from the themes key
- **WHEN** the build loads `generator.json`
- **THEN** it reads the theme registrations from the `themes` key

#### Scenario: Formatting styles read from the formatting.rust key
- **WHEN** the build loads `generator.json`
- **THEN** the rust semantic formatting layer's styles are the `formatting.rust` map
