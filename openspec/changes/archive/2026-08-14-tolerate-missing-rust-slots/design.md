## Context

See proposal.md — Why.

The build pipeline is `build-themes.js` → `buildOne` → `loadPalette` + `buildTheme(palette, spec)` → `applyRustRules(theme, palette)`. `buildTheme` (`lib/theme.js`) resolves `spec.colors`, `spec.tokenColors`, and `spec.semanticTokenColors` through `resolveColor` (`lib/resolve.js`). `resolveColor` fails the whole build in two missing-slot cases: a derived token whose `ref` slot is absent (`derived token ${token} references unknown slot ${ref}`), and a token that is neither derived nor a registered slot (`unknown color expression ${expression}`) — the latter is how a direct reference like `rust.string` in `semanticTokenColors` fails when the slot is missing.

`validatePalette` requires a non-empty `rust` section but not any particular slot, so a palette can legitimately lack specific rust slots. `applyRustRules` (`lib/rust-rules.js`) already tolerates missing rust slots when seeding colors and already adds formatting-only entries for formatting keys absent from `semanticTokenColors`, so the formatting layer needs no change.

Scope was confirmed with the user: the affected entry keeps its formatting and loses only the color; the tolerance applies to `semanticTokenColors`, `colors`, and `tokenColors`, because real palettes (for example `palettes/github-dark.json`) reference rust slots from `colors` through derived tokens.

## Goals / Non-Goals

**Goals:**
- The build succeeds when a color reference in `semanticTokenColors`, `colors`, or `tokenColors` targets a rust slot missing from the palette.
- `semanticTokenColors`: the affected entry is emitted with the `formatting.rust` properties and no color; an entry with no formatting rule is omitted.
- `colors`: the unresolvable key is omitted; `tokenColors`: the unresolvable property is dropped and an entry left with no settings is omitted.
- Output for complete palettes stays byte-identical.

**Non-Goals:**
- No change to the formatting layer or `generator.json`.
- No change to the throwing behavior for malformed expressions and non-missing-slot errors.
- No change to extraction (`extract-spec.js`), which always produces complete palettes.
- No change to `resolveColor`'s throwing contract for the strict paths.

## Decisions

### Decision 1: Distinguishable missing-slot error
Introduce a `MissingSlotError` class in `lib/resolve.js` and throw it for both missing-slot cases (derived ref slot absent; token neither derived nor a slot). The message text stays identical to today's, so the strict paths' observable behavior is unchanged.

**Why**: the semantic token path must selectively tolerate missing slots while `colors`/`tokenColors` keep failing loudly. An error subclass lets the caller discriminate by cause without threading new options through `resolveColor`'s return values.

**Alternative considered**: `resolveColor` returns a sentinel (e.g. `undefined`) on missing slots. Rejected — it would make every caller responsible for remembering to check, and a forgotten check would silently propagate a bad color into strict sections.

### Decision 2: Lenient resolution in all three color sections
In `buildTheme` (`lib/theme.js`), resolve `colors`, `tokenColors`, and `semanticTokenColors` leniently with respect to missing slots:
- `colors`: catch `MissingSlotError` and omit the key.
- `tokenColors`: resolve settings through the lenient prop path, skipping any prop that raises `MissingSlotError`; omit the entry when no settings remain.
- `semanticTokenColors`: plain-string entries catch `MissingSlotError` and drop the entry; object entries resolve each `foreground`/`background` prop, skipping any prop that raises `MissingSlotError` and keeping non-color props; if the entry ends up with no props, drop it.

Malformed expressions and non-missing-slot errors still throw in every section.

**Why**: this is exactly where the user scoped the tolerance, and the `MissingSlotError` subclass keeps the drop confined to the missing-slot cause so the strict paths stay strict for every other error.

**Alternative considered**: a global lenient flag inside `resolveColor`. Rejected — it would change behavior for malformed and other errors too, and it would force every caller down the same path.

### Decision 3: Let applyRustRules produce the formatting-only result
After a color is dropped, `applyRustRules` already merges formatting into surviving entries and adds formatting-only entries for formatting keys absent from `semanticTokenColors`. So a missing `rust.macro` referenced by `macro` yields `{ "underline": true }`, while `string` (no formatting rule) stays omitted. `lib/rust-rules.js` needs no change.

**Why**: color resolution and the formatting merge stay separate responsibilities, and the existing formatting logic already implements the wanted behavior for free.

## Risks / Trade-offs

- [A typo'd semantic token reference is silently dropped instead of failing] → The drop triggers only on the missing-slot error; malformed input (non-string expression, invalid alpha byte) still throws. The trigger cases are pinned by tests.
- [The tolerance could hide a palette regression for rust colors] → Complete palettes still rebuild byte-exact, so snapshot tests catch drift, and malformed expressions still throw in every section.
- [An entry that loses its only property disappears from the theme] → This is the agreed behavior for tokens with no formatting rule; tokens with a formatting rule keep a formatting-only entry.

## Migration Plan

No migration. The change is internal robustness only: committed themes, palettes, specs, and `generator.json` are untouched, and builds from complete palettes remain byte-identical.

## Open Questions

None — the scope (semanticTokenColors only) and entry behavior (formatting kept, color dropped) were confirmed with the user before planning.
