const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { parseJsonc, stripComments } = require('../lib/jsonc.js');
const { normalizeHexInObject } = require('../lib/color.js');
const { buildTheme, canonicalTheme } = require('../lib/theme.js');
const { loadPalette } = require('../lib/palette.js');
const { extractTheme, verifyRebuild, runExtract } = require('../lib/extract-spec.js');
const { applyRustRules, loadFormattingRules } = require('../lib/rust-rules.js');
const { suggest } = require('../lib/suggest.js');

const ROOT = path.join(__dirname, '..');
const FIXTURES = path.join(__dirname, 'fixtures');
const formattingRules = loadFormattingRules(path.join(FIXTURES, 'generator.json'));

const THEMES = [
  { theme: 'themes/github-dark-rust.json', palette: 'palettes/github-dark.json', spec: 'spec/github-dark.json' },
  { theme: 'themes/github-light-rust.json', palette: 'palettes/github-light.json', spec: 'spec/github-light.json' },
];

function readTheme(t) {
  return parseJsonc(fs.readFileSync(path.join(FIXTURES, t.theme), 'utf8'));
}

function committedPalette(t) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, t.palette), 'utf8'));
}

function committedSpec(t) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, t.spec), 'utf8'));
}

function syntheticTheme() {
  return {
    type: 'dark',
    colors: {
      'editor.background': '#000000',
      'editorGroupHeader.tabsBackground': '#111111',
      'dropdown.background': '#222222',
      'editor.foreground': '#e1e4e8',
      'activityBar.inactiveForeground': '#6a737d',
      'breadcrumb.foreground': '#959da5',
      'activityBar.border': '#333333',
      'button.secondaryBackground': '#444444',
      'editorBracketHighlight.foreground1': '#79b8ff',
      'editorBracketHighlight.foreground2': '#ffab70',
      'editorBracketHighlight.foreground3': '#b392f0',
      'editorError.foreground': '#f97583',
      'editorWarning.foreground': '#ffea7f',
      'editor.selectionHighlightBackground': '#17e5e633',
    },
    tokenColors: [
      { scope: 'entity.name.tag', settings: { foreground: '#85e89d' } },
      { scope: 'invalid.broken', settings: { foreground: '#fdaeb7', fontStyle: 'italic' } },
    ],
    semanticTokenColors: {
      string: '#f5dc6d',
      'comment.documentation': '#5fa6e0',
      macro: '#ff85e0',
      'variable.consuming': '#ff3f3f',
      const: '#ff9900',
      method: '#97e762',
    },
  };
}

function anchorTheme(type) {
  const t = structuredClone(syntheticTheme());
  t.type = type;
  if (type === 'light') {
    Object.assign(t.colors, {
      'button.secondaryHoverBackground': '#c8e1ff',
      'editorGutter.deletedBackground': '#ffeef0',
      'terminal.ansiYellow': '#b08800',
      'terminal.ansiCyan': '#0184bc',
    });
    t.tokenColors.push({ scope: 'entity', settings: { foreground: '#a04100' } });
  }
  return t;
}

function rebuiltBytes(palette, spec) {
  return JSON.stringify(buildTheme(palette, spec), null, '\t') + '\n';
}

function themeBytes(theme) {
  return JSON.stringify(theme, null, '\t') + '\n';
}

function withTmpDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gk-extract-'));
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('extractTheme recovers the committed palette (3.1)', () => {
  for (const t of THEMES) {
    const { palette } = extractTheme(readTheme(t), formattingRules);
    const { type, base, rust } = committedPalette(t);
    assert.deepEqual(palette.type, type, `${t.theme} type`);
    assert.deepEqual(palette.base, base, `${t.theme} base`);
    assert.deepEqual(palette.rust, rust, `${t.theme} rust`);
  }
});

test('extractTheme recovers the committed spec (3.2)', () => {
  for (const t of THEMES) {
    const { spec } = extractTheme(readTheme(t), formattingRules);
    assert.deepEqual(spec, committedSpec(t), `${t.theme} spec`);
  }
});

test('buildTheme(derived palette, derived spec) reproduces the committed theme (3.3)', () => {
  for (const t of THEMES) {
    const { palette, spec } = extractTheme(readTheme(t), formattingRules);
    const built = applyRustRules(buildTheme(palette, spec), palette, formattingRules);
    const committed = normalizeHexInObject(readTheme(t));
    assert.equal(JSON.stringify(built), JSON.stringify(committed), `${t.theme} rebuild diverges`);
  }
});

