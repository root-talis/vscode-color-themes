const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseHex, rgb2lab, relativeLuminance } = require('../lib/color.js');
const { suggest } = require('../lib/suggest.js');
const { extractTheme, runExtract, parseArgs } = require('../lib/extract-spec.js');
const { loadFormattingRules } = require('../lib/rust-rules.js');
const { parseJsonc } = require('../lib/jsonc.js');

const ROOT = path.join(__dirname, '..');
const FIXTURES = path.join(__dirname, 'fixtures');
const formattingRules = loadFormattingRules(path.join(FIXTURES, 'generator.json'));

const SIX_PALETTES = [
  'github-dark.json',
  'github-light.json',
  'tomorrow.json',
  'tomorrow-night.json',
  'gruvbox-dark.json',
  'gruvbox-light.json',
];

const BORROW_PALETTES = ['tomorrow.json', 'tomorrow-night.json', 'gruvbox-dark.json', 'gruvbox-light.json'];

const RUST_SLOTS = ['string', 'macro', 'consuming', 'const', 'method', 'docComment'];
const FIXED_SLOTS = { string: 'green', macro: 'purple', consuming: 'red', const: 'yellow', method: 'blue' };
const TEXT_FLOOR = 3.5;

function committedPalette(name) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'palettes', name), 'utf8'));
}

function withoutRustString(name) {
  const palette = committedPalette(name);
  delete palette.rust.string;
  return palette;
}

// Chromatic base set {blue, green, red, yellow, purple}: every chromatic
// family present in the base is claimed by a fixed slot, so a least-common-hue
// slot has no candidate while rust.string is active.
const FULLY_CLAIMED_BASE = {
  bg: '#111111',
  'bg-soft': '#1a1a1a',
  'bg-muted': '#222222',
  fg: '#eeeeee',
  'fg-muted': '#999999',
  'fg-subtle': '#777777',
  border: '#333333',
  'border-muted': '#444444',
  blue: '#4271ae',
  green: '#718c00',
  red: '#c82829',
  yellow: '#eab700',
  purple: '#8959a8',
  gray: '#8e908c',
  brown: '#7f5f3f',
  teal: '#3e999f',
};

function fullyClaimedPalette(withString) {
  return {
    type: 'dark',
    base: { ...FULLY_CLAIMED_BASE },
    rust: withString ? { string: '#444444', macro: '#555555' } : { macro: '#555555' },
  };
}

function luminance(hex) {
  const { r, g, b } = parseHex(hex);
  return relativeLuminance(r, g, b);
}

function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return la >= lb ? (la + 0.05) / (lb + 0.05) : (lb + 0.05) / (la + 0.05);
}

function hueAngle(hex) {
  const { r, g, b } = parseHex(hex);
  const [, a, bb] = rgb2lab(r, g, b);
  const h = (Math.atan2(bb, a) * 180) / Math.PI;
  return h < 0 ? h + 360 : h;
}

