const { parseHex, formatHex, rgb2lab, rgb2hsl, hsl2rgb, relativeLuminance, withAlpha } = require('./color.js');
const { validatePalette } = require('./palette.js');

function stripAlpha(hex) {
  const { r, g, b } = parseHex(hex);
  return formatHex(r, g, b);
}

function splitScopes(scopes) {
  const out = [];
  for (const scope of Array.isArray(scopes) ? scopes : [scopes]) {
    if (typeof scope !== 'string') continue;
    for (const part of scope.split(',')) {
      const s = part.trim();
      if (s) out.push(s);
    }
  }
  return out;
}

function collectColors(theme) {
  const out = { colors: {}, tokenColors: {}, semanticTokenColors: {} };

  for (const [key, value] of Object.entries(theme.colors || {})) {
    out.colors[key] = stripAlpha(value);
  }
  for (const entry of theme.tokenColors || []) {
    for (const setting of ['foreground', 'background']) {
      if (entry.settings && entry.settings[setting] !== undefined) {
        for (const scope of splitScopes(entry.scope)) {
          out.tokenColors[scope] = stripAlpha(entry.settings[setting]);
        }
      }
    }
  }
  for (const [key, value] of Object.entries(theme.semanticTokenColors || {})) {
    if (typeof value === 'string') {
      out.semanticTokenColors[key] = stripAlpha(value);
    } else if (value && value.foreground !== undefined) {
      out.semanticTokenColors[key] = stripAlpha(value.foreground);
    }
  }
  return out;
}

const BASE_ANCHORS = {
  bg: ['colors', 'editor.background'],
  'bg-soft': ['colors', 'editorGroupHeader.tabsBackground'],
  'bg-muted': ['colors', 'dropdown.background'],
  fg: ['colors', 'editor.foreground'],
  'fg-muted': ['colors', 'activityBar.inactiveForeground'],
  'fg-subtle': ['colors', 'breadcrumb.foreground'],
  border: ['colors', 'activityBar.border'],
  'border-muted': ['colors', 'button.secondaryBackground'],
  blue: ['colors', 'editorBracketHighlight.foreground1'],
  green: ['tokenColors', 'entity.name.tag'],
  red: ['colors', 'editorError.foreground'],
  orange: ['colors', 'editorBracketHighlight.foreground2'],
  yellow: ['colors', 'editorWarning.foreground'],
  purple: ['colors', 'editorBracketHighlight.foreground3'],
  pink: ['tokenColors', 'invalid.broken'],
  cyan: ['colors', 'editor.selectionHighlightBackground'],
  'rust.string': ['semanticTokenColors', 'string'],
  'rust.docComment': ['semanticTokenColors', 'comment.documentation'],
  'rust.macro': ['semanticTokenColors', 'macro'],
  'rust.consuming': ['semanticTokenColors', 'variable.consuming'],
  'rust.const': ['semanticTokenColors', 'const'],
  'rust.method': ['semanticTokenColors', 'method'],
};

const LIGHT_SWAPS = {
  'fg-muted': ['colors', 'breadcrumb.foreground'],
  'fg-subtle': ['colors', 'activityBar.inactiveForeground'],
  'border-muted': ['colors', 'button.secondaryHoverBackground'],
  red: ['colors', 'editorGutter.deletedBackground'],
  yellow: ['colors', 'terminal.ansiYellow'],
  purple: ['tokenColors', 'entity'],
  pink: ['semanticTokenColors', 'macro'],
  cyan: ['colors', 'terminal.ansiCyan'],
};

