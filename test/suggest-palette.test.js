const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { register, registeredLanguages, suggest } = require('../lib/suggest.js');
const { parseArgs, fillPalette, runPaletteSuggestions } = require('../lib/suggest-palette.js');

const ROOT = path.join(__dirname, '..');
const PALETTE = path.join(ROOT, 'palettes', 'tomorrow.json');

register({
  name: 'demo',
  slots: [
    { name: 'demoString', families: ['green', 'yellow'], factor: 1.0, floor: 3.5 },
    { name: 'demoDoc', strategy: 'least-common-hue', factor: 0.75, floor: 3.0 },
  ],
});

function committedPalette() {
  return JSON.parse(fs.readFileSync(PALETTE, 'utf8'));
}

function tmpPalette() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gk-suggest-palette-'));
  const file = path.join(dir, 'palette.json');
  const palette = committedPalette();
  delete palette.rust.docComment;
  fs.writeFileSync(file, JSON.stringify(palette, null, 2) + '\n');
  return { dir, file };
}

test('5.1 parseArgs: a palette file is required', () => {
  assert.ok(parseArgs([]).error, 'no arguments errors');
  assert.ok(parseArgs(['--language', 'rust']).error, 'flags without a palette file error');
  const parsed = parseArgs([PALETTE]);
  assert.equal(parsed.error, null);
  assert.equal(parsed.paletteFile, PALETTE);
  assert.equal(parsed.language, null);
  assert.equal(parsed.conflict, null);
});

test('5.1 parseArgs: the first non-flag argument is the palette file and --language takes a value', () => {
  const parsed = parseArgs(['--language', 'rust', PALETTE]);
  assert.equal(parsed.error, null);
  assert.equal(parsed.paletteFile, PALETTE);
  assert.equal(parsed.language, 'rust');
  assert.ok(parseArgs([PALETTE, '--language']).error, 'a missing flag value errors');
});

test('5.1 parseArgs: conflict flags set conflict and are mutually exclusive', () => {
  assert.equal(parseArgs([PALETTE, '--conflict-skip']).conflict, 'skip');
  assert.equal(parseArgs([PALETTE, '--conflict-overwrite']).conflict, 'overwrite');
  assert.ok(parseArgs([PALETTE, '--conflict-skip', '--conflict-overwrite']).error);
  assert.ok(parseArgs([PALETTE, '--conflict-overwrite', '--conflict-skip']).error);
  assert.ok(parseArgs([PALETTE, '--conflict-skip', '--conflict-skip']).error);
});

test('5.1 parseArgs: unknown flags and extra positional arguments error', () => {
  assert.ok(parseArgs([PALETTE, '--bogus']).error);
  assert.ok(parseArgs([PALETTE, 'other.json']).error);
  assert.ok(parseArgs(['--bogus', PALETTE]).error);
});

test('5.2 fillPalette: absent section is created with the full suggested set, no conflict', async () => {
  const palette = committedPalette();
  let asked = 0;
  const { palette: filled, report } = await fillPalette(palette, ['demo'], async () => {
    asked++;
    return 'merge';
  });
  assert.deepEqual(filled.demo, suggest('demo', palette), 'demo section holds the full suggested set');
  assert.equal(asked, 0, 'absent section does not ask for a conflict decision');
  assert.deepEqual(report, [{ language: 'demo', action: 'filled' }]);
});

test('5.2 fillPalette: merge inserts only missing slots and keeps existing values', async () => {
  const palette = committedPalette();
  const existing = { string: '#111111', macro: '#222222' };
  palette.rust = existing;
  const suggested = suggest('rust', palette);
  const { palette: filled, report } = await fillPalette(palette, ['rust'], () => 'merge');
  assert.equal(filled.rust.string, '#111111');
  assert.equal(filled.rust.macro, '#222222');
  assert.equal(Object.keys(filled.rust).length, 6, 'all six suggested slots present');
  for (const [slot, color] of Object.entries(suggested)) {
    if (slot in existing) continue;
    assert.equal(filled.rust[slot], color, `${slot} uses the suggested color`);
  }
  assert.deepEqual(report, [{ language: 'rust', action: 'merged' }]);
});

test('5.2 fillPalette: overwrite replaces the section with the full suggested set', async () => {
  const palette = committedPalette();
  palette.rust = { string: '#111111' };
  const { palette: filled, report } = await fillPalette(palette, ['rust'], () => 'overwrite');
  assert.deepEqual(filled.rust, suggest('rust', palette));
  assert.deepEqual(report, [{ language: 'rust', action: 'overwritten' }]);
});

test('5.2 fillPalette: skip leaves the section unchanged', async () => {
  const palette = committedPalette();
  const original = { string: '#111111' };
  palette.rust = original;
  const { palette: filled, report } = await fillPalette(palette, ['rust'], () => 'skip');
  assert.deepEqual(filled.rust, original);
  assert.deepEqual(report, [{ language: 'rust', action: 'skipped' }]);
});

