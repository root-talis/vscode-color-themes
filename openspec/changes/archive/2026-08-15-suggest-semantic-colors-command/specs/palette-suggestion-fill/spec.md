## Purpose

Fills a palette file's per-language semantic color sections from the language suggestion provider, resolving conflicts interactively or by flag when a language already has colors.

## ADDED Requirements

### Requirement: Command input and output contract
The palette suggestion-fill command SHALL accept a palette file path as its positional argument, validate the palette, fill the targeted languages' semantic color sections from the suggestion provider, and write the updated palette back to the input file. An invalid palette SHALL fail with a clear error and SHALL NOT modify the file.

#### Scenario: Valid palette is filled in place
- **WHEN** the command runs on a valid palette file
- **THEN** the file is updated in place with the suggested colors

#### Scenario: Invalid palette is rejected without writing
- **WHEN** the palette is missing a base slot or contains a color that is not valid 6-digit hex
- **THEN** the command fails with a clear error
- **AND** the palette file is left unchanged

### Requirement: Language targeting
By default the command SHALL target every language registered in the suggestion registry. A `--language <name>` flag SHALL restrict the run to that single language. Requesting a language that is not registered SHALL fail with a clear error naming the language and the registered languages. A palette section for a language with no registered suggestion module SHALL be left unchanged and SHALL NOT cause an error.

#### Scenario: Default targets every registered language
- **WHEN** the command runs without a `--language` flag and `rust` is registered
- **THEN** the `rust` section is a fill target

#### Scenario: A single language is targeted
- **WHEN** the command runs with `--language rust`
- **THEN** only the `rust` section is a fill target

#### Scenario: Unregistered language is rejected
- **WHEN** the command runs with `--language python` and `python` is not registered
- **THEN** the command fails with a clear error naming `python` and the registered languages

#### Scenario: Unregistered palette section is untouched
- **WHEN** the palette contains a section with no registered suggestion module
- **THEN** that section remains byte-for-byte unchanged

### Requirement: Filling missing semantic colors
For a targeted language, the command SHALL compute the suggested color set from the suggestion provider and add every suggested slot that the palette's section for that language lacks. When a targeted language's section is absent, the command SHALL create it with the full suggested set. A language section that already holds every suggested slot is still subject to conflict resolution.

#### Scenario: Missing slots are inserted
- **WHEN** a palette's `rust` section lacks `docComment`
- **THEN** `docComment` is added with its suggested color and the existing slots keep their colors

#### Scenario: Absent section is created
- **WHEN** a targeted language's section is absent from the palette
- **THEN** the command adds that section holding the full suggested color set

### Requirement: Conflict resolution
When a targeted language's section already contains at least one color, the command SHALL treat it as a conflict and resolve it as skip, overwrite, or merge. Skip SHALL leave the section's colors unchanged. Overwrite SHALL replace the section's colors with the full suggested set. Merge SHALL add only the suggested slots missing from the section and SHALL keep the section's existing colors.

#### Scenario: Skip leaves the section unchanged
- **WHEN** the conflict resolves as skip
- **THEN** the language's section keeps every existing color and gains none of the suggestions

#### Scenario: Overwrite replaces the section
- **WHEN** the conflict resolves as overwrite
- **THEN** the language's section holds exactly the full suggested color set, replacing prior values

#### Scenario: Merge inserts only missing colors
- **WHEN** the conflict resolves as merge and the section has some but not all suggested slots
- **THEN** the missing slots are added with their suggested colors
- **AND** every slot the section already defined keeps its existing color

### Requirement: Interactive and flag-driven conflict handling
When stdin is a terminal and no conflict flag is given, the command SHALL prompt the user to choose skip, overwrite, or merge for each conflicting language and SHALL apply the chosen action. When stdin is not a terminal and no conflict flag is given, a conflict SHALL resolve as merge. The `--conflict-skip` and `--conflict-overwrite` flags SHALL force skip and overwrite respectively, SHALL suppress the interactive prompt, and SHALL take effect on both terminals and non-terminals.

#### Scenario: Interactive prompt applies the chosen action
- **WHEN** stdin is a terminal, no conflict flag is given, and a conflicting language exists
- **THEN** the command asks the user to choose skip, overwrite, or merge for that language
- **AND** the language's section reflects the chosen action

#### Scenario: Non-interactive stdin merges by default
- **WHEN** stdin is not a terminal and no conflict flag is given
- **THEN** a conflicting language's section is merged (missing slots added, existing colors kept)

#### Scenario: --conflict-skip forces skip
- **WHEN** the `--conflict-skip` flag is given
- **THEN** every conflicting language's section is left unchanged and no prompt appears

#### Scenario: --conflict-overwrite forces overwrite
- **WHEN** the `--conflict-overwrite` flag is given
- **THEN** every conflicting language's section is replaced with the full suggested set and no prompt appears

### Requirement: Deterministic in-place output
The command SHALL write the updated palette to the input path as JSON with 2-space indentation and a trailing newline, matching the committed palettes' formatting. Running the command again with the same palette and the same resolution choices SHALL produce byte-identical output. The command SHALL report which language sections it filled and which it skipped.

#### Scenario: Output formatting matches committed palettes
- **WHEN** the command writes a palette file
- **THEN** the file uses 2-space JSON indentation and ends with a trailing newline

#### Scenario: Repeat run is stable
- **WHEN** the command runs twice on the same palette with the same resolution choices
- **THEN** both runs write byte-identical palette files

#### Scenario: Fill report names the languages
- **WHEN** the command completes
- **THEN** it reports each language section it filled and each it skipped
