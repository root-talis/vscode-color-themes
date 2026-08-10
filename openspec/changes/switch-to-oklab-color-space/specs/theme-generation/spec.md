## RENAMED Requirements

- FROM: `### Requirement: LAB vector-offset derivation`
- TO: `### Requirement: OKLab vector-offset derivation`

## MODIFIED Requirements

### Requirement: OKLab vector-offset derivation
Non-palette colors SHALL be derived as `oklab2rgb(rgb2oklab(base) + delta)` using absolute OKLab vector offsets. Editing a palette color SHALL shift every derived color that references that base by the same absolute OKLab vector, and SHALL leave colors referencing other bases unchanged. The color math SHALL round-trip `rgb → oklab → rgb` exactly for every color in the palettes and committed themes.

#### Scenario: Base color change propagates
- **WHEN** a base color is changed and the theme is rebuilt
- **THEN** only colors whose derivation references that base change, each shifting by its stored OKLab offset
- **AND** colors referencing other bases are byte-identical to the previous build

#### Scenario: Round-trip exactness
- **WHEN** every color in the palettes and committed themes is converted `rgb → oklab → rgb`
- **THEN** each round-trip returns the original color exactly

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
