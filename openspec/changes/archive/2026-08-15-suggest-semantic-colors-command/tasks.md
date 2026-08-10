## 1. CLI scaffolding

- [x] 1.1 Create `lib/suggest-palette.js` exporting `parseArgs`, `fillPalette`, `runPaletteSuggestions`, and a `main()` guarded by `require.main === module`, following the `lib/extract-spec.js` module/CLI pattern
- [x] 1.2 Add a `suggest` script to `package.json` scripts: `"suggest": "node lib/suggest-palette.js"`

## 2. Argument parsing

- [x] 2.1 Implement `parseArgs(argv)` returning `{ paletteFile, language, conflict, error }`: the first non-flag argument is the palette file (required); `--language <name>` takes a value; `--conflict-skip` and `--conflict-overwrite` set `conflict` to `'skip'` and `'overwrite'` respectively; an unknown flag, a missing palette file, a flag missing its value, or both conflict flags together produces `{ error }`
- [x] 2.2 Show a usage line on error in `main()` (mirroring the extract CLI's usage message) and exit non-zero

## 3. Core fill logic

- [x] 3.1 Implement pure `fillPalette(palette, targets, resolveConflict)` that returns `{ palette, report }`: for each target language compute the suggested set via `suggest(language, palette)`; a language with no existing section is created with the full suggested set and no conflict; a language whose section already has colors asks `resolveConflict(language)` for `'skip' | 'overwrite' | 'merge'`
- [x] 3.2 Apply the three conflict modes: skip leaves the section unchanged; overwrite replaces the section with the full suggested set; merge adds only the suggested slots the section lacks and keeps its existing colors
- [x] 3.3 Ensure targets iterate deterministically (default `registeredLanguages()` order; single language when `--language` given) and report one outcome per language (filled / merged / overwritten / skipped)

## 4. Orchestration and in-place write

- [x] 4.1 Implement `runPaletteSuggestions({ paletteFile, language, conflict, prompt })`: load and validate via `loadPalette` first, reject an unregistered requested language, run `fillPalette`, and only then write the palette back to the input path as `JSON.stringify(palette, null, 2) + '\n'`; any error aborts before the write
- [x] 4.2 Wire the conflict callback: a `conflict` flag short-circuits to its value; an injected `prompt` async function is used when provided; otherwise use a `node:readline` prompt over stdin/stdout when `process.stdin.isTTY`, re-asking on an unrecognized answer, and default to `'merge'` when stdin is not a terminal
- [x] 4.3 Print the per-language report (filled / merged / overwritten / skipped) to stdout on success, naming each language

## 5. Tests

- [x] 5.1 Test `parseArgs`: palette file required; `--language` value parsed; `--conflict-skip` / `--conflict-overwrite` parsed; both conflict flags, unknown flags, and a missing flag value error
- [x] 5.2 Test `fillPalette` against a real palette fixture: absent section created with the full suggested set; merge inserts only missing slots and keeps existing values; overwrite replaces the section; skip leaves it unchanged; a palette section with no registered module is never touched; `--language` with an unregistered language errors
- [x] 5.3 Test `runPaletteSuggestions` end-to-end on a temporary palette file: valid palette is filled in place with 2-space indentation and a trailing newline; an invalid palette fails with a clear error and leaves the file unchanged; running twice with the same inputs and choices yields byte-identical output
- [x] 5.4 Test conflict handling with an injected `prompt` and flags: the prompt's chosen action is applied per conflicting language; with no prompt and non-interactive stdin the default is merge; `--conflict-skip` and `--conflict-overwrite` force their behavior without invoking the prompt
- [x] 5.5 Test the CLI end-to-end via spawning the script with flags (non-interactive) so `main()` is exercised

## 6. Verification

- [x] 6.1 Run `npm test` and confirm all suites pass
- [x] 6.2 Smoke-run `npm run suggest -- palettes/tomorrow.json` interactively (confirm the prompt appears and each choice works) and with `--conflict-skip` / `--conflict-overwrite`, then restore the file with git checkout
