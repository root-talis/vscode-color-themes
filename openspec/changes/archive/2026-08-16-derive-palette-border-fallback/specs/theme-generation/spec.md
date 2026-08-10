## MODIFIED Requirements

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