// DEFAULTS mirrors VS Code's registered defaults for every role-anchor key this
// tool uses (colorRegistry / default theme / semanticTokensRegistry, VS Code main
// at the time of writing). One entry per anchor key; dark/light swap keys share
// an entry. Kinds:
//   literal — a fixed color per theme type;
//   chain   — an operation over other registered color keys, resolved recursively;
//   probe   — ordered token scopes into the theme's own token colors, else editor.foreground.
// Every anchor has a registered default, so a missing key never aborts derivation;
// resolveKey still throws for an unregistered or null default as a defense.
const DEFAULTS = {
  'editor.background': { kind: 'literal', dark: '#1E1E1E', light: '#FFFFFF' },
  'editorGroupHeader.tabsBackground': { kind: 'literal', dark: '#252526', light: '#F3F3F3' },
  'dropdown.background': { kind: 'literal', dark: '#3C3C3C', light: '#FFFFFF' },
  'editor.foreground': { kind: 'literal', dark: '#BBBBBB', light: '#333333' },
  'activityBar.foreground': { kind: 'literal', dark: '#FFFFFF', light: '#FFFFFF' },
  'activityBar.background': { kind: 'literal', dark: '#333333', light: '#2C2C2C' },
  foreground: { kind: 'literal', dark: '#CCCCCC', light: '#616161' },
  'list.hoverBackground': { kind: 'literal', dark: '#2A2D2E', light: '#F0F0F0' },
  'editor.selectionBackground': { kind: 'literal', dark: '#264F78', light: '#ADD6FF' },
  'editorBracketHighlight.foreground1': { kind: 'literal', dark: '#FFD700', light: '#0431FA' },
  'editorBracketHighlight.foreground2': { kind: 'literal', dark: '#DA70D6', light: '#319331' },
  'editorBracketHighlight.foreground3': { kind: 'literal', dark: '#179FFF', light: '#7B3814' },
  'editorError.foreground': { kind: 'literal', dark: '#F14C4C', light: '#E51400' },
  'editorWarning.foreground': { kind: 'literal', dark: '#CCA700', light: '#BF8803' },
  'terminal.ansiYellow': { kind: 'literal', dark: '#E5E510', light: '#949800' },
  'terminal.ansiCyan': { kind: 'literal', dark: '#11A8CD', light: '#0598BC' },
  'entity.name.tag': { kind: 'literal', dark: '#569CD6', light: '#800000' },
  'invalid.broken': { kind: 'literal', dark: '#F44747', light: '#CD3131' },

  'activityBar.inactiveForeground': {
    kind: 'chain',
    op: 'transparent',
    ref: 'activityBar.foreground',
    factor: 0.4,
  },
  'breadcrumb.foreground': {
    kind: 'chain',
    op: 'transparent',
    ref: 'foreground',
    factor: 0.8,
  },
  'editor.selectionHighlightBackground': {
    kind: 'chain',
    op: 'lessProminent',
    base: 'editor.selectionBackground',
    background: 'editor.background',
    factor: 0.3,
    transparency: 0.6,
  },
  'button.secondaryBackground': { kind: 'chain', op: 'ref', ref: 'list.hoverBackground' },
  'button.secondaryHoverBackground': {
    kind: 'chain',
    op: 'lighten',
    ref: 'list.hoverBackground',
    factor: 0.2,
  },
  'editorGutter.deletedBackground': { kind: 'chain', op: 'ref', ref: 'editorError.foreground' },
  entity: { kind: 'chain', op: 'ref', ref: 'editor.foreground' },

  string: { kind: 'probe', scopes: ['string'] },
  'comment.documentation': { kind: 'probe', scopes: ['comment.documentation', 'comment'] },
  macro: {
    kind: 'probe',
    scopes: ['entity.name.function.preprocessor', 'support.function.macro'],
  },
  'variable.consuming': { kind: 'probe', scopes: ['variable.other.readwrite', 'variable'] },
  const: {
    kind: 'probe',
    scopes: ['variable.other.constant', 'constant', 'constant.numeric', 'constant.language'],
  },
  method: {
    kind: 'probe',
    scopes: ['entity.name.function.member', 'support.function', 'entity.name.function'],
  },

  'activityBar.border': { kind: 'chain', op: 'ref', ref: 'activityBar.background' },
};

function lightenToward(from, lum1, lum2, factor) {
  const f = factor * (lum2 - lum1) / lum2;
  if (!Number.isFinite(f)) return from;
  const [h, s, l] = rgb2hsl(from.r, from.g, from.b);
  const l2 = Math.round(Math.max(0, Math.min(1, l + l * f)) * 1000) / 1000;
  const [r, g, b] = hsl2rgb(h, s, l2);
  return { r, g, b };
}

function darkenToward(from, lum1, lum2, factor) {
  const f = factor * (lum1 - lum2) / lum1;
  if (!Number.isFinite(f)) return from;
  const [h, s, l] = rgb2hsl(from.r, from.g, from.b);
  const l2 = Math.round(Math.max(0, Math.min(1, l - l * f)) * 1000) / 1000;
  const [r, g, b] = hsl2rgb(h, s, l2);
  return { r, g, b };
}

function lessProminent(baseHex, bgHex, factor, transparency) {
  const base = parseHex(baseHex);
  const bg = parseHex(bgHex);
  const lum1 = relativeLuminance(base.r, base.g, base.b);
  const lum2 = relativeLuminance(bg.r, bg.g, bg.b);
  const result =
    lum1 < lum2 ? lightenToward(base, lum1, lum2, factor) : darkenToward(base, lum1, lum2, factor);
  return stripAlpha(withAlpha(formatHex(result.r, result.g, result.b), Math.round(transparency * 255)));
}

function lighten(hex, factor) {
  const { r, g, b } = parseHex(hex);
  const [h, s, l] = rgb2hsl(r, g, b);
  const l2 = Math.round(Math.max(0, Math.min(1, l + l * factor)) * 1000) / 1000;
  const [r2, g2, b2] = hsl2rgb(h, s, l2);
  return formatHex(r2, g2, b2);
}

function resolveKey(colors, section, key, type, slot) {
  const themeValue = colors[section][key];
  if (themeValue !== undefined) return themeValue;

  const def = DEFAULTS[key];
  if (!def) {
    throw new Error(`cannot derive palette: theme is missing ${section} ${key} (slot ${slot})`);
  }
  if (def.kind === 'literal') {
    return def[type];
  }
  if (def.kind === 'chain') {
    return applyChain(colors, def, type, slot);
  }
  if (def.kind === 'probe') {
    for (const scope of def.scopes) {
      const value = colors.tokenColors[scope];
      if (value !== undefined) return value;
    }
    return resolveKey(colors, 'colors', 'editor.foreground', type, slot);
  }
  throw new Error(`cannot derive palette: theme is missing ${section} ${key} (slot ${slot})`);
}

