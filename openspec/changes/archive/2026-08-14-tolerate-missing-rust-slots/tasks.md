## 1. Missing-slot error type

- [x] 1.1 TDD: add a `MissingSlotError` class (subclass of `Error`) in `lib/resolve.js` and throw it from both missing-slot branches — `derived token ${token} references unknown slot ${ref}` and `unknown color expression ${expression}` — with a failing test first asserting the error class and that the message text is unchanged
- [x] 1.2 Confirm malformed expressions still throw the existing errors (invalid alpha byte, non-string expression) with a regression test
- [x] 1.3 Run the existing `npm test` suite and confirm no behavior change for complete palettes

## 2. Lenient semanticTokenColors resolution

- [x] 2.1 TDD: in `lib/theme.js` `buildTheme`, a plain-string `semanticTokenColors` entry whose color references a missing rust slot (for example `string: "rust.string"` with `palette.rust.string` deleted) is dropped instead of failing the build, with a failing test first
- [x] 2.2 TDD: an object `semanticTokenColors` entry whose `foreground` references a missing rust slot loses that property while keeping resolvable properties (for example a `background`), and an entry left with no properties is dropped, with a failing test first
- [x] 2.3 TDD: `colors` and `tokenColors` sections drop the unresolvable reference instead of failing — a `colors` key referencing a missing rust slot (for example `editor.findMatchBackground: "rust.string.d0@44"`) is omitted while other keys resolve, and a `tokenColors` entry loses the unresolvable property (or is omitted when left empty), with a failing test first

## 3. Formatting-layer behavior

- [x] 3.1 TDD: end-to-end build (`buildTheme` + `applyRustRules`) with `palette.rust.macro` removed yields `macro: { underline: true }` (formatting only, no color), with a failing test first
- [x] 3.2 TDD: end-to-end build with `palette.rust.string` removed omits the `string` entry entirely while formatting-only tokens (for example `struct: { bold: true }`) are still added, with a failing test first
- [x] 3.3 TDD: when only one rust slot is missing, every other `semanticTokenColors` entry keeps its resolved color and formatting (for example `derive` keeps `{ foreground, italic: true }`), with a failing test first
- [x] 3.4 TDD: end-to-end build using the real `palettes/github-dark.json` with `rust.string` removed succeeds, omits the four `editor.findMatch*`/`peekView*` `colors` keys, and keeps every other key and the `semanticTokenColors` formatting, with a failing test first

## 4. Verification

- [x] 4.1 Run the full `npm test` suite; all tests pass including the existing snapshot tests
- [x] 4.2 Run `npm run build` and confirm every emitted `themes/*.json` is byte-identical to the committed file
