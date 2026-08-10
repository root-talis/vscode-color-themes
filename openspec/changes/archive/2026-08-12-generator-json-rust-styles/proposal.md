## Why

The theme-independent rust semantic formatting layer styles (the bold/italic/underline table applied to every build) are hardcoded inside `lib/rust-rules.js`, while `generator.json` already holds the rest of the generator's configuration. Sourcing those styles from a key in `generator.json` makes the generator's configuration reviewable and editable as data instead of code, and keeps `generator.json` the single entry point for configuring the build.

## What Changes

- **BREAKING (config format)** `generator.json` becomes an object with two keys:
  - `themes`: the current contents of `generator.json` — the array of `{name, spec, palette}` theme registrations — unchanged.
  - `formatting.rust`: the theme-independent rust semantic formatting layer styles (the semantic token selector → bold/italic/underline table currently hardcoded as `RUST_FORMATTING_RULES` in `lib/rust-rules.js`).
- `lib/rust-rules.js` imports the formatting rules from `generator.json`'s `formatting.rust` key instead of hardcoding the table. The module's mechanics (`RUST_SEMANTIC_ORDER`, `RUST_SEMANTIC_SLOTS`, `FORMATTING_BEFORE_FOREGROUND`, `applyRustRules`, `stripRustFormatting`) stay in the module.
- `lib/build-themes.js` reads the theme registrations from the `themes` key.
- Behavior preserved: committed `themes/*.json` build byte-identically and all tests pass.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `theme-generation`: The generator config gains a defined structure (`themes` + `formatting.rust`), and the rust formatting layer's styles are sourced from `generator.json`'s `formatting.rust` key rather than from code.

## Impact

- **Modified**: `generator.json` (array → object with `themes` + `formatting.rust`), `lib/rust-rules.js` (loads the styles from config), `lib/build-themes.js` (reads `themes`), `README.md` (generator config docs), `test/snapshot.test.js` and `test/extract.test.js` if they construct or assert the config shape.
- **Behavior preserved**: committed `themes/*.json` are reproduced byte-for-byte; `npm run build` and `npm test` keep passing.