test('5.2 fillPalette: a palette section with no registered module is never touched', async () => {
  const palette = committedPalette();
  palette.golang = { weird: '#123456' };
  const { palette: filled } = await fillPalette(palette, ['rust'], () => 'merge');
  assert.deepEqual(filled.golang, { weird: '#123456' });
});

test('2.4 fillPalette: merge into a rust section without string adds the other missing slots and never string', async () => {
  const palette = committedPalette();
  delete palette.rust.string;
  delete palette.rust.docComment;
  const suggested = suggest('rust', palette);
  const { palette: filled, report } = await fillPalette(palette, ['rust'], () => 'merge');
  assert.equal(filled.rust.string, undefined, 'string is never added to a section that lacks it');
  for (const [slot, color] of Object.entries(suggested)) {
    assert.equal(filled.rust[slot], color, `${slot} uses the suggested color`);
  }
  assert.deepEqual(report, [{ language: 'rust', action: 'merged' }]);
});

test('2.5 fillPalette: overwrite of a rust section without string writes a section without string', async () => {
  const palette = committedPalette();
  delete palette.rust.string;
  const { palette: filled, report } = await fillPalette(palette, ['rust'], () => 'overwrite');
  assert.deepEqual(filled.rust, suggest('rust', palette));
  assert.ok(!('string' in filled.rust), 'overwritten section omits string');
  assert.deepEqual(report, [{ language: 'rust', action: 'overwritten' }]);
});

test('5.2 fillPalette: an unregistered language target errors', async () => {
  const palette = committedPalette();
  await assert.rejects(fillPalette(palette, ['python'], () => 'merge'), /unknown language "python"/);
});

