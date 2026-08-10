const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function loadFormattingRules(configFile = path.join(ROOT, 'generator.json')) {
  return JSON.parse(fs.readFileSync(configFile, 'utf8')).formatting.rust;
}

let defaultFormattingRules;
function getDefaultFormattingRules() {
  if (defaultFormattingRules === undefined) defaultFormattingRules = loadFormattingRules();
  return defaultFormattingRules;
}

const FORMATTING_BEFORE_FOREGROUND = new Set(['macro']);

const RUST_SEMANTIC_SLOTS = {
  string: 'string',
  'comment.documentation': 'docComment',
  macro: 'macro',
  decorator: 'macro',
  derive: 'macro',
  'variable.consuming': 'consuming',
  const: 'const',
  method: 'method',
};

const RUST_SEMANTIC_FOREGROUND_KEYS = new Set(['macro', 'derive', 'variable.consuming', 'const']);

const RUST_SEMANTIC_ORDER = [
  'string',
  'comment.documentation',
  'typeParameter',
  'namespace',
  'struct',
  'enumMember',
  'type',
  'enum',
  'interface',
  'macro',
  'decorator',
  'derive',
  'variable.consuming',
  '*.consuming',
  '*.reference',
  'variable.mutable',
  'const',
  'method',
  'keyword.async',
];

function mergeEntry(existing, selector, rules) {
  const props = rules[selector];
  const plain = typeof existing === 'string';
  const fg = plain ? existing : existing && existing.foreground;
  const rest = !plain && existing && typeof existing === 'object' ? { ...existing } : {};
  if (!plain) delete rest.foreground;
  const foreground = fg !== undefined ? { foreground: fg } : {};
  if (FORMATTING_BEFORE_FOREGROUND.has(selector)) {
    return { ...props, ...foreground, ...rest };
  }
  return { ...foreground, ...props, ...rest };
}

function applyRustRules(theme, palette, formattingRules = getDefaultFormattingRules()) {
  const stc = { ...(theme.semanticTokenColors || {}) };
  const rust = palette.rust || {};
  if (Object.keys(rust).length > 0) {
    for (const [key, slot] of Object.entries(RUST_SEMANTIC_SLOTS)) {
      if (key in stc) continue;
      const hex = rust[slot];
      if (hex === undefined) continue;
      stc[key] = RUST_SEMANTIC_FOREGROUND_KEYS.has(key) ? { foreground: hex } : hex;
    }
  }

  const specOnly = Object.keys(stc).filter((k) => !RUST_SEMANTIC_ORDER.includes(k));
  const merged = {};
  for (const key of [...RUST_SEMANTIC_ORDER, ...specOnly]) {
    if (key in formattingRules) {
      merged[key] = key in stc ? mergeEntry(stc[key], key, formattingRules) : { ...formattingRules[key] };
    } else if (key in stc) {
      merged[key] = stc[key];
    }
  }
  return { ...theme, semanticTokenColors: merged };
}

function stripRustFormatting(semanticTokenColors, formattingRules = getDefaultFormattingRules()) {
  const out = {};
  for (const [key, value] of Object.entries(semanticTokenColors)) {
    if (!(key in formattingRules)) {
      out[key] = value;
      continue;
    }
    if (typeof value === 'string') {
      out[key] = value;
      continue;
    }
    const props = formattingRules[key];
    const rest = {};
    for (const [k, v] of Object.entries(value)) {
      if (!(k in props)) rest[k] = v;
    }
    if (Object.keys(rest).length > 0) out[key] = rest;
  }
  return out;
}

module.exports = {
  get RUST_FORMATTING_RULES() {
    return getDefaultFormattingRules();
  },
  RUST_SEMANTIC_SLOTS,
  RUST_SEMANTIC_ORDER,
  loadFormattingRules,
  applyRustRules,
  stripRustFormatting,
};
