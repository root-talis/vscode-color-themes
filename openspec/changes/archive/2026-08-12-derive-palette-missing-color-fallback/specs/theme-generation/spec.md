## ADDED Requirements

### Requirement: Missing-color fallback follows VS Code color defaults
When deriving a palette, a role-anchor color that is absent from the theme SHALL be resolved by following that color's VS Code registered default. A default SHALL be one of: a reference to another color key (optionally with an alpha or lightness transformation), a literal color per theme type, or a probe of the theme's own token color scopes. A referenced key SHALL itself be resolved theme-first, then by its own registered default. Derivation SHALL fail with a clear error and SHALL write no output files only when an anchor has no registered default.

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

#### Scenario: Only null-default anchors fail
- **WHEN** a theme lacks `activityBar.border`, the only role anchor with no VS Code registered default
- **THEN** derivation fails with a clear error naming the slot and writes no output files

#### Scenario: Fallback extraction remains byte-exact
- **WHEN** a theme resolves one or more slots through fallback and extraction succeeds (including `themes/correia-gruvbox.json` end-to-end)
- **THEN** the derived spec encodes only color keys present in the input theme
- **AND** rebuilding the theme from the derived palette and spec reproduces the input theme byte-for-byte
