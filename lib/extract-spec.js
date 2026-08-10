const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseHex, formatHex, rgb2lab, lab2rgb } = require('./color.js');
const { parseJsonc } = require('./jsonc.js');
const { derivePalette } = require('./derive-palette.js');
const { buildTheme, canonicalTheme } = require('./theme.js');
const { applyRustRules, stripRustFormatting, loadFormattingRules } = require('./rust-rules.js');
const { labOf } = require('./resolve.js');
const { suggest } = require('./suggest.js');

function rgbKey(r, g, b) {
  return formatHex(r, g, b);
}

function nearestSlot(rgb, slotLab) {
  const tlab = labOf(rgb);
  let best;
  let bestDist = Infinity;
  for (const [name, lab] of slotLab) {
    const dist = Math.hypot(lab[0] - tlab[0], lab[1] - tlab[1], lab[2] - tlab[2]);
    if (dist < bestDist) {
      bestDist = dist;
      best = name;
    }
  }
  return { name: best, tlab, blab: slotLab.get(best) };
}

function collectColors(theme) {
  const out = [];
  const add = (section, key, value) => {
    if (typeof value === 'string') out.push({ section, key, value });
  };

  for (const [key, value] of Object.entries(theme.colors || {})) {
    add('colors', key, value);
  }
  for (const entry of theme.tokenColors || []) {
    for (const setting of Object.keys(entry.settings || {})) {
      if (setting === 'foreground' || setting === 'background') {
        add('tokenColors', entry.scope, entry.settings[setting]);
      }
    }
  }
  for (const [key, value] of Object.entries(theme.semanticTokenColors || {})) {
    if (typeof value === 'string') {
      add('semanticTokenColors', key, value);
    } else if (value && value.foreground !== undefined) {
      add('semanticTokenColors', key, value.foreground);
    }
  }
  return out;
}

function extractSpec(theme, palette, formattingRules) {
  const strippedTheme = { ...theme };
  if (theme.semanticTokenColors != null) {
    strippedTheme.semanticTokenColors = stripRustFormatting(theme.semanticTokenColors, formattingRules);
  }
  const allSlots = palette.slots;
  const baseSlots = new Map([...allSlots].filter(([name]) => !name.startsWith('rust.')));
  const buildRefs = (slotMap) => {
    const slotLab = new Map();
    const exactSlot = new Map();
    for (const [name, hex] of slotMap) {
      slotLab.set(name, labOf(hex));
      const { r, g, b } = parseHex(hex);
      const key = rgbKey(r, g, b);
      if (!exactSlot.has(key)) exactSlot.set(key, name);
    }
    return { slotLab, exactSlot };
  };
  const refsBySection = {
    colors: buildRefs(baseSlots),
    tokenColors: buildRefs(baseSlots),
    semanticTokenColors: buildRefs(allSlots),
  };

  const derivedBySlot = new Map();
  const expressions = [];

  for (const { section, key, value } of collectColors(strippedTheme)) {
    const { slotLab, exactSlot } = refsBySection[section];
    const { r, g, b, a } = parseHex(value);
    const key3 = rgbKey(r, g, b);

    if (exactSlot.has(key3)) {
      const slot = exactSlot.get(key3);
      expressions.push({
        section,
        key,
        value,
        alpha: a,
        expr: a === 255 ? slot : `${slot}@${a.toString(16).padStart(2, '0')}`,
      });
      continue;
    }

    const { name: slot, tlab, blab } = nearestSlot(key3, slotLab);
    const d = [tlab[0] - blab[0], tlab[1] - blab[1], tlab[2] - blab[2]];
    const entry = { section, key, value, alpha: a, d, slot, rgb: key3, L: tlab[0] };
    if (!derivedBySlot.has(slot)) derivedBySlot.set(slot, []);
    derivedBySlot.get(slot).push(entry);
    expressions.push(entry);
  }

  const derived = {};
  for (const [slot, entries] of derivedBySlot) {
    const sorted = [...entries].sort(
      (x, y) => x.L - y.L || (x.rgb < y.rgb ? -1 : x.rgb > y.rgb ? 1 : 0)
    );
    sorted.forEach((entry, i) => {
      const token = `${slot}.d${i}`;
      derived[token] = { ref: slot, d: entry.d };
      entry.token = token;
    });
  }

  const tokenColorOut = (strippedTheme.tokenColors || [])
    .filter((entry) => !entry.settings || Object.keys(entry.settings).length > 0)
    .map((entry) => {
      const out = {};
      if (entry.scope !== undefined) out.scope = entry.scope;
      if (entry.settings) {
        out.settings = {};
        for (const [sk, sv] of Object.entries(entry.settings)) {
          if (sk === 'foreground' || sk === 'background') {
            out.settings[sk] = expressionFor(expressions, 'tokenColors', entry.scope, sv);
          } else {
            out.settings[sk] = sv;
          }
        }
      }
      return out;
    });

  const colorsOut = {};
  for (const key of Object.keys(strippedTheme.colors || {}).sort()) {
    colorsOut[key] = expressionFor(expressions, 'colors', key, strippedTheme.colors[key]);
  }

  const semanticOut = {};
  for (const [key, value] of Object.entries(strippedTheme.semanticTokenColors || {})) {
    if (typeof value === 'string') {
      semanticOut[key] = expressionFor(expressions, 'semanticTokenColors', key, value);
    } else {
      const out = {};
      for (const [sk, sv] of Object.entries(value)) {
        out[sk] = sk === 'foreground' ? expressionFor(expressions, 'semanticTokenColors', key, sv) : sv;
      }
      semanticOut[key] = out;
    }
  }

  const spec = {};
  if (theme.name !== undefined) spec.name = theme.name;
  if (theme.$schema !== undefined) spec.$schema = theme.$schema;
  if (theme.type !== undefined) spec.type = theme.type;
  spec.derived = derived;
  spec.colors = colorsOut;
  spec.tokenColors = tokenColorOut;
  if (strippedTheme.semanticTokenColors !== undefined) spec.semanticTokenColors = semanticOut;
  if (strippedTheme.semanticHighlighting !== undefined) spec.semanticHighlighting = strippedTheme.semanticHighlighting;

  return spec;
}

