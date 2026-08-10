## Purpose

Defines how the test suites obtain their theme, spec, palette, and generator-config input data so that test outcomes are independent of the repo root's live `themes/`, `spec/`, `palettes/`, and `generator.json` files.

## ADDED Requirements

### Requirement: Tests read input data only from fixture copies
The test suites SHALL read theme, spec, palette, and generator-config input only from fixture files under `test/fixtures/`. No test SHALL read the repo root's `themes/`, `spec/`, `palettes/`, or `generator.json` files. Any data file a test needs SHALL exist as a fixture copy under `test/fixtures/`, mirroring its source location and content.

#### Scenario: Fixture directory covers every source file a test reads
- **WHEN** the test suite runs with the repo root's `themes/`, `spec/`, `palettes/`, and `generator.json` removed
- **THEN** every test that does not need live data passes against the `test/fixtures/` copies

#### Scenario: No test resolves input from the repo root
- **WHEN** the test sources are inspected for references to `themes/`, `spec/`, `palettes/`, and `generator.json`
- **THEN** every such reference resolves under `test/fixtures/` and none point at the repo root files

### Requirement: Fixture content is frozen and updated deliberately
Test expectations SHALL bind to the fixture copies, so changing a committed theme, spec, palette, or `generator.json` SHALL NOT silently change test results. When a source file changes and its fixture is updated to match, the update SHALL be a deliberate, reviewed edit that keeps test expectations in sync with the new source content.

#### Scenario: Editing source data does not move test expectations
- **WHEN** a committed palette or spec is changed without touching its fixture copy
- **THEN** tests that assert against fixture content still assert the old, frozen values

#### Scenario: Updating a fixture updates the expectation
- **WHEN** a fixture copy is updated to match its changed source file
- **THEN** tests that assert against that fixture content now assert the new values
