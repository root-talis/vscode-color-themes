const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { parseJsonc } = require('../lib/jsonc.js');
const { loadPalette } = require('../lib/palette.js');
const { buildTheme } = require('../lib/theme.js');
const { applyRustRules, loadFormattingRules } = require('../lib/rust-rules.js');
const { loadThemes } = require('../lib/build-themes.js');
const { normalizeHexInObject, parseHex, formatHex } = require('../lib/color.js');

const ROOT = path.join(__dirname, '..');
const FIXTURES = path.join(__dirname, 'fixtures');
const formattingRules = loadFormattingRules(path.join(FIXTURES, 'generator.json'));

const THEMES = [
  { name: 'github-dark-rust', spec: 'spec/github-dark.json', palette: 'palettes/github-dark.json' },
  { name: 'github-light-rust', spec: 'spec/github-light.json', palette: 'palettes/github-light.json' },
  { name: 'correia-gruvbox-dark-rust', spec: 'spec/correia-gruvbox.json', palette: 'palettes/correia-gruvbox.json' },
];

function buildFor({ name, spec: specFile, palette: paletteFile }, options = {}) {
  const spec = JSON.parse(fs.readFileSync(path.join(FIXTURES, specFile), 'utf8'));
  const palette = loadPalette(path.join(FIXTURES, paletteFile));
  let theme = buildTheme(palette, spec);
  if (!options.noRustRules) theme = applyRustRules(theme, palette, formattingRules);
  return theme;
}

function committedTheme(name) {
  const raw = fs.readFileSync(path.join(FIXTURES, 'themes', `${name}.json`), 'utf8');
  return normalizeHexInObject(parseJsonc(raw));
}

function isHex(value) {
  if (typeof value !== 'string' || !/^#[0-9a-fA-F]+$/.test(value)) return false;
  const len = value.length;
  return len === 7 || len === 9;
}

function collectHexStrings(value, out = []) {
  if (typeof value === 'string') {
    if (/^#[0-9a-fA-F]+$/.test(value)) out.push(value);
  } else if (Array.isArray(value)) {
    for (const v of value) collectHexStrings(v, out);
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) collectHexStrings(v, out);
  }
  return out;
}

test('built themes deep-equal the committed themes (comment-stripped, hex-normalized)', () => {
  for (const t of THEMES) {
    const built = buildFor(t);
    const committed = committedTheme(t.name);
    assert.deepEqual(built, committed, `theme ${t.name} diverges from committed file`);
  }
});

test('every emitted color is a valid 6- or 8-digit hex', () => {
  for (const t of THEMES) {
    const built = buildFor(t);
    for (const hex of collectHexStrings(built)) {
      assert.ok(isHex(hex), `invalid emitted color ${hex} in ${t.name}`);
      const { r, g, b, a } = parseHex(hex);
      assert.equal(formatHex(r, g, b, a), hex, `non-normalized hex ${hex} in ${t.name}`);
    }
  }
});

test('rebuild is deterministic (no drift)', () => {
  for (const t of THEMES) {
    const first = buildFor(t);
    const second = buildFor(t);
    assert.deepEqual(first, second, `theme ${t.name} drifted between builds`);
  }
});

test('emitted theme structure matches committed key sets', () => {
  for (const t of THEMES) {
    const built = buildFor(t);
    const committed = committedTheme(t.name);
    assert.deepEqual(Object.keys(built.colors), Object.keys(committed.colors), `${t.name} colors keys`);
    assert.equal(built.tokenColors.length, committed.tokenColors.length, `${t.name} tokenColors length`);
    assert.deepEqual(Object.keys(built.semanticTokenColors), Object.keys(committed.semanticTokenColors), `${t.name} semantic keys`);
  }
});

test('rust layer adds formatting-only entries and merges mixed entries (5.2)', () => {
  const t = THEMES[0];
  const palette = loadPalette(path.join(FIXTURES, t.palette));
  const spec = JSON.parse(fs.readFileSync(path.join(FIXTURES, t.spec), 'utf8'));
  const stc = applyRustRules(buildTheme(palette, spec), palette, formattingRules).semanticTokenColors;

  assert.deepEqual(stc.struct, { bold: true });
  assert.deepEqual(stc.enum, { bold: true, italic: true });
  assert.deepEqual(stc['*.reference'], { italic: true });
  assert.deepEqual(stc['variable.mutable'], { underline: true });
  assert.deepEqual(stc['keyword.async'], { italic: true });

  assert.deepEqual(stc.macro, { underline: true, foreground: '#b392f0' });
  assert.deepEqual(stc.derive, { foreground: '#b392f0', italic: true });
  assert.deepEqual(stc['variable.consuming'], { foreground: '#f97583', bold: true });
  assert.deepEqual(stc.const, { foreground: '#ffea7f', italic: true });
});

test('rust layer normalizes plain-string mixed entries to objects (5.2)', () => {
  const palette = loadPalette(path.join(FIXTURES, THEMES[0].palette));
  const spec = {
    name: 't',
    colors: {},
    tokenColors: [],
    semanticTokenColors: { macro: 'rust.macro', derive: 'rust.macro' },
  };
  const stc = applyRustRules(buildTheme(palette, spec), palette, formattingRules).semanticTokenColors;
  assert.deepEqual(stc.macro, { underline: true, foreground: '#b392f0' });
  assert.deepEqual(stc.derive, { foreground: '#b392f0', italic: true });
});

test('rust layer seeds colors from a rust palette when the spec has no semanticTokenColors (5.2)', () => {
  const palette = loadPalette(path.join(FIXTURES, 'palettes/correia-gruvbox.json'));
  const spec = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'spec/correia-gruvbox.json'), 'utf8'));
  delete spec.semanticTokenColors;
  const theme = applyRustRules(buildTheme(palette, spec), palette, formattingRules);

  assert.deepEqual(theme.semanticTokenColors.string, '#d79921');
  assert.deepEqual(theme.semanticTokenColors['comment.documentation'], '#dea300');
  assert.deepEqual(theme.semanticTokenColors.decorator, '#da70d6');
  assert.deepEqual(theme.semanticTokenColors.method, '#179fff');
  assert.deepEqual(theme.semanticTokenColors.macro, { underline: true, foreground: '#da70d6' });
  assert.deepEqual(theme.semanticTokenColors.derive, { foreground: '#da70d6', italic: true });
  assert.deepEqual(theme.semanticTokenColors['variable.consuming'], { foreground: '#f44747', bold: true });
  assert.deepEqual(theme.semanticTokenColors.const, { foreground: '#ffd700', italic: true });
});

