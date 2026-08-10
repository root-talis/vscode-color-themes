## Context

The suggestion provider (`lib/suggest.js`) exposes `register`/`suggest`/`registeredLanguages` over a language registry (today only `rust`) and is already used by the extract path to seed a derived palette's `rust` section. Palette files (`palettes/*.json`) are plain JSON with 2-space indentation and a trailing newline, and `lib/palette.js` already validates the palette shape (`validatePalette` requires 16 base colors plus a non-empty `rust` section). There is no CLI that applies suggestions to a palette file directly. See proposal.md for motivation; the behavior contract is `specs/palette-suggestion-fill/spec.md`.

## Goals / Non-Goals

**Goals:**
- A dependency-free CLI (npm script `suggest`) that validates a palette file and fills its per-language semantic sections from the suggestion provider.
- Conflict handling for sections that already have colors: interactive skip/overwrite/merge prompt on a terminal, merge by default off a terminal, and `--conflict-skip` / `--conflict-overwrite` flags that force the behavior without prompting.
- Core logic testable without a real terminal (no stdin faking).
- In-place write matching the committed `palettes/*.json` formatting (2-space indent + trailing newline).

**Non-Goals:**
- No new output-path/`--out` option — the command edits the palette file in place.
- No language autodetection or per-token analysis; the fill is driven purely by the suggestion registry.
- No change to the extract or build commands, their outputs, or the suggestion provider itself.
- No new dependencies.

## Decisions

### D1: Split a pure core from the CLI wrapper
`lib/suggest-palette.js` exports `parseArgs`, a pure `fillPalette(palette, targets, resolveConflict)` that computes the new palette and a report without touching the filesystem or streams, and `runPaletteSuggestions(opts)` that loads, fills, and writes. The existing `lib/extract-spec.js` follows the same `parseArgs`/run/`main()` pattern, so this matches project convention.

- Alternative: one monolithic `main()` reading stdin directly — rejected because the interactive branch is then untestable without stream fakes; tests instead inject a `prompt` function.

### D2: Conflict resolution is an injected callback
`fillPalette` asks `resolveConflict(language)` for each language whose section already has colors; it returns `'skip' | 'overwrite' | 'merge'`. The CLI wires the callback: a flag short-circuits to its value, an injected `prompt` function is used when provided, otherwise a `readline` prompt when `process.stdin.isTTY`, otherwise `'merge'`. The pure core never knows about terminals.

- Alternative: embedding `readline` inside `fillPalette` — rejected; it couples computation to I/O and makes the merge/skip/overwrite matrix hard to unit test.

### D3: Flags are mutually exclusive and suppress the prompt
`--conflict-skip` and `--conflict-overwrite` are accepted at most once and together, erroring otherwise (`parseArgs` returns `{ error }`, matching the extract CLI's arg-parsing style). Setting either flag never prompts, on a terminal or not.

### D4: Targets default to the whole registry, overridable per language
`runPaletteSuggestions` targets `registeredLanguages()` when no `--language` is given, else the single requested language. An unregistered requested language errors before any computation or write (the message comes from `suggest()` itself, which names the language and the registered languages). Palette sections for languages with no registered module are never touched. Because `validatePalette` requires a non-empty `rust` section, the `rust` section always exists and always goes through conflict resolution; an absent section (possible only for a future registered language) is created with the full suggested set, no conflict.

### D5: Suggestion and merge are slot-keyed
Suggestions return an object keyed by slot name. Merge adds each suggested key the section lacks and keeps existing keys; overwrite replaces the whole section object; skip leaves it untouched. New keys append after existing ones — deterministic, since targets iterate in `registeredLanguages()` order and slots iterate in registration order.

### D6: In-place write is deferred until every decision is made
The palette is loaded and validated first; only after all suggestions and conflict resolutions succeed is the file written as `JSON.stringify(palette, null, 2) + '\n'`. Any error aborts before the write, so an invalid palette never modifies the file. Note the extract command writes tab-indented palettes today; this command intentionally matches the committed `palettes/*.json` 2-space formatting instead.

### D7: Node `readline` for the prompt
The prompt reads one of `skip` / `overwrite` / `merge` per conflicting language, re-asking on an unrecognized answer. No new dependency, consistent with the project's zero-dependency policy.

## Risks / Trade-offs

- [Merged keys append after existing ones] → Acceptable: object order is deterministic and cosmetic; this command is not used to regenerate committed palettes.
- [An in-place rewrite normalizes whitespace of a hand-edited file] → Acceptable: palettes are canonical JSON and git tracks them; the command reports every language it touched.
- [Interactive prompt could hang in a TTY-ish CI] → Mitigation: non-TTY stdin and the two conflict flags never prompt; the prompt is the only blocking input.
- [Future registered languages whose sections are absent get created implicitly by the default run] → Mitigation: this is the intended "fill missing" behavior and each filled section is reported.

## Migration Plan

No deployment or rollback story beyond git: the command is new and opt-in, edits palette files in place, and the repository already tracks `palettes/` for review and revert.

## Open Questions

None that would change the specs, approach, or task breakdown.
