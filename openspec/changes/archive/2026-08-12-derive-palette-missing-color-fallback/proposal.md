## Why

Palette derivation (`lib/derive-palette.js`) aborts as soon as a role-anchor theme key is missing. Real-world themes routinely omit keys: the bundled `themes/correia-gruvbox.json` (176 colors, dark) lacks eight base anchors plus all six `rust.*` semantic anchors, so extraction fails today. VS Code itself does not require every color key: when a theme omits one, VS Code falls back to that color's registered default — which may be a reference to another color, a literal color, or, for token/semantic colors, a scope the editor matches against the theme's own token rules. The extractor should mirror those rules so missing colors resolve instead of killing extraction.

Two findings reshape the fallback beyond the initial "borrow the referenced color" idea:

1. **Literals resolve too.** Several anchor keys have literal VS Code defaults (for example `editorBracketHighlight.foreground1` → `#FFD700` dark / `#0431FA` light). VS Code paints these when a theme omits the key, so recovery should too — not fail.
2. **The theme's own token scopes resolve the semantic slots.** correia's `semanticTokenColors` is empty, but its `tokenColors` carry full gruvbox scope rules. VS Code maps semantic token types to concrete scopes (`string` → `string`, `macro` → `entity.name.function.preprocessor` / `support.function.macro`, and so on). Probing those scopes in the theme's token colors recovers real gruvbox values (for example `string` → `#D8A657`) — far better than erroring or inventing colors.

Additionally, correia stores its token rules as **comma-joined scope lists** (`"storage, modifier, keyword.var, entity.name.tag, ..."`). Lookups must split those lists to see the individual scopes.

The result: every anchor has a registered default — literal, computed chain, or probe — and only genuinely unresolvable anchors error. In the current anchor set, exactly one anchor has no registered default: `activityBar.border`.

## What Changes

- `collectColors` in `lib/derive-palette.js` splits comma-joined scope strings and array `scope` entries into individual scopes before indexing the token-color table, so single-scope lookups (`entity.name.tag`, `string`, `comment`, `support.function`, ...) resolve in comma-heavy themes.
- A single `DEFAULTS` registry replaces the current `FALLBACK_CHAINS`, with one entry per anchor key (dark/light swap keys share an entry), each entry being one of:
  - **literal**: a fixed color per theme type, taken from VS Code's registered default (dark / light values from the `colorRegistry` or the default theme).
  - **chain**: an operation over other registered color keys — `transparent(ref, p)`, `lighten(ref, p)`, `ref`, or `lessProminent(base, background, f, t)` — resolved recursively: a referenced key is itself resolved theme-first, then by its own registered default.
  - **probe**: an ordered list of token scopes, following VS Code's `semanticTokensRegistry` mappings; the first scope present in the theme's token colors fills the slot; if none are present the slot falls back to `editor.foreground`. Used for the six `rust.*` semantic slots.
  - **null**: no default; the anchor errors (only `activityBar.border`).
- The six `rust.*` semantic slots and the `entity.name.tag` / `invalid.broken` token-scope anchors now resolve through the registry (probe / literal) instead of always erroring.
- Recursive resolution replaces single-level chains: a chain that references a key which is itself missing resolves that key's own registered default (for example `button.secondaryBackground` → `list.hoverBackground` → literal `#2A2D2E` dark). Chains no longer "terminate at an absent color".
- The error path shrinks to keys whose registered default is `null` or unregistered: the existing `cannot derive palette: theme is missing <section> <key> (slot <slot>)` message is unchanged and still writes no outputs.
- `themes/correia-gruvbox.json` now extracts successfully. Its derived palette is dominated by its own gruvbox colors (for example `fg`/`bg`/`border` `#ebdbb2`/`#1d2021`/`#3c3836`, `red` `#cc241d`, `yellow` `#d79921`, `green` `#e78a4e`, `rust.string` `#d8a657`, `rust.macro` `#d3869b`); the slots it omits resolve from its own chains or VS Code defaults, and the palette + spec rebuild the input theme byte-for-byte.
- No change to the build path, to the CLI signature, or to committed themes.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `theme-generation`: The "palette derived from theme" behavior (introduced by `derive-palette-on-extract`) changes so that missing role-anchor colors are resolved by VS Code's registered defaults — literals, reference chains, and semantic-token scope probes against the theme's own token colors — instead of failing immediately. Only anchors with no registered default still fail.

## Impact

- **Modified**: `lib/derive-palette.js` (scope splitting, `DEFAULTS` registry, recursive resolution), `test/extract.test.js` (correia success + artifact-rebuild end-to-end; literal/probe default tests; the stub expectation moves to `activityBar.border`), and `openspec/specs/theme-generation/spec.md` (delta synced after this change).
- **Behavior preserved**: committed themes still extract and rebuild byte-for-byte; themes that resolve every slot from anchor keys alone derive exactly as before; the stub theme still fails fast with no outputs (now at `activityBar.border`).
- **Fixture ground truth**: `themes/correia-gruvbox.json` becomes the end-to-end success fixture — extraction succeeds, writes palette and spec artifacts, and the artifacts rebuild the theme byte-for-byte into a temporary file.