test('5.3 runPaletteSuggestions: valid palette is filled in place, 2-space indent, trailing newline, repeatable', async () => {
  const { dir, file } = tmpPalette();
  try {
    const first = await runPaletteSuggestions({
      paletteFile: file,
      language: 'rust',
      prompt: async () => 'merge',
    });
    const written = fs.readFileSync(file, 'utf8');
    assert.ok(written.endsWith('\n'), 'ends with a trailing newline');
    assert.match(written, /\n  "type": "light"/, 'uses 2-space indentation');
    const parsed = JSON.parse(written);
    const suggested = suggest('rust', committedPalette());
    assert.equal(parsed.rust.docComment, suggested.docComment, 'missing slot is added with the suggested color');
    assert.equal(parsed.rust.string, '#718c00', 'existing slots keep their values');
    assert.deepEqual(first, [{ language: 'rust', action: 'merged' }]);

    const second = await runPaletteSuggestions({
      paletteFile: file,
      language: 'rust',
      prompt: async () => 'merge',
    });
    assert.equal(fs.readFileSync(file, 'utf8'), written, 'second run writes byte-identical output');
    assert.deepEqual(second, [{ language: 'rust', action: 'merged' }]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('5.3 runPaletteSuggestions: invalid palette fails with a clear error and leaves the file unchanged', async () => {
  const { dir, file } = tmpPalette();
  try {
    const broken = JSON.parse(fs.readFileSync(file, 'utf8'));
    delete broken.base.cyan;
    const brokenText = JSON.stringify(broken, null, 2) + '\n';
    fs.writeFileSync(file, brokenText);
    await assert.rejects(
      runPaletteSuggestions({ paletteFile: file, language: 'rust', prompt: async () => 'merge' }),
      /expected 16 base colors/
    );
    assert.equal(fs.readFileSync(file, 'utf8'), brokenText, 'file is untouched after failure');

    const nonHex = JSON.parse(brokenText);
    nonHex.base.cyan = '#zzzzzz';
    const nonHexText = JSON.stringify(nonHex, null, 2) + '\n';
    fs.writeFileSync(file, nonHexText);
    await assert.rejects(
      runPaletteSuggestions({ paletteFile: file, language: 'rust', prompt: async () => 'merge' }),
      /invalid color/
    );
    assert.equal(fs.readFileSync(file, 'utf8'), nonHexText, 'file is untouched after failure');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('5.4 injected prompt applies the chosen action per conflicting language', async () => {
  const palette = committedPalette();
  palette.demo = { demoString: '#101010' };
  const asked = [];
  const { palette: filled, report } = await fillPalette(palette, ['demo', 'rust'], async (language) => {
    asked.push(language);
    return language === 'rust' ? 'overwrite' : 'skip';
  });
  assert.deepEqual(asked, ['demo', 'rust'], 'each conflicting language is asked once, in target order');
  assert.deepEqual(filled.demo, { demoString: '#101010' }, 'skip leaves demo untouched');
  assert.deepEqual(filled.rust, suggest('rust', palette), 'overwrite replaces rust');
  assert.deepEqual(report, [
    { language: 'demo', action: 'skipped' },
    { language: 'rust', action: 'overwritten' },
  ]);
});

test('5.4 with no prompt and non-interactive stdin the default is merge', () => {
  const { dir, file } = tmpPalette();
  try {
    const res = spawnSync(process.execPath, ['lib/suggest-palette.js', file, '--language', 'rust'], {
      cwd: ROOT,
      input: '',
      encoding: 'utf8',
    });
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /merged rust/);
    const after = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(after.rust.docComment, suggest('rust', committedPalette()).docComment);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('5.4 --conflict-skip and --conflict-overwrite force their behavior without invoking the prompt', async () => {
  const skipPalette = tmpPalette();
  try {
    let called = 0;
    const report = await runPaletteSuggestions({
      paletteFile: skipPalette.file,
      language: 'rust',
      conflict: 'skip',
      prompt: async () => {
        called++;
        return 'merge';
      },
    });
    assert.equal(called, 0, 'skip flag never prompts');
    assert.equal(JSON.parse(fs.readFileSync(skipPalette.file, 'utf8')).rust.docComment, undefined);
    assert.deepEqual(report, [{ language: 'rust', action: 'skipped' }]);
  } finally {
    fs.rmSync(skipPalette.dir, { recursive: true, force: true });
  }

  const overwritePalette = tmpPalette();
  try {
    let called = 0;
    const report = await runPaletteSuggestions({
      paletteFile: overwritePalette.file,
      language: 'rust',
      conflict: 'overwrite',
      prompt: async () => {
        called++;
        return 'merge';
      },
    });
    assert.equal(called, 0, 'overwrite flag never prompts');
    assert.deepEqual(
      JSON.parse(fs.readFileSync(overwritePalette.file, 'utf8')).rust,
      suggest('rust', committedPalette())
    );
    assert.deepEqual(report, [{ language: 'rust', action: 'overwritten' }]);
  } finally {
    fs.rmSync(overwritePalette.dir, { recursive: true, force: true });
  }
});

test('5.5 CLI end-to-end via spawning the script exercises main()', () => {
  const overwrite = tmpPalette();
  try {
    const res = spawnSync(
      process.execPath,
      ['lib/suggest-palette.js', overwrite.file, '--language', 'rust', '--conflict-overwrite'],
      { cwd: ROOT, encoding: 'utf8' }
    );
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /overwritten rust/);
    assert.deepEqual(
      JSON.parse(fs.readFileSync(overwrite.file, 'utf8')).rust,
      suggest('rust', committedPalette())
    );
  } finally {
    fs.rmSync(overwrite.dir, { recursive: true, force: true });
  }

  const skip = tmpPalette();
  try {
    const res = spawnSync(
      process.execPath,
      ['lib/suggest-palette.js', skip.file, '--language', 'rust', '--conflict-skip'],
      { cwd: ROOT, encoding: 'utf8' }
    );
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /skipped rust/);
    assert.equal(JSON.parse(fs.readFileSync(skip.file, 'utf8')).rust.docComment, undefined);
  } finally {
    fs.rmSync(skip.dir, { recursive: true, force: true });
  }

  const usage = spawnSync(process.execPath, ['lib/suggest-palette.js'], { cwd: ROOT, encoding: 'utf8' });
  assert.notEqual(usage.status, 0);
  assert.match(usage.stderr, /usage: node lib\/suggest-palette\.js/);

  const unregistered = tmpPalette();
  try {
    const res = spawnSync(
      process.execPath,
      ['lib/suggest-palette.js', unregistered.file, '--language', 'python'],
      { cwd: ROOT, encoding: 'utf8' }
    );
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /unknown language "python"/);
    assert.equal(
      JSON.parse(fs.readFileSync(unregistered.file, 'utf8')).rust.docComment,
      undefined,
      'nothing is written on error'
    );
  } finally {
    fs.rmSync(unregistered.dir, { recursive: true, force: true });
  }

  const invalid = tmpPalette();
  try {
    const broken = JSON.parse(fs.readFileSync(invalid.file, 'utf8'));
    delete broken.base.cyan;
    const brokenText = JSON.stringify(broken, null, 2) + '\n';
    fs.writeFileSync(invalid.file, brokenText);
    const res = spawnSync(
      process.execPath,
      ['lib/suggest-palette.js', invalid.file, '--language', 'rust'],
      { cwd: ROOT, encoding: 'utf8' }
    );
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /expected 16 base colors/);
    assert.equal(fs.readFileSync(invalid.file, 'utf8'), brokenText, 'invalid palette leaves the file unchanged');
  } finally {
    fs.rmSync(invalid.dir, { recursive: true, force: true });
  }
});