test('extracted spec contains none of the rust formatting layer props (4.1)', () => {
  const formattingProps = new Set(Object.values(formattingRules).flatMap((p) => Object.keys(p)));
  for (const t of THEMES) {
    const { spec } = extractTheme(readTheme(t), formattingRules);
    for (const [selector, value] of Object.entries(spec.semanticTokenColors)) {
      if (value && typeof value === 'object') {
        for (const prop of Object.keys(value)) {
          assert.ok(!formattingProps.has(prop), `${t.theme} semanticTokenColors.${selector} retains layer prop ${prop}`);
        }
      }
    }
  }
});

test('alpha-only color is recovered from its RGB component (3.4)', () => {
  const { palette } = extractTheme(syntheticTheme(), formattingRules);
  assert.equal(palette.base.cyan, '#17e5e6');
  assert.equal(palette.base.bg, '#000000');
  assert.equal(palette.base['border-muted'], '#444444');
  assert.equal(palette.rust.method, '#97e762');
});

test('deterministic extraction: repeated runs are byte-identical (3.5)', () => {
  withTmpDir((dir) => {
    for (const t of THEMES) {
      const a = runExtract({ themeFile: path.join(FIXTURES, t.theme), outDir: path.join(dir, 'a') }, undefined, formattingRules);
      const b = runExtract({ themeFile: path.join(FIXTURES, t.theme), outDir: path.join(dir, 'b') }, undefined, formattingRules);
      assert.equal(fs.readFileSync(a.paletteFile, 'utf8'), fs.readFileSync(b.paletteFile, 'utf8'), `${t.theme} palette bytes`);
      assert.equal(fs.readFileSync(a.specFile, 'utf8'), fs.readFileSync(b.specFile, 'utf8'), `${t.theme} spec bytes`);
    }
  });
});

test('structural failure: invalid type raises a clear error and writes nothing (3.6a)', () => {
  withTmpDir((dir) => {
    const stub = {
      type: 'gray',
      colors: { 'editor.background': '#ffffff' },
      tokenColors: [],
      semanticTokenColors: {},
    };
    const stubFile = path.join(dir, 'stub.json');
    fs.writeFileSync(stubFile, JSON.stringify(stub));
    const outDir = path.join(dir, 'out');
    assert.throws(
      () => runExtract({ themeFile: stubFile, outDir }, undefined, formattingRules),
      /cannot derive palette: "type" must be "dark" or "light"/
    );
    assert.ok(!fs.existsSync(path.join(outDir, 'stub.palette.json')));
    assert.ok(!fs.existsSync(path.join(outDir, 'stub.spec.json')));
  });
});

test('fallback: rich theme missing only activityBar.inactiveForeground recovers fg-muted byte-for-byte (2.1)', () => {
  const theme = anchorTheme('dark');
  delete theme.colors['activityBar.inactiveForeground'];
  theme.colors['activityBar.foreground'] = '#ebdbb2';
  const canon = canonicalTheme(theme);
  const { palette, spec } = extractTheme(canon, formattingRules);
  assert.equal(palette.base['fg-muted'], '#ebdbb2');
  assert.equal(rebuiltBytes(palette, spec), themeBytes(canon), 'rebuild diverges from input');
});

test('fallback: missing activityBar.inactiveForeground borrows activityBar.foreground (2.2)', () => {
  for (const type of ['dark', 'light']) {
    const theme = anchorTheme(type);
    delete theme.colors['activityBar.inactiveForeground'];
    theme.colors['activityBar.foreground'] = '#ebdbb2';
    const { palette } = extractTheme(theme, formattingRules);
    const slot = type === 'dark' ? 'fg-muted' : 'fg-subtle';
    assert.equal(palette.base[slot], '#ebdbb2', `${type} ${slot}`);
  }
});

test('fallback: missing breadcrumb.foreground borrows foreground (2.3)', () => {
  for (const type of ['dark', 'light']) {
    const theme = anchorTheme(type);
    delete theme.colors['breadcrumb.foreground'];
    theme.colors['foreground'] = '#fafafa';
    const { palette } = extractTheme(theme, formattingRules);
    const slot = type === 'dark' ? 'fg-subtle' : 'fg-muted';
    assert.equal(palette.base[slot], '#fafafa', `${type} ${slot}`);
  }
});

