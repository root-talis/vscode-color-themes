## Why

The test suites (`test/extract.test.js`, `test/snapshot.test.js`) read the repo's live data files directly — `themes/*.json`, `spec/*.json`, `palettes/*.json`, and `generator.json`. That couples test outcomes to committed production data, so editing any palette, spec, theme, or the generator config can silently change test expectations, and tests can pass or fail for reasons unrelated to the library code under test. Tests should be self-contained and verify against frozen fixture copies instead.

## What Changes

- Introduce a fixtures directory under `test/` (e.g. `test/fixtures/`) holding frozen copies of every data file the tests read: the theme files, specs, palettes, and `generator.json`.
- Update `test/extract.test.js` and `test/snapshot.test.js` to resolve themes, specs, palettes, and the generator config from `test/fixtures/` instead of the repo root (`themes/`, `spec/`, `palettes/`, `generator.json`).
- Any test that needs a real data file must reference its fixture copy; no test may read from the repo root's `themes/`, `spec/`, `palettes/`, or `generator.json`.
- If a committed data file is later changed, its fixture copy is updated deliberately, not silently, so test expectations only move when intended.
- No library behavior changes.

## Capabilities

### New Capabilities
- `test-fixtures`: The test suites shall read theme, spec, palette, and generator-config input only from fixture copies under `test/fixtures/`, never from the repo root's live `themes/`, `spec/`, `palettes/`, or `generator.json`.

### Modified Capabilities
- None.

## Impact

- **Added**: `test/fixtures/` with copies of the three committed specs, six palettes, the themes the tests read (`github-dark-rust`, `github-light-rust`, `correia-gruvbox`), and `generator.json`.
- **Modified**: `test/extract.test.js`, `test/snapshot.test.js` (path resolution for input data).
- **Modified**: `lib/build-themes.js`, `lib/rust-rules.js`, `lib/extract-spec.js` (config access injectable; defaults unchanged, production output byte-identical).
- **Untouched**: committed `themes/`, `spec/`, `palettes/`, `generator.json`, and the built `.vsix` outputs.
