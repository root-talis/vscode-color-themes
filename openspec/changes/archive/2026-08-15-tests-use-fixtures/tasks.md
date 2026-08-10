## 1. Create fixtures

- [x] 1.1 Create `test/fixtures/` with subdirs `themes/`, `spec/`, `palettes/`
- [x] 1.2 Copy `themes/github-dark-rust.json`, `themes/github-light-rust.json`, `themes/correia-gruvbox.json`, `themes/correia-gruvbox-dark-rust.json` into `test/fixtures/themes/` (verbatim)
- [x] 1.3 Copy `spec/github-dark.json`, `spec/github-light.json`, `spec/correia-gruvbox.json` into `test/fixtures/spec/` (verbatim)
- [x] 1.4 Copy `palettes/github-dark.json`, `palettes/github-light.json`, `palettes/correia-gruvbox.json` into `test/fixtures/palettes/` (verbatim)
- [x] 1.5 Copy `generator.json` into `test/fixtures/generator.json` (verbatim)

## 2. Make config access injectable

- [x] 2.1 TDD: add `loadThemes(configFile = path.join(ROOT, 'generator.json'))` to `lib/build-themes.js`, resolving spec/palette entries against `path.dirname(configFile)`, with a failing test first asserting fixture-config registrations resolve under `test/fixtures/`
- [x] 2.2 TDD: add `--config <path>` flag to the `lib/build-themes.js` CLI parsed by `main()` and threaded into `loadThemes`, with a failing test first
- [x] 2.3 TDD: extract `loadFormattingRules(configFile = path.join(ROOT, 'generator.json'))` in `lib/rust-rules.js`, keep `RUST_FORMATTING_RULES = loadFormattingRules()`, and make `applyRustRules(theme, palette, formattingRules = RUST_FORMATTING_RULES)` and `stripRustFormatting(stc, formattingRules = RUST_FORMATTING_RULES)` take the table as an optional parameter, with a failing test first asserting a fixture-provided table drives output
- [x] 2.4 Confirm production behavior is byte-identical: `npm run build` output unchanged and CLI without `--config` still reads root `generator.json`

## 3. Point tests at fixtures

- [x] 3.1 In `test/extract.test.js`, replace `ROOT`-joined theme/spec/palette references with `FIXTURES = path.join(__dirname, 'fixtures')`-joined paths (including the `THEMES` table, `correia-gruvbox` files, and the CLI `themeFile` argument)
- [x] 3.2 In `test/extract.test.js`, load formatting rules from `test/fixtures/generator.json` via `loadFormattingRules` and pass them to every `applyRustRules`/`stripRustFormatting` call; replace the `RUST_FORMATTING_RULES` import used for the layer-prop check
- [x] 3.3 In `test/snapshot.test.js`, replace `ROOT`-joined theme/spec/palette references with `FIXTURES`-joined paths (including `THEMES`, `buildFor`, and `committedTheme`)
- [x] 3.4 In `test/snapshot.test.js`, load formatting rules from the fixture and pass them to every `applyRustRules` call
- [x] 3.5 Update the "config is the single source of truth" test to compare `RUST_FORMATTING_RULES` against the fixture `generator.json`'s `formatting.rust`
- [x] 3.6 Update the `loadThemes` and `--no-rust-rules` CLI tests to use the fixture config (`loadThemes(fixture)` and `--config <fixture>`), asserting resolved spec/palette paths land under `test/fixtures/`

## 4. Verify independence

- [x] 4.1 Run `npm test` with repo root `themes/`, `spec/`, `palettes/`, and `generator.json` temporarily unavailable and confirm all tests pass against fixtures only (all four removed; 55/55 pass). Requires the lazy default table in `lib/rust-rules.js`, fixture threading through `lib/extract-spec.js`, and `--config` on both CLIs.
- [x] 4.2 Grep `test/` and assert no reference resolves root `themes/`, `spec/`, `palettes/`, or `generator.json` outside `test/fixtures/`
- [x] 4.3 Run the full `npm test` and `npm run build` suite on the final state