test('fallback: missing editor.selectionHighlightBackground blends a chromatic slot (2.4)', () => {
  const theme = anchorTheme('dark');
  delete theme.colors['editor.selectionHighlightBackground'];
  theme.colors['editor.selectionBackground'] = '#264f78';
  theme.colors['editor.background'] = '#1e1e1e';
  const { palette } = extractTheme(theme, formattingRules);
  assert.equal(palette.base.blue, '#1d3b5a', 'the blend of selectionBackground over background lands on blue');
  assert.equal(palette.base.cyan, '#79b8ff', 'the anchor bracket blue lands on cyan');
});

test('fallback: reference defaults for secondary controls (2.2b)', () => {
  const dark = anchorTheme('dark');
  delete dark.colors['button.secondaryBackground'];
  dark.colors['list.hoverBackground'] = '#3c3836';
  assert.equal(extractTheme(dark, formattingRules).palette.base['border-muted'], '#3c3836');

  const light = anchorTheme('light');
  delete light.colors['button.secondaryHoverBackground'];
  light.colors['list.hoverBackground'] = '#3c3836';
  assert.equal(extractTheme(light, formattingRules).palette.base['border-muted'], '#484341');

  const light2 = anchorTheme('light');
  delete light2.colors['editorGutter.deletedBackground'];
  assert.ok(Object.values(extractTheme(light2, formattingRules).palette.base).includes('#f97583'), 'chain fallback color present');
});

test('fallback: missing editorBracketHighlight.foreground1 derives blue from the registered literal (2.2)', () => {
  withTmpDir((dir) => {
    const theme = anchorTheme('dark');
    delete theme.colors['editorBracketHighlight.foreground1'];
    const canon = canonicalTheme(theme);
    const themeFile = path.join(dir, 'literal.json');
    fs.writeFileSync(themeFile, JSON.stringify(canon, null, '\t') + '\n');
    const { palette } = extractTheme(canon, formattingRules);
    assert.equal(palette.base.yellow, '#ffd700', 'registered literal gold lands on yellow');
    const outDir = path.join(dir, 'out');
    const { paletteFile, specFile } = runExtract({ themeFile, outDir }, undefined, formattingRules);
    assert.ok(fs.existsSync(paletteFile), 'literal.palette.json written');
    assert.ok(fs.existsSync(specFile), 'literal.spec.json written');
  });
});

test('fallback: missing secondaryBackground and list.hoverBackground resolves border-muted through the chain to a literal (2.3)', () => {
  withTmpDir((dir) => {
    const theme = anchorTheme('dark');
    delete theme.colors['button.secondaryBackground'];
    delete theme.colors['list.hoverBackground'];
    const canon = canonicalTheme(theme);
    const themeFile = path.join(dir, 'absent.json');
    fs.writeFileSync(themeFile, JSON.stringify(canon, null, '\t') + '\n');
    const { palette } = extractTheme(canon, formattingRules);
    assert.equal(palette.base['border-muted'], '#2a2d2e');
    const outDir = path.join(dir, 'out');
    const { paletteFile, specFile } = runExtract({ themeFile, outDir }, undefined, formattingRules);
    assert.ok(fs.existsSync(paletteFile), 'absent.palette.json written');
    assert.ok(fs.existsSync(specFile), 'absent.spec.json written');
  });
});

test('fallback: correia-gruvbox extracts end-to-end with gruvbox palette and byte-exact rebuild (2.1)', () => {
  withTmpDir((dir) => {
    const themeFile = path.join(FIXTURES, 'themes/correia-gruvbox.json');
    const themeText = fs.readFileSync(themeFile, 'utf8');
    const theme = parseJsonc(themeText);

    const { palette, spec } = extractTheme(theme, formattingRules);
    assert.equal(palette.base.fg, '#ebdbb2');
    assert.equal(palette.base.bg, '#1d2021');
    assert.equal(palette.base.border, '#3c3836');
    assert.equal(palette.base.blue, '#179fff');
    assert.equal(palette.base.purple, '#da70d6');
    assert.equal(palette.base.yellow, '#ffd700');
    assert.equal(palette.base.orange, '#e78a4e');
    assert.equal(palette.base.green, '#d79921');
    assert.equal(palette.rust.string, '#fabd2f', 'correia-gruvbox recovers the semantic string color from the cyan slot');
    assert.equal(palette.rust.macro, '#da70d6');

    const outDir = path.join(dir, 'out');
    const { paletteFile, specFile } = runExtract({ themeFile, outDir }, undefined, formattingRules);
    assert.ok(fs.existsSync(paletteFile), 'correia-gruvbox.palette.json written');
    assert.ok(fs.existsSync(specFile), 'correia-gruvbox.spec.json written');

    const written = JSON.parse(fs.readFileSync(paletteFile, 'utf8'));
    assert.deepEqual(written.type, palette.type, 'written palette type matches the derived palette');
    assert.deepEqual(written.base, palette.base, 'written palette base matches the derived palette');
    assert.deepEqual(written.rust, suggest('rust', palette), 'written palette rust holds the suggested colors');

    const rebuilt = JSON.stringify(buildTheme(palette, spec), null, '\t') + '\n';
    assert.equal(rebuilt, stripComments(themeText), 'rebuilt theme diverges from input');
  });
});

