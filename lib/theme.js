const { resolveColor, MissingSlotError } = require('./resolve.js');
const { normalizeHex, normalizeHexInObject } = require('./color.js');

function resolveSettings(settings, ctx, options = {}) {
  const out = {};
  for (const [key, value] of Object.entries(settings)) {
    if (key === 'foreground' || key === 'background') {
      try {
        out[key] = resolveColor(value, ctx);
      } catch (err) {
        if (!options.dropMissingSlots || !(err instanceof MissingSlotError)) throw err;
      }
    } else {
      out[key] = value;
    }
  }
  return out;
}

function buildTheme(palette, spec) {
  const ctx = { slots: palette.slots, derived: new Map(Object.entries(spec.derived || {})) };

  const colors = {};
  for (const key of Object.keys(spec.colors || {}).sort()) {
    try {
      colors[key] = resolveColor(spec.colors[key], ctx);
    } catch (err) {
      if (!(err instanceof MissingSlotError)) throw err;
    }
  }

  const tokenColors = (spec.tokenColors || []).flatMap((entry) => {
    const out = {};
    if (entry.scope !== undefined) out.scope = entry.scope;
    if (entry.settings) {
      const resolved = resolveSettings(entry.settings, ctx, { dropMissingSlots: true });
      if (Object.keys(resolved).length === 0) return [];
      out.settings = resolved;
    }
    return [out];
  });

  const semanticTokenColors = {};
  for (const [key, value] of Object.entries(spec.semanticTokenColors || {})) {
    if (typeof value === 'string') {
      try {
        semanticTokenColors[key] = resolveColor(value, ctx);
      } catch (err) {
        if (!(err instanceof MissingSlotError)) throw err;
      }
    } else {
      const resolved = resolveSettings(value, ctx, { dropMissingSlots: true });
      if (Object.keys(resolved).length > 0) semanticTokenColors[key] = resolved;
    }
  }

  const theme = {};
  if (spec.name !== undefined) theme.name = spec.name;
  if (spec.$schema !== undefined) theme.$schema = spec.$schema;
  if (spec.type !== undefined) theme.type = spec.type;
  theme.colors = colors;
  theme.tokenColors = tokenColors;
  if (spec.semanticTokenColors !== undefined) theme.semanticTokenColors = semanticTokenColors;
  if (spec.semanticHighlighting !== undefined) theme.semanticHighlighting = spec.semanticHighlighting;

  return theme;
}

// Canonical theme form: the build's own output shape. Reorders top-level keys
// to name, $schema, type, colors, tokenColors, semanticTokenColors,
// semanticHighlighting; sorts `colors` keys; normalizes hex to lowercase with
// `ff` alpha bytes dropped; drops token-rule `name` fields and empty-settings
// rules; normalizes hex settings values and passes non-hex settings through.
function canonicalTheme(theme) {
  const out = {};
  if (theme.name !== undefined) out.name = theme.name;
  if (theme.$schema !== undefined) out.$schema = theme.$schema;
  if (theme.type !== undefined) out.type = theme.type;

  const colors = {};
  for (const key of Object.keys(theme.colors || {}).sort()) {
    colors[key] = normalizeHex(theme.colors[key]);
  }
  out.colors = colors;

  out.tokenColors = (theme.tokenColors || [])
    .filter((entry) => !entry.settings || Object.keys(entry.settings).length > 0)
    .map((entry) => {
      const outEntry = {};
      if (entry.scope !== undefined) outEntry.scope = entry.scope;
      if (entry.settings) {
        const settings = {};
        for (const [key, value] of Object.entries(entry.settings)) {
          if (key === 'foreground' || key === 'background') {
            settings[key] = /^#[0-9a-fA-F]+$/.test(value) ? normalizeHex(value) : value;
          } else {
            settings[key] = value;
          }
        }
        outEntry.settings = settings;
      }
      return outEntry;
    });

  if (theme.semanticTokenColors !== undefined) {
    out.semanticTokenColors = normalizeHexInObject(theme.semanticTokenColors);
  }
  if (theme.semanticHighlighting !== undefined) out.semanticHighlighting = theme.semanticHighlighting;

  return out;
}

module.exports = { buildTheme, resolveSettings, canonicalTheme };