function hueDistance(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function labL(hex) {
  const { r, g, b } = parseHex(hex);
  return rgb2lab(r, g, b)[0];
}

const ALL_PALETTES = [
  'github-dark.json',
  'github-light.json',
  'tomorrow.json',
  'tomorrow-night.json',
  'gruvbox-dark.json',
  'gruvbox-light.json',
  'solarized-dark.json',
  'solarized-light.json',
  'correia-gruvbox.json',
];

test('registry: rust returns all six slots; unregistered language names the registry (4.1)', () => {
  const out = suggest('rust', committedPalette('tomorrow.json'));
  assert.deepEqual(Object.keys(out).sort(), [...RUST_SLOTS].sort());
  for (const slot of RUST_SLOTS) {
    assert.match(out[slot], /^#[0-9a-f]{6}$/, `${slot} is a 6-digit hex`);
  }

  assert.throws(
    () => suggest('go', committedPalette('tomorrow.json')),
    /unknown language "go" \(registered: rust\)/
  );
});

test('palette validation: missing base slot or non-hex color is rejected (4.2)', () => {
  const missing = committedPalette('tomorrow.json');
  delete missing.base.yellow;
  assert.throws(() => suggest('rust', missing), /expected 16 base colors/);

  const nonHex = committedPalette('tomorrow.json');
  nonHex.base.red = 'tomato';
  assert.throws(() => suggest('rust', nonHex), /invalid color/);
});

test('borrow identity: fixed slots equal their family center where the floor is met, else rescued to the floor (4.3)', () => {
  for (const name of SIX_PALETTES) {
    const palette = committedPalette(name);
    const out = suggest('rust', palette);
    for (const [slot, family] of Object.entries(FIXED_SLOTS)) {
      const center = palette.base[family];
      const centerContrast = contrast(center, palette.base.bg);
      if (centerContrast >= TEXT_FLOOR) {
        assert.equal(out[slot], center, `${name} ${slot} borrows the ${family} center ${center}`);
      } else {
        assert.ok(
          Math.abs(contrast(out[slot], palette.base.bg) - TEXT_FLOOR) < 0.05,
          `${name} ${slot} is rescued to the ${TEXT_FLOOR}:1 floor`
        );
        // Solving lightness in OKLab pushes some centers out of the sRGB gamut;
        // the clamp can drift the resulting hue up to ~7 degrees.
        assert.ok(
          hueDistance(hueAngle(out[slot]), hueAngle(center)) < 9,
          `${name} ${slot} keeps the ${family} hue`
        );
      }
    }
  }
});

test('borrow identity reproduces committed fixed-slot colors wherever the floor is met (4.3)', () => {
  for (const name of BORROW_PALETTES) {
    const palette = committedPalette(name);
    const out = suggest('rust', palette);
    for (const [slot, family] of Object.entries(FIXED_SLOTS)) {
      if (contrast(palette.base[family], palette.base.bg) >= TEXT_FLOOR) {
        assert.equal(out[slot], palette.rust[slot], `${name} ${slot} matches the committed color`);
      }
    }
  }
});

test('floor rescue: github-light const is suggested at the 3.5 floor keeping the yellow hue (4.4)', () => {
  const palette = committedPalette('github-light.json');
  const suggested = suggest('rust', palette).const;
  assert.equal(suggested, '#b08200');
  assert.ok(Math.abs(contrast(suggested, palette.base.bg) - TEXT_FLOOR) < 0.05, 'contrast lands on the 3.5:1 floor');
  assert.ok(hueDistance(hueAngle(suggested), hueAngle(palette.base.yellow)) < 9, 'keeps the yellow hue');
});

test('least-common-hue: docComment resolves to the cyan family and is stable (4.5)', () => {
  for (const name of SIX_PALETTES) {
    const palette = committedPalette(name);
    const out = suggest('rust', palette);
    assert.ok(
      hueDistance(hueAngle(out.docComment), hueAngle(palette.base.cyan)) < 2.5,
      `${name} docComment sits on the cyan hue ray`
    );
    const again = suggest('rust', palette);
    assert.equal(JSON.stringify(again), JSON.stringify(out), `${name} suggestion set is stable across calls`);
  }
});

test('deterministic: the same palette suggests byte-identical sets on every call (4.6)', () => {
  for (const name of SIX_PALETTES) {
    const palette = committedPalette(name);
    const a = suggest('rust', palette);
    const b = suggest('rust', palette);
    assert.equal(JSON.stringify(a), JSON.stringify(b), `${name} sets differ between calls`);
  }
});

test('distinctness guard: chromatic palettes keep their committed docComment (4.5)', () => {
  const names = ALL_PALETTES.filter((name) => name !== 'solarized-light.json');
  for (const name of names) {
    const palette = committedPalette(name);
    const out = suggest('rust', palette);
    assert.equal(out.docComment, palette.rust.docComment, `${name} docComment stays byte-identical to the committed color`);
  }
});

test('distinctness guard: solarized-dark passes by lightness, docComment unchanged (4.5)', () => {
  const palette = committedPalette('solarized-dark.json');
  const out = suggest('rust', palette);
  assert.equal(out.docComment, '#cb2d7b', 'the committed docComment is kept');
  assert.ok(
    Math.abs(labL(out.docComment) - labL(palette.base['fg-muted'])) >= 0.2,
    'its OKLab lightness differs from the comment color by at least the minimum'
  );
});

test('distinctness guard: solarized-light docComment lands on the least-common green family (4.5)', () => {
  const palette = committedPalette('solarized-light.json');
  const out = suggest('rust', palette);
  assert.equal(out.docComment, '#42a341');
  assert.ok(
    hueDistance(hueAngle(out.docComment), hueAngle(palette.base.green)) < 2.5,
    'docComment sits on the green hue ray'
  );
});

test('distinctness guard: when every candidate fails, the first in selection order wins (4.5)', () => {
  const palette = committedPalette('tomorrow.json');
  palette.base['fg-muted'] = '#888888';
  palette.base.orange = '#8a8a8a';
  palette.base.pink = '#8b8b8b';
  palette.base.cyan = '#8c8c8c';
  const out = suggest('rust', palette);
  assert.equal(out.docComment, '#959594', 'docComment resolves from the first candidate instead of throwing');
});

test('distinctness guard: a palette without the reference skips the guard (4.5)', () => {
  const palette = committedPalette('tomorrow.json');
  delete palette.base['fg-muted'];
  delete palette.base.fg;
  palette.base.gray = '#8e908c';
  palette.base.brown = '#7f5f3f';
  const out = suggest('rust', palette);
  assert.equal(out.docComment, '#47a2a8', 'docComment stays on the first-choice cyan family');
});

test('distinctness guard: solarized-light suggestions are stable across calls (4.6)', () => {
  const palette = committedPalette('solarized-light.json');
  const a = suggest('rust', palette);
  const b = suggest('rust', palette);
  assert.equal(JSON.stringify(a), JSON.stringify(b), 'sets differ between calls');
  assert.equal(a.docComment, '#42a341');
});

test('rust.string is omitted when the palette lacks it; committed palettes keep all six (2.1)', () => {
  for (const name of SIX_PALETTES) {
    const full = suggest('rust', committedPalette(name));
    assert.deepEqual(Object.keys(full).sort(), [...RUST_SLOTS].sort(), `${name} keeps all six slots`);

    const out = suggest('rust', withoutRustString(name));
    assert.deepEqual(
      Object.keys(out).sort(),
      ['const', 'consuming', 'docComment', 'macro', 'method'],
      `${name} omits string when rust.string is absent`
    );
  }
});

test('a skipped string claims no family for the least-common-hue slot (2.2)', () => {
  assert.throws(
    () => suggest('rust', fullyClaimedPalette(true)),
    /no unclaimed chromatic family/,
    'while rust.string is present every candidate family is claimed'
  );

  const palette = fullyClaimedPalette(false);
  const out = suggest('rust', palette);
  assert.ok(!('string' in out), 'string is absent from the suggestion set');
  assert.ok(
    hueDistance(hueAngle(out.docComment), hueAngle(palette.base.green)) < 2.5,
    'docComment sits on the green hue ray once string is gone'
  );
});

test('palettes without rust.string are deterministic across calls (2.3)', () => {
  const palette = withoutRustString('github-dark.json');
  const a = suggest('rust', palette);
  const b = suggest('rust', palette);
  assert.equal(JSON.stringify(a), JSON.stringify(b), 'suggestion sets differ between calls');
});

test('the suggestion flag no longer exists; suggestions always apply (3.1)', () => {
  assert.ok(parseArgs(['--suggest-rust', 'theme.json']).error, '--suggest-rust is rejected as an unexpected argument');
  assert.equal(parseArgs(['theme.json']).error, undefined);
});

test('extraction always seeds the rust section; base and spec output stay unchanged (4.7)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gk-suggest-'));
  try {
    const themeFile = path.join(FIXTURES, 'themes/github-dark-rust.json');
    const theme = parseJsonc(fs.readFileSync(themeFile, 'utf8'));
    const derived = extractTheme(theme, formattingRules);
    const expected = suggest('rust', derived.palette);

    const out = path.join(dir, 'out');
    const { paletteFile, specFile } = runExtract({ themeFile, outDir: out }, undefined, formattingRules);
    const written = JSON.parse(fs.readFileSync(paletteFile, 'utf8'));
    assert.deepEqual(written.rust, expected, 'palette rust section holds the six suggested colors');
    assert.deepEqual(written.type, committedPalette('github-dark.json').type, 'palette type is unchanged');
    assert.deepEqual(written.base, committedPalette('github-dark.json').base, 'palette base is unchanged');
    assert.ok(fs.existsSync(specFile), 'spec file is still written');
    assert.deepEqual(
      JSON.parse(fs.readFileSync(specFile, 'utf8')),
      derived.spec,
      'spec output is unchanged'
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