test('solarized themes extract end-to-end with canonical-form rebuild (2.1)', () => {
  const cases = [
    {
      themeFile: 'themes/solarized-dark-color-theme.json',
      expected: { border: '#003847', bg: '#002b36', fg: '#839496' },
    },
    {
      themeFile: 'themes/solarized-light-color-theme.json',
      expected: { border: '#ddd6c1', bg: '#fdf6e3', fg: '#657b83' },
    },
  ];
  withTmpDir((dir) => {
    for (const c of cases) {
      const themeFile = path.join(FIXTURES, c.themeFile);
      const themeText = fs.readFileSync(themeFile, 'utf8');
      const theme = parseJsonc(themeText);

      const { palette, spec } = extractTheme(theme, formattingRules);
      assert.equal(palette.base.border, c.expected.border, `${c.themeFile} border`);
      assert.equal(palette.base.bg, c.expected.bg, `${c.themeFile} bg`);
      assert.equal(palette.base.fg, c.expected.fg, `${c.themeFile} fg`);

      const outDir = path.join(dir, path.basename(c.themeFile, '.json'));
      const { paletteFile, specFile } = runExtract({ themeFile, outDir }, undefined, formattingRules);
      assert.ok(fs.existsSync(paletteFile), `${c.themeFile} palette written`);
      assert.ok(fs.existsSync(specFile), `${c.themeFile} spec written`);

      const written = JSON.parse(fs.readFileSync(paletteFile, 'utf8'));
      assert.deepEqual(written.type, palette.type, `${c.themeFile} written palette type`);
      assert.deepEqual(written.base, palette.base, `${c.themeFile} written palette base`);
      assert.ok(!('string' in palette.rust), `${c.themeFile} derived palette omits rust.string`);
      assert.ok(!('string' in written.rust), `${c.themeFile} generated palette omits rust.string`);
      assert.deepEqual(
        Object.keys(written.rust).sort(),
        ['const', 'consuming', 'docComment', 'macro', 'method'],
        `${c.themeFile} generated palette still carries the other five rust slots`
      );

      const rebuilt = JSON.stringify(buildTheme(palette, spec), null, '\t') + '\n';
      const expected = JSON.stringify(canonicalTheme(theme), null, '\t') + '\n';
      assert.equal(rebuilt, expected, `${c.themeFile} rebuild diverges from the canonical form`);
    }
  });
});

test('chromatic reassignment: correia chromatic slots are named by closest color, neutrals unchanged (2.1)', () => {
  const theme = parseJsonc(fs.readFileSync(path.join(FIXTURES, 'themes/correia-gruvbox.json'), 'utf8'));
  const { palette } = extractTheme(theme, formattingRules);

  assert.equal(palette.base.blue, '#179fff');
  assert.equal(palette.base.purple, '#da70d6');
  assert.equal(palette.base.yellow, '#ffd700');
  assert.equal(palette.base.orange, '#e78a4e');
  assert.equal(palette.base.green, '#d79921');
  assert.equal(palette.base.cyan, '#fabd2f');
  assert.equal(palette.base.red, '#f44747');
  assert.equal(palette.base.pink, '#cc241d');

  assert.equal(palette.base.bg, '#1d2021');
  assert.equal(palette.base['bg-soft'], '#1d2021');
  assert.equal(palette.base['bg-muted'], '#1d2021');
  assert.equal(palette.base.fg, '#ebdbb2');
  assert.equal(palette.base['fg-muted'], '#ebdbb2');
  assert.equal(palette.base['fg-subtle'], '#ebdbb2');
  assert.equal(palette.base.border, '#3c3836');
  assert.equal(palette.base['border-muted'], '#3c3836');
});

