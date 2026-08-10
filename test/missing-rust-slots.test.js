const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { resolveColor, MissingSlotError } = require('../lib/resolve.js');
const { validatePalette } = require('../lib/palette.js');
const { buildTheme } = require('../lib/theme.js');
const { applyRustRules, loadFormattingRules } = require('../lib/rust-rules.js');

const FIXTURES = path.join(__dirname, 'fixtures');
const ROOT = path.join(__dirname, '..');
const formattingRules = loadFormattingRules(path.join(FIXTURES, 'generator.json'));

function paletteWithout(rustKey) {
  const data = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'palettes/github-dark.json'), 'utf8'));
  delete data.rust[rustKey];
  return validatePalette(data, 'test');
}

function ctx() {
  return { slots: new Map(), derived: new Map() };
}

test('missing-slot references throw MissingSlotError with unchanged messages (1.1)', () => {
  const derivedCtx = { slots: new Map(), derived: new Map([['red.d0', { ref: 'red', d: [0, 0, 0] }]]) };
  assert.throws(
    () => resolveColor('red.d0', derivedCtx),
    (err) => {
      assert.ok(err instanceof MissingSlotError, 'expected MissingSlotError');
      assert.ok(err instanceof Error, 'MissingSlotError must subclass Error');
      assert.equal(err.message, 'derived token red.d0 references unknown slot red');
      return true;
    }
  );

  assert.throws(
    () => resolveColor('rust.string', ctx()),
    (err) => {
      assert.ok(err instanceof MissingSlotError, 'expected MissingSlotError');
      assert.equal(err.message, 'unknown color expression rust.string');
      return true;
    }
  );
});

test('malformed expressions still throw the existing errors, not MissingSlotError (1.2)', () => {
  assert.throws(
    () => resolveColor('blue@zz', ctx()),
    (err) => {
      assert.ok(!(err instanceof MissingSlotError), 'invalid alpha must not be a MissingSlotError');
      assert.equal(err.message, 'invalid alpha byte in expression blue@zz');
      return true;
    }
  );

  assert.throws(
    () => resolveColor(42, ctx()),
    (err) => {
      assert.ok(!(err instanceof MissingSlotError), 'non-string must not be a MissingSlotError');
      assert.equal(err.message, 'expression must be a string, got 42');
      return true;
    }
  );
});

test('buildTheme drops a plain-string semanticTokenColors entry whose rust slot is missing (2.1)', () => {
  const palette = paletteWithout('string');
  const spec = {
    name: 't',
    type: 'dark',
    colors: {},
    tokenColors: [],
    semanticTokenColors: { string: 'rust.string' },
  };
  const theme = buildTheme(palette, spec);
  assert.deepEqual(theme.semanticTokenColors, {});
});

test('buildTheme drops a missing foreground prop but keeps resolvable props, and drops empty entries (2.2)', () => {
  const palette = paletteWithout('string');
  const spec = {
    name: 't',
    type: 'dark',
    colors: {},
    tokenColors: [],
    semanticTokenColors: {
      'my.custom': { foreground: 'rust.string', background: 'blue' },
      'my.bare': { foreground: 'rust.string' },
      'my.kept': { foreground: 'green', fontStyle: 'italic' },
    },
  };
  const theme = buildTheme(palette, spec);
  assert.deepEqual(theme.semanticTokenColors['my.custom'], { background: palette.base.blue });
  assert.ok(!('my.bare' in theme.semanticTokenColors), 'entry left with no props must be dropped');
  assert.deepEqual(theme.semanticTokenColors['my.kept'], { foreground: palette.base.green, fontStyle: 'italic' });
});

test('colors omit the unresolvable key and tokenColors drop the unresolvable property (2.3)', () => {
  const palette = paletteWithout('string');
  const specWithColors = {
    name: 't',
    type: 'dark',
    derived: { 'rust.string.d0': { ref: 'rust.string', d: [0, 0, 0] } },
    colors: {
      'editor.findMatchBackground': 'rust.string.d0@44',
      'editor.foreground': 'fg',
    },
    tokenColors: [],
    semanticTokenColors: {},
  };
  const theme = buildTheme(palette, specWithColors);
  assert.ok(!('editor.findMatchBackground' in theme.colors), 'missing-slot colors key must be omitted');
  assert.equal(theme.colors['editor.foreground'], palette.base.fg);

  const specWithTokenColors = {
    name: 't',
    type: 'dark',
    derived: { 'rust.string.d0': { ref: 'rust.string', d: [0, 0, 0] } },
    colors: {},
    tokenColors: [
      { scope: 'string', settings: { foreground: 'rust.string.d0', fontStyle: 'italic' } },
      { scope: 'meta.other', settings: { foreground: 'rust.string.d0' } },
    ],
    semanticTokenColors: {},
  };
  const theme2 = buildTheme(palette, specWithTokenColors);
  assert.deepEqual(theme2.tokenColors, [{ scope: 'string', settings: { fontStyle: 'italic' } }]);
});