test('rust layer merges formatting onto spec entries without a rust palette, seeding no colors (5.2)', () => {
  const palette = loadPalette(path.join(FIXTURES, THEMES[0].palette));
  const spec = JSON.parse(fs.readFileSync(path.join(FIXTURES, THEMES[0].spec), 'utf8'));
  const baseTheme = buildTheme(palette, spec);

  const noRustPalette = { type: palette.type, base: palette.base };
  const theme = applyRustRules(baseTheme, noRustPalette, formattingRules);

  assert.deepEqual(theme.semanticTokenColors.struct, { bold: true });
  assert.deepEqual(theme.semanticTokenColors.enum, { bold: true, italic: true });
  assert.deepEqual(theme.semanticTokenColors.macro, { underline: true, foreground: '#b392f0' });
  assert.deepEqual(theme.semanticTokenColors['variable.consuming'], { foreground: '#f97583', bold: true });
  assert.deepEqual(theme.semanticTokenColors.const, { foreground: '#ffea7f', italic: true });
  assert.equal(theme.semanticTokenColors.string, '#85e89d');
  assert.equal(theme.semanticTokenColors.method, '#79b8ff');
});

test('--no-rust-rules build yields only the spec color entries (5.3)', () => {
  const t = THEMES[0];
  const spec = JSON.parse(fs.readFileSync(path.join(FIXTURES, t.spec), 'utf8'));
  const palette = loadPalette(path.join(FIXTURES, t.palette));
  const noRules = buildFor(t, { noRustRules: true });
  assert.deepEqual(noRules, buildTheme(palette, spec));
  assert.deepEqual(Object.keys(noRules.semanticTokenColors), Object.keys(spec.semanticTokenColors));
  const formattingProps = ['bold', 'italic', 'underline'];
  for (const value of Object.values(noRules.semanticTokenColors)) {
    if (value && typeof value === 'object') {
      for (const prop of Object.keys(value)) {
        assert.ok(!formattingProps.includes(prop), `no-rust-rules output retains layer prop ${prop}`);
      }
    }
  }
});

test('CLI: --no-rust-rules flag is parsed alongside theme names with a fixture config (5.3)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gk-build-'));
  try {
    fs.mkdirSync(path.join(dir, 'themes'));
    const res = spawnSync(
      process.execPath,
      [path.join(ROOT, 'lib', 'build-themes.js'), 'github-dark-rust', '--no-rust-rules', '--config', path.join(FIXTURES, 'generator.json')],
      { cwd: dir, encoding: 'utf8' }
    );
    assert.equal(res.status, 0, `CLI failed: ${res.stderr}`);
    const theme = JSON.parse(fs.readFileSync(path.join(dir, 'themes', 'github-dark-rust.json'), 'utf8'));
    const spec = JSON.parse(fs.readFileSync(path.join(FIXTURES, THEMES[0].spec), 'utf8'));
    assert.deepEqual(Object.keys(theme.semanticTokenColors), Object.keys(spec.semanticTokenColors));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('fixture generator.json is the single source of truth for the tested formatting rules', () => {
  const fixtureConfig = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'generator.json'), 'utf8'));
  assert.deepEqual(formattingRules, fixtureConfig.formatting.rust);
});

test('loadThemes reads registrations from the themes key of the fixture generator.json', () => {
  const config = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'generator.json'), 'utf8'));
  const themes = loadThemes(path.join(FIXTURES, 'generator.json'));
  assert.equal(themes.length, config.themes.length);
  for (let i = 0; i < config.themes.length; i++) {
    const registered = config.themes[i];
    assert.equal(themes[i].name, registered.name);
    assert.equal(themes[i].spec, path.join(FIXTURES, registered.spec));
    assert.equal(themes[i].palette, path.join(FIXTURES, registered.palette));
  }
});

test('loadThemes resolves registrations relative to the config file directory (fixture)', () => {
  const themes = loadThemes(path.join(FIXTURES, 'generator.json'));
  assert.ok(themes.length > 0);
  for (const t of themes) {
    assert.ok(t.spec.startsWith(FIXTURES + path.sep), `${t.name} spec resolves under test/fixtures`);
    assert.ok(t.palette.startsWith(FIXTURES + path.sep), `${t.name} palette resolves under test/fixtures`);
  }
});

test('applyRustRules uses the provided formatting table instead of the module default', () => {
  const rules = loadFormattingRules(path.join(FIXTURES, 'generator.json'));
  const custom = { ...rules, struct: { italic: true } };
  const theme = applyRustRules(
    { type: 'dark', colors: {}, tokenColors: [], semanticTokenColors: {} },
    { type: 'dark', base: {}, rust: {} },
    custom
  );
  assert.deepEqual(theme.semanticTokenColors.struct, { italic: true });
});