test('byte-exact rebuild: reassigned correia extraction still reproduces the input theme (2.2)', () => {
  withTmpDir((dir) => {
    const themeFile = path.join(FIXTURES, 'themes/correia-gruvbox.json');
    const themeText = fs.readFileSync(themeFile, 'utf8');
    const { palette, spec } = extractTheme(parseJsonc(themeText), formattingRules);
    assert.doesNotThrow(
      () => verifyRebuild(themeText, palette, spec, themeFile, undefined, formattingRules),
      'rebuilt theme must match input byte-for-byte after chromatic reassignment'
    );
  });
});

test('chromatic identity: github palettes keep their chromatic slot colors (2.3)', () => {
  for (const t of THEMES) {
    const { palette } = extractTheme(readTheme(t), formattingRules);
    const committed = committedPalette(t).base;
    for (const slot of ['blue', 'green', 'red', 'orange', 'yellow', 'purple', 'pink', 'cyan']) {
      assert.equal(palette.base[slot], committed[slot], `${t.theme} ${slot}`);
    }
  }
});

test('deterministic reassignment: duplicate colors do not flip between runs (2.4)', () => {
  const theme = parseJsonc(fs.readFileSync(path.join(FIXTURES, 'themes/correia-gruvbox.json'), 'utf8'));
  const a = extractTheme(theme, formattingRules);
  const b = extractTheme(theme, formattingRules);
  assert.equal(JSON.stringify(a.palette), JSON.stringify(b.palette), 'palette bytes differ between runs');
  assert.equal(JSON.stringify(a.spec), JSON.stringify(b.spec), 'spec bytes differ between runs');
});

test('scope splitting: comma-joined and array token scopes index individually (2.6)', () => {
  const theme = anchorTheme('dark');
  theme.tokenColors = [
    { scope: 'storage, modifier, keyword.var, entity.name.tag', settings: { foreground: '#85e89d' } },
    { scope: ['invalid.broken', 'invalid.illegal'], settings: { foreground: '#fdaeb7' } },
  ];
  const { palette } = extractTheme(theme, formattingRules);
  assert.equal(palette.base.green, '#85e89d');
  assert.equal(palette.base.pink, '#fdaeb7');
});

test('probe: empty semanticTokenColors recovers non-string rust slots from token scopes and falls back to editor.foreground; string is never recovered (2.7)', () => {
  const withScopes = anchorTheme('dark');
  withScopes.semanticTokenColors = {};
  withScopes.tokenColors = [
    { scope: 'string', settings: { foreground: '#d8a657' } },
    { scope: 'comment', settings: { foreground: '#928374' } },
    { scope: 'support.function', settings: { foreground: '#a9b665' } },
  ];
  const probed = extractTheme(withScopes, formattingRules);
  assert.ok(!('string' in probed.palette.rust), 'rust.string is not recovered from a TextMate string scope');
  assert.equal(probed.palette.rust.docComment, '#928374');
  assert.equal(probed.palette.rust.method, '#a9b665');

  const noScopes = anchorTheme('dark');
  noScopes.semanticTokenColors = {};
  noScopes.tokenColors = [];
  const fallenBack = extractTheme(noScopes, formattingRules);
  assert.ok(!('string' in fallenBack.palette.rust), 'rust.string has no editor.foreground fallback');
  for (const slot of ['docComment', 'macro', 'consuming', 'const', 'method']) {
    assert.equal(fallenBack.palette.rust[slot], '#e1e4e8', `rust.${slot} falls back to editor.foreground`);
  }
});

test('committed fixtures recover unchanged (2.6)', () => {
  for (const t of THEMES) {
    const { palette, spec } = extractTheme(readTheme(t), formattingRules);
    const committed = committedPalette(t);
    assert.deepEqual(palette.base, committed.base, `${t.theme} base`);
    assert.deepEqual(palette.rust, committed.rust, `${t.theme} rust`);
    assert.deepEqual(spec, committedSpec(t), `${t.theme} spec`);
  }
});