function applyChain(colors, chain, type, slot) {
  if (chain.op === 'transparent' || chain.op === 'lighten' || chain.op === 'ref') {
    const ref = resolveKey(colors, 'colors', chain.ref, type, slot);
    if (chain.op === 'transparent') {
      return stripAlpha(withAlpha(ref, Math.round(chain.factor * 255)));
    }
    if (chain.op === 'lighten') {
      return lighten(ref, chain.factor);
    }
    return ref;
  }
  if (chain.op === 'lessProminent') {
    const base = resolveKey(colors, 'colors', chain.base, type, slot);
    const bg = resolveKey(colors, 'colors', chain.background, type, slot);
    return lessProminent(base, bg, chain.factor, chain.transparency);
  }
  throw new Error(`cannot derive palette: theme is missing unknown ${chain.op} (slot ${slot})`);
}

function anchorsFor(type) {
  return type === 'light' ? { ...BASE_ANCHORS, ...LIGHT_SWAPS } : BASE_ANCHORS;
}

// The 8 color-named (chromatic) base slots, in stable fixed order. Names must
// match BASE_ANCHORS exactly so the reassignment relabels the right slots.
const CHROMATIC_SLOTS = ['blue', 'green', 'red', 'orange', 'yellow', 'purple', 'pink', 'cyan'];

// Canonical reference color per chromatic slot (design.md D2): a fixed,
// theme-independent representative hex of each hue family. The exact hexes are
// a design parameter; the observable contract they pin is enforced by the
// extraction tests (identity for the github palettes, blue = #179fff for
// correia-gruvbox), not by the specific values.
const CHROMATIC_REFERENCE = {
  blue: '#3b82f6',
  green: '#4caf50',
  red: '#ef4444',
  orange: '#f97316',
  yellow: '#facc15',
  purple: '#8b5cf6',
  pink: '#f472b6',
  cyan: '#06b6d4',
};

function labOf(hex) {
  const { r, g, b } = parseHex(hex);
  return rgb2lab(r, g, b);
}

function labDistance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

// Minimum-total-distance perfect matching (Hungarian, O(n^3), n = 8) between
// the derived chromatic colors (rows) and the chromatic slots (columns).
// Iterates slots and colors in stable fixed order, so identical duplicate
// colors resolve to the same slot order on every run (design.md D4).
// Returns match[i] = the slot index assigned to color index i.
function hungarianMatch(cost) {
  const n = cost.length;
  const u = new Array(n + 1).fill(0);
  const v = new Array(n + 1).fill(0);
  const p = new Array(n + 1).fill(0);
  const way = new Array(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(n + 1).fill(Infinity);
    const used = new Array(n + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = -1;
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }
  const match = new Array(n);
  for (let j = 1; j <= n; j++) match[p[j] - 1] = j - 1;
  return match;
}

// Relabel the 8 chromatic base slots among the 8 derived chromatic colors by
// minimum total OKLab distance to the canonical references. The neutral and
// rust.* slots keep their resolved values.
function reassignChromaticSlots(base) {
  const colors = CHROMATIC_SLOTS.map((slot) => base[slot]);
  const references = CHROMATIC_SLOTS.map((slot) => labOf(CHROMATIC_REFERENCE[slot]));
  const cost = colors.map((hex) => references.map((ref) => labDistance(labOf(hex), ref)));
  const match = hungarianMatch(cost);
  for (let i = 0; i < CHROMATIC_SLOTS.length; i++) {
    base[CHROMATIC_SLOTS[match[i]]] = colors[i];
  }
}

function derivePalette(theme) {
  if (!theme || typeof theme !== 'object') {
    throw new Error('cannot derive palette: theme must be an object');
  }
  const type = theme.type;
  if (type !== 'dark' && type !== 'light') {
    throw new Error(`cannot derive palette: "type" must be "dark" or "light", got ${JSON.stringify(type)}`);
  }
  const colors = collectColors(theme);
  const data = { type, base: {}, rust: {} };
  for (const [slot, [section, key]] of Object.entries(anchorsFor(type))) {
    // rust.string is derived only when the theme defines a semantic string
    // rule; a theme that colors strings through TextMate rules (or not at all)
    // must not get the slot invented by the token-scope fallback.
    if (slot === 'rust.string' && colors.semanticTokenColors[key] === undefined) continue;
    const value = resolveKey(colors, section, key, type, slot);
    if (slot.startsWith('rust.')) data.rust[slot.slice(5)] = value;
    else data.base[slot] = value;
  }
  reassignChromaticSlots(data.base);
  return validatePalette(data, 'derived palette');
}

module.exports = { derivePalette, collectColors, stripAlpha };