test('end-to-end: real github-dark palette minus rust.string drops only the dependent keys (3.4)', () => {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'palettes/github-dark.json'), 'utf8'));
  delete data.rust.string;
  const palette = validatePalette(data, 'palettes/github-dark.json');
  const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'spec/github-dark.json'), 'utf8'));
  // The committed spec now maps the findMatch keys and the string token to the
  // green slot; point them back at rust.string so the missing slot actually
  // has dependents to drop, as the pre-regeneration spec did.
  const delta = { ref: 'rust.string', d: [0, 0, 0] };
  spec.derived = { ...spec.derived, 'rust.string.d0': delta, 'rust.string.d1': delta, 'rust.string.d2': delta, 'rust.string.d3': delta };
  spec.colors = {
    ...spec.colors,
    'editor.findMatchBackground': 'rust.string.d0@44',
    'editor.findMatchHighlightBackground': 'rust.string.d1@22',
    'peekViewEditor.matchHighlightBackground': 'rust.string.d2@33',
    'peekViewResult.matchHighlightBackground': 'rust.string.d3@33',
  };
  spec.semanticTokenColors = { ...spec.semanticTokenColors, string: 'rust.string' };
  const realRules = loadFormattingRules(path.join(ROOT, 'generator.json'));
  const theme = applyRustRules(buildTheme(palette, spec), palette, realRules);

  for (const key of [
    'editor.findMatchBackground',
    'editor.findMatchHighlightBackground',
    'peekViewEditor.matchHighlightBackground',
    'peekViewResult.matchHighlightBackground',
  ]) {
    assert.ok(!(key in theme.colors), `${key} must be omitted`);
  }
  assert.ok('editor.foreground' in theme.colors, 'unaffected colors key must resolve');
  assert.ok(!('string' in theme.semanticTokenColors), 'string semantic entry must be omitted');
  assert.deepEqual(theme.semanticTokenColors.macro, { underline: true, foreground: palette.rust.macro });
  assert.deepEqual(theme.semanticTokenColors.derive, { foreground: palette.rust.macro, italic: true });
  assert.deepEqual(theme.semanticTokenColors['comment.documentation'], palette.rust.docComment);
});

test('end-to-end: missing rust.macro keeps the macro entry with formatting only (3.1)', () => {
  const palette = paletteWithout('macro');
  const spec = {
    name: 't',
    type: 'dark',
    colors: {},
    tokenColors: [],
    semanticTokenColors: {
      string: 'rust.string',
      'comment.documentation': 'rust.docComment',
      macro: { foreground: 'rust.macro' },
      decorator: 'rust.macro',
      derive: { foreground: 'rust.macro' },
      const: { foreground: 'rust.const' },
      method: 'rust.method',
    },
  };
  const theme = applyRustRules(buildTheme(palette, spec), palette, formattingRules);
  assert.deepEqual(theme.semanticTokenColors.macro, { underline: true });
});

test('end-to-end: missing rust.string omits the entry while formatting-only tokens stay (3.2)', () => {
  const palette = paletteWithout('string');
  const spec = {
    name: 't',
    type: 'dark',
    colors: {},
    tokenColors: [],
    semanticTokenColors: {
      string: 'rust.string',
      macro: { foreground: 'rust.macro' },
    },
  };
  const theme = applyRustRules(buildTheme(palette, spec), palette, formattingRules);
  assert.ok(!('string' in theme.semanticTokenColors), 'string entry must be omitted');
  assert.deepEqual(theme.semanticTokenColors.struct, { bold: true });
  assert.deepEqual(theme.semanticTokenColors.macro, { underline: true, foreground: palette.rust.macro });
});

test('end-to-end: one missing slot leaves all other entries fully colored and formatted (3.3)', () => {
  const palette = paletteWithout('string');
  const spec = {
    name: 't',
    type: 'dark',
    colors: {},
    tokenColors: [],
    semanticTokenColors: {
      string: 'rust.string',
      'comment.documentation': 'rust.docComment',
      macro: { foreground: 'rust.macro' },
      decorator: 'rust.macro',
      derive: { foreground: 'rust.macro' },
      'variable.consuming': { foreground: 'rust.consuming' },
      const: { foreground: 'rust.const' },
      method: 'rust.method',
    },
  };
  const theme = applyRustRules(buildTheme(palette, spec), palette, formattingRules);
  assert.ok(!('string' in theme.semanticTokenColors));
  assert.deepEqual(theme.semanticTokenColors.derive, { foreground: palette.rust.macro, italic: true });
  assert.deepEqual(theme.semanticTokenColors.macro, { underline: true, foreground: palette.rust.macro });
  assert.deepEqual(theme.semanticTokenColors['comment.documentation'], palette.rust.docComment);
  assert.deepEqual(theme.semanticTokenColors.method, palette.rust.method);
  assert.deepEqual(theme.semanticTokenColors['variable.consuming'], { foreground: palette.rust.consuming, bold: true });
  assert.deepEqual(theme.semanticTokenColors.const, { foreground: palette.rust.const, italic: true });
});