test('verification failure notifies the user and writes no outputs (3.6b)', () => {
  withTmpDir((dir) => {
    const themeFile = path.join(FIXTURES, THEMES[0].theme);
    const themeText = fs.readFileSync(themeFile, 'utf8');
    const { palette, spec } = extractTheme(parseJsonc(themeText), formattingRules);
    const broken = (p, s) => {
      const theme = buildTheme(p, s);
      theme.colors['editor.background'] = '#000000';
      return theme;
    };
    assert.throws(() => verifyRebuild(themeText, palette, spec, themeFile, broken, formattingRules), /verification failed/);
    const outDir = path.join(dir, 'out');
    assert.throws(() => runExtract({ themeFile, outDir }, broken, formattingRules), /verification failed/);
    assert.ok(!fs.existsSync(path.join(outDir, 'github-dark.palette.json')));
    assert.ok(!fs.existsSync(path.join(outDir, 'github-dark.spec.json')));
  });
});

test('CLI: single theme argument writes the expected palette and spec paths (3.7)', () => {
  withTmpDir((dir) => {
    const themeFile = path.join(FIXTURES, THEMES[0].theme);
    const res = spawnSync(
      process.execPath,
      [path.join(ROOT, 'lib', 'extract-spec.js'), themeFile, '--config', path.join(FIXTURES, 'generator.json')],
      { cwd: dir, encoding: 'utf8' }
    );
    assert.equal(res.status, 0, `CLI failed: ${res.stderr}`);
    const paletteFile = path.join(dir, 'palettes', 'github-dark.json');
    const specFile = path.join(dir, 'spec', 'github-dark.json');
    assert.ok(fs.existsSync(paletteFile), 'palettes/github-dark.json written');
    assert.ok(fs.existsSync(specFile), 'spec/github-dark.json written');
    assert.deepEqual(
      JSON.parse(fs.readFileSync(paletteFile, 'utf8')),
      { ...committedPalette(THEMES[0]), rust: suggest('rust', committedPalette(THEMES[0])) },
      'CLI palette matches the committed base with the suggested rust section'
    );
    assert.deepEqual(
      JSON.parse(fs.readFileSync(specFile, 'utf8')),
      committedSpec(THEMES[0]),
      'CLI spec matches committed spec'
    );
  });
});

test('regression: existing snapshot and color suites still cover their files (3.8)', () => {
  for (const f of ['test/snapshot.test.js', 'test/color.test.js']) {
    assert.ok(fs.existsSync(path.join(ROOT, f)), `${f} present`);
  }
});

test('rust palette seeds standard tokens for a spec without semanticTokenColors (5.2)', () => {
  const palette = loadPalette(path.join(FIXTURES, 'palettes/correia-gruvbox.json'));
  const spec = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'spec/correia-gruvbox.json'), 'utf8'));
  delete spec.semanticTokenColors;

  const theme = applyRustRules(buildTheme(palette, spec), palette, formattingRules);
  const stc = theme.semanticTokenColors;
  assert.deepEqual(stc.macro, { underline: true, foreground: '#da70d6' });
  assert.deepEqual(stc.const, { foreground: '#ffd700', italic: true });
  assert.deepEqual(stc['variable.consuming'], { foreground: '#f44747', bold: true });
  assert.equal(stc.string, '#d79921');
  assert.equal(stc.method, '#179fff');
});

test('rust layer never overrides spec-defined colors, and formatting applies without a rust palette (5.2)', () => {
  const palette = loadPalette(path.join(FIXTURES, 'palettes/github-dark.json'));
  const spec = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'spec/github-dark.json'), 'utf8'));
  const baseTheme = buildTheme(palette, spec);
  const specColors = { ...baseTheme.semanticTokenColors };

  const noRustPalette = { type: palette.type, base: palette.base };
  const theme = applyRustRules(baseTheme, noRustPalette, formattingRules);
  const stc = theme.semanticTokenColors;

  assert.deepEqual(stc.macro, { underline: true, foreground: specColors.macro.foreground });
  assert.deepEqual(stc.const, { foreground: specColors.const.foreground, italic: true });
  assert.deepEqual(stc['variable.consuming'], { foreground: specColors['variable.consuming'].foreground, bold: true });
  assert.deepEqual(stc.struct, { bold: true });
  assert.deepEqual(stc['*.reference'], { italic: true });
  assert.deepEqual(stc['variable.mutable'], { underline: true });
  assert.equal(stc.string, specColors.string, 'plain-string entries keep the spec color');
  assert.equal(stc.method, specColors.method, 'plain-string entries keep the spec color');

  for (const key of Object.keys(specColors)) {
    const expected = typeof specColors[key] === 'string' ? specColors[key] : specColors[key].foreground;
    const actual = typeof stc[key] === 'string' ? stc[key] : stc[key].foreground;
    assert.equal(actual, expected, `seeded or overridden color for ${key}`);
  }
});
