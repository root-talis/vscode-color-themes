## 1. Palette derivation fallback

- [x] 1.1 Add an `activityBar.background` literal default to `DEFAULTS` in `lib/derive-palette.js`: `{ kind: 'literal', dark: '#333333', light: '#2C2C2C' }` (VS Code's registered `ACTIVITY_BAR_BACKGROUND` defaults)
- [x] 1.2 Change the `activityBar.border` entry in `DEFAULTS` from `null` to `{ kind: 'chain', op: 'ref', ref: 'activityBar.background' }`, and update the `DEFAULTS` block comment that names `activityBar.border` as the only null default so it no longer claims that

## 2. Canonical theme form

- [x] 2.1 Add and export `canonicalTheme(theme)` in `lib/theme.js`, importing `normalizeHex` / `normalizeHexInObject` from `lib/color.js`
- [x] 2.2 In `canonicalTheme`: reorder top-level keys to `name`, `$schema`, `type`, `colors`, `tokenColors`, `semanticTokenColors`, `semanticHighlighting`; sort `colors` keys; normalize each `colors` value with `normalizeHex` (lowercase, drop `ff` alpha)
- [x] 2.3 In `canonicalTheme`: for each `tokenColors` entry drop the `name` field and drop entries whose `settings` is an empty object; normalize hex settings values, pass non-hex settings (e.g. `fontStyle`) through unchanged
- [x] 2.4 In `canonicalTheme`: normalize `semanticTokenColors` via `normalizeHexInObject`

## 3. Extraction self-check and spec output

- [x] 3.1 In `lib/extract-spec.js`, change `verifyRebuild` so the expected value is `JSON.stringify(canonicalTheme(parseJsonc(themeText)), null, '\t') + '\n'` instead of `stripComments(themeText)` (the rebuilt output is already canonical, so the comparison is exact for any input)
- [x] 3.2 In `extractSpec`'s `tokenColorOut`, skip input token rules with an empty `settings` object so the spec stops encoding entries the build already drops (matches `buildTheme`'s `flatMap` behavior and the canonical input form)

## 4. Fixtures and tests

- [x] 4.1 Copy `themes/solarized-dark-color-theme.json` and `themes/solarized-light-color-theme.json` into `test/fixtures/themes/`
- [x] 4.2 In `test/extract.test.js`, replace the two stub-theme assertions that expect a missing-`activityBar.border` error with a structural-failure test (e.g. `"type": "gray"`) asserting the clear error message and that no output files are written
- [x] 4.3 Add an end-to-end solarized test (mirroring the correia-gruvbox one) for each theme: derive and assert key palette slots (`border` `#003847` dark / `#DDD6C1` light, `bg`, `fg`), run `runExtract`, assert palette + spec artifacts exist, rebuild into a temp file, and assert it equals the canonical form of the fixture
- [x] 4.4 Keep the committed-fixture assertions in `test/extract.test.js` 2.6 unchanged (they must still pass byte-for-byte)

## 5. Verification

- [x] 5.1 Run the full `npm test` suite — all suites green (the two replaced stub tests gone, all fixture tests passing)
- [x] 5.2 Run `node lib/extract-spec.js --out-dir <tmp>` on both solarized themes from the repo root and confirm end-to-end extraction writes palette + spec and the self-check passes
- [x] 5.3 Re-verify committed `github-*` / `correia-gruvbox` extraction is byte-for-byte unchanged from before the change
