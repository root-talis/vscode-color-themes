## Context

See proposal.md - Why. The test suites `test/extract.test.js` and `test/snapshot.test.js` currently resolve themes, specs, palettes, and `generator.json` from the repo root (`ROOT` = `path.join(__dirname, '..')`). Two library modules also bind to the root config: `lib/build-themes.js` `loadThemes()` reads `path.join(ROOT, 'generator.json')` and joins registrations with `ROOT`, and `lib/rust-rules.js` loads `require('../generator.json').formatting.rust` at module load. The requirements are defined in `specs/test-fixtures/spec.md`.

## Goals / Non-Goals

**Goals:**
- Every input file a test reads resolves under `test/fixtures/`, never the repo root's `themes/`, `spec/`, `palettes/`, or `generator.json`.
- Changing root data cannot change test results; fixtures move only by deliberate, reviewed edits.
- Keep production behavior byte-identical: `npm run build` and the CLI keep producing the same themes from the same default config.

**Non-Goals:**
- Not a data-format change: fixture files keep the exact schema and relative path names of their sources.
- No change to committed `themes/`, `spec/`, `palettes/`, or root `generator.json` content.

## Decisions

### D1: Fixture layout mirrors the source structure
Fixtures live at `test/fixtures/` and mirror the repo layout:
- `test/fixtures/generator.json` - full copy of root `generator.json`
- `test/fixtures/spec/{github-dark,github-light,correia-gruvbox}.json`
- `test/fixtures/palettes/{github-dark,github-light,correia-gruvbox}.json`
- `test/fixtures/themes/{github-dark-rust,github-light-rust,correia-gruvbox,correia-gruvbox-dark-rust}.json`

This is the exact set of data files the two test suites read. Mirroring the layout keeps the fixture `generator.json`'s relative `spec/...`/`palettes/...` paths valid against the fixture directory itself, so the same config file structure works at both roots.

### D2: Tests resolve all input data through a `FIXTURES` root
Each test file defines `const FIXTURES = path.join(__dirname, 'fixtures')` and every `ROOT`-joined theme/spec/palette/config reference is rewritten to a `FIXTURES`-joined path. `color.test.js` reads no files and is untouched. Alternatives considered: copying input files per-test into tmp dirs was rejected as noise; keeping `ROOT` paths but symlinking was rejected because it still resolves the live files.

### D3: `generator.json` access becomes injectable, default unchanged
Production behavior is preserved (same default root config), tests inject the fixture:
- `lib/build-themes.js`: `loadThemes(configFile = path.join(ROOT, 'generator.json'))`; registrations join against `path.dirname(configFile)` instead of `ROOT`. For the root config this resolves identically to today; for the fixture it resolves under `test/fixtures/`. The CLI gains a `--config <path>` flag that `main()` passes through.
- `lib/rust-rules.js`: the loader is extracted as `loadFormattingRules(configFile = path.join(ROOT, 'generator.json'))` and exported. The default table is computed lazily and memoized (`getDefaultFormattingRules()`), and `RUST_FORMATTING_RULES` is exported as a getter for backward compatibility, so requiring the module never reads the root config. `applyRustRules(theme, palette, formattingRules = getDefaultFormattingRules())` and `stripRustFormatting(stc, formattingRules = getDefaultFormattingRules())` take the table as an optional argument; `mergeEntry` receives it as a parameter.
- `lib/extract-spec.js`: the optional table is threaded through `extractSpec`, `extractTheme`, `verifyRebuild`, and `runExtract`, and the CLI gains a `--config <path>` flag. Omitted, it falls through to the same lazy root default as before.
- Tests load the rules once from the fixture and pass them at every call site, so results depend on the fixture config, never the root one.

The lazy default exists so `npm test` can run with the root `generator.json` unavailable: no test imports or reads the root config, and the formatting table is always supplied from the fixture.

### D4: Fixture config is the single source of truth for the tested rules
The guard test `fixture generator.json is the single source of truth for the tested formatting rules` asserts that the fixture-loaded `formattingRules` table used by every test matches the fixture `generator.json`'s `formatting.rust`. The code's default (root-derived) table is production data and is deliberately never exercised by tests, so root edits cannot move test expectations. The `loadThemes` and CLI-build tests use the fixture config via `loadThemes(fixturePath)` / `--config`.

### D5: Fixture updates are manual and deliberate
When a root data file changes, its fixture copy is updated in the same change and kept byte-identical in content (only the path it sits at differs). No test copies root files at runtime, so a root edit alone leaves expectations frozen (see spec scenario "Editing source data does not move test expectations").

## Risks / Trade-offs

- **Fixture drift** - if a fixture is not updated alongside its source, tests validate stale data. Mitigation: the mirror layout and verbatim-copy convention make drift visible in review; the "single source of truth" guard compares the code default to the fixture, so the fixture is always the tested contract.
- **Optional-argument API surface** - adding optional params to `loadThemes`, `applyRustRules`, `stripRustFormatting` risks misuse. Mitigation: defaults preserve the current production call sites exactly; no existing call is changed.
- **CLI `--config` flag** - a new flag on `lib/build-themes.js` is user-visible. Mitigation: it is additive and documented in README; the default invocation is unchanged.