function expressionFor(expressions, section, key, value) {
  const match = expressions.find((e) => e.section === section && e.key === key && e.value === value);
  if (!match) throw new Error(`no expression computed for ${section}:${key}`);
  if (match.token) {
    return match.alpha === 255 ? match.token : `${match.token}@${match.alpha.toString(16).padStart(2, '0')}`;
  }
  return match.expr;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.themeFile || args.error) {
    console.error(args.error || '');
    console.error(
      'usage: node lib/extract-spec.js <theme.json> [--out-dir <dir>] [--config <generator.json>]'
    );
    process.exit(1);
  }
  try {
    const formattingRules = args.configFile ? loadFormattingRules(args.configFile) : undefined;
    const { paletteFile, specFile } = runExtract(
      { themeFile: args.themeFile, outDir: args.outDir },
      undefined,
      formattingRules
    );
    console.log(`wrote ${paletteFile}`);
    console.log(`wrote ${specFile}`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

function extractTheme(theme, formattingRules) {
  const palette = derivePalette(theme);
  const spec = extractSpec(theme, palette, formattingRules);
  return { palette, spec };
}

function firstDifference(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) return i;
  }
  return a.length === b.length ? -1 : n;
}

function composedBuild(palette, spec, formattingRules) {
  return applyRustRules(buildTheme(palette, spec), palette, formattingRules);
}

function verifyRebuild(themeText, palette, spec, themeFile = '<theme>', build, formattingRules) {
  const expected = JSON.stringify(canonicalTheme(parseJsonc(themeText)), null, '\t') + '\n';
  const candidates = build ? [build] : [(p, s) => composedBuild(p, s, formattingRules), buildTheme];
  const rebuiltCandidates = candidates.map((b) => JSON.stringify(b(palette, spec), null, '\t') + '\n');
  if (rebuiltCandidates.some((rebuilt) => rebuilt === expected)) return;

  const rebuilt = rebuiltCandidates[0];
  const tmp = path.join(
    os.tmpdir(),
    `gk-extract-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
  );
  try {
    fs.writeFileSync(tmp, rebuilt);
    const written = fs.readFileSync(tmp, 'utf8');
    const at = firstDifference(written, expected);
    const near = expected.slice(Math.max(0, at - 40), at + 40);
    throw new Error(
      `verification failed for ${themeFile}: rebuilt theme does not match input theme byte-for-byte ` +
        `(first difference at byte ${at}: ...${near}...)`
    );
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

function outputPaths(stem, outDir) {
  if (outDir) {
    return {
      paletteFile: path.join(outDir, `${stem}.palette.json`),
      specFile: path.join(outDir, `${stem}.spec.json`),
    };
  }
  return {
    paletteFile: path.join('palettes', `${stem}.json`),
    specFile: path.join('spec', `${stem}.json`),
  };
}

function runExtract({ themeFile, outDir }, build, formattingRules) {
  const themeText = fs.readFileSync(themeFile, 'utf8');
  const theme = parseJsonc(themeText);
  const { palette, spec } = extractTheme(theme, formattingRules);
  verifyRebuild(themeText, palette, spec, themeFile, build, formattingRules);
  palette.rust = suggest('rust', palette);
  const stem = path.basename(themeFile, '.json').replace(/-rust$/, '');
  const { paletteFile, specFile } = outputPaths(stem, outDir);
  fs.mkdirSync(path.dirname(paletteFile), { recursive: true });
  fs.mkdirSync(path.dirname(specFile), { recursive: true });
  fs.writeFileSync(paletteFile, JSON.stringify({ type: palette.type, base: palette.base, rust: palette.rust }, null, '\t') + '\n');
  fs.writeFileSync(specFile, JSON.stringify(spec, null, '\t') + '\n');
  return { paletteFile, specFile };
}

function parseArgs(argv) {
  const parsed = { themeFile: null, outDir: null, configFile: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out-dir') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) {
        return { error: '--out-dir requires a directory argument' };
      }
      parsed.outDir = value;
      i++;
    } else if (argv[i] === '--config') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) {
        return { error: '--config requires a generator.json argument' };
      }
      parsed.configFile = value;
      i++;
    } else if (parsed.themeFile === null) {
      parsed.themeFile = argv[i];
    } else {
      return { error: `unexpected argument ${argv[i]}` };
    }
  }
  return parsed;
}

if (require.main === module) main();

module.exports = { extractSpec, collectColors, extractTheme, verifyRebuild, outputPaths, runExtract, parseArgs };
