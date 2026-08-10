## 1. Config restructure

- [x] 1.1 Rewrite `generator.json` as a single object: move the current theme array verbatim under a `themes` key, and add a `formatting` object whose `rust` key holds the current `RUST_FORMATTING_RULES` table (from `lib/rust-rules.js`) verbatim, preserving each entry's property order (for example `enum` as `{bold, italic}` and `macro` as `{underline}`).
- [x] 1.2 Confirm every registration in the `themes` key is unchanged (`name`, `spec`, and `palette` values identical to the pre-change array).

## 2. Code changes

- [x] 2.1 In `lib/rust-rules.js`, derive `RUST_FORMATTING_RULES` from `generator.json`'s `formatting.rust` at module load (via `require('../generator.json')`) instead of the hardcoded literal; keep the same export name so `applyRustRules`, `stripRustFormatting`, and the test imports work unchanged.
- [x] 2.2 In `lib/build-themes.js` `loadThemes`, read the registrations from the `themes` key of `generator.json` instead of treating the file as the array.

## 3. Verification

- [x] 3.1 Run `npm run build` and confirm every committed `themes/*.json` is reproduced byte-for-byte (no `themes/` diff).
- [x] 3.2 Run `npm test` — all snapshot and extract tests pass (they import `RUST_FORMATTING_RULES`, which now comes from config).
- [x] 3.3 Add or extend a test asserting `RUST_FORMATTING_RULES` equals `generator.json`'s `formatting.rust` (so the config is the single source of truth), and that `loadThemes` reads the `themes` key.

## 4. Docs

- [x] 4.1 Update `README.md`: document `generator.json`'s new shape (`themes` + `formatting.rust`) and that the rust formatting layer styles are defined in config, not code.

## 5. Validation

- [x] 5.1 Run `openspec validate` and confirm the change validates.
