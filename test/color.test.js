const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  parseHex,
  formatHex,
  rgb2lab,
  lab2rgb,
  labDelta,
  applyDelta,
  withAlpha,
  normalizeHex,
} = require('../lib/color.js');

const ROOT = path.join(__dirname, '..');

test('parseHex: 6-digit hex', () => {
  assert.deepEqual(parseHex('#0366d6'), { r: 3, g: 102, b: 214, a: 255 });
});

test('parseHex: 8-digit hex extracts alpha byte', () => {
  assert.deepEqual(parseHex('#0366d633'), { r: 3, g: 102, b: 214, a: 0x33 });
});

test('parseHex: 3-digit shorthand is expanded', () => {
  assert.deepEqual(parseHex('#c00'), { r: 0xcc, g: 0, b: 0, a: 255 });
});

test('parseHex: rejects invalid hex', () => {
  assert.throws(() => parseHex('#12345'));
  assert.throws(() => parseHex('#ggg'));
  assert.throws(() => parseHex('0366d6'));
  assert.throws(() => parseHex('#0366d6zz'));
});

test('formatHex: lowercase 6-digit output', () => {
  assert.equal(formatHex(3, 102, 214), '#0366d6');
  assert.equal(formatHex(121, 184, 255), '#79b8ff');
});

test('formatHex: 8-digit output when alpha given', () => {
  assert.equal(formatHex(3, 102, 214, 0x44), '#0366d644');
  assert.equal(formatHex(23, 229, 230, 0), '#17e5e600');
});

test('formatHex: 6-digit output when alpha is 255', () => {
  assert.equal(formatHex(3, 102, 214, 255), '#0366d6');
});

test('parseHex/formatHex round-trip', () => {
  for (const hex of ['#000000', '#24292e', '#79b8ff', '#0366d633', '#17e5e600']) {
    const { r, g, b, a } = parseHex(hex);
    assert.equal(formatHex(r, g, b, a), hex);
  }
});

test('rgb2lab/lab2rgb solve OKLab (Ottosson matrices) on known colors', () => {
  const known = [
    [0, 0, 0, [0, 0, 0]],
    [255, 255, 255, [1, 0, 0]],
    [3, 102, 214, [0.52991582, -0.04132507, -0.18503176]],
    [121, 184, 255, [0.76852172, -0.03684141, -0.11571411]],
    [36, 41, 46, [0.27805795, -0.00433141, -0.01085525]],
  ];
  for (const [r, g, b, expected] of known) {
    const [L, a, bb] = rgb2lab(r, g, b);
    const actual = [L, a, bb].map((x) => Number(x.toFixed(7)));
    for (let i = 0; i < 3; i++) {
      assert.ok(Math.abs(actual[i] - expected[i]) <= 1e-7, `OKLab component ${i} of ${formatHex(r, g, b)}`);
    }
    assert.deepEqual(lab2rgb(L, a, bb), [r, g, b]);
  }
});

test('rgb2lab/lab2rgb round-trip exact on random values', () => {
  for (let i = 0; i < 500; i++) {
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);
    const [L, a, bb] = rgb2lab(r, g, b);
    assert.deepEqual(lab2rgb(L, a, bb), [r, g, b], `round-trip failed for ${formatHex(r, g, b)}`);
  }
});

test('rgb2lab/lab2rgb round-trip exact across every committed palette and theme color', () => {
  const hexes = new Set();
  const collect = (value) => {
    if (typeof value === 'string') {
      if (/^#[0-9a-f]{6}$/.test(value)) hexes.add(value);
    } else if (Array.isArray(value)) {
      value.forEach(collect);
    } else if (value && typeof value === 'object') {
      Object.values(value).forEach(collect);
    }
  };
  for (const file of fs.readdirSync(path.join(ROOT, 'palettes'))) {
    collect(JSON.parse(fs.readFileSync(path.join(ROOT, 'palettes', file), 'utf8')));
  }
  for (const file of fs.readdirSync(path.join(ROOT, 'themes'))) {
    collect(JSON.parse(fs.readFileSync(path.join(ROOT, 'themes', file), 'utf8')));
  }
  assert.ok(hexes.size > 0, 'corpus is non-empty');
  for (const hex of hexes) {
    const { r, g, b } = parseHex(hex);
    const [L, a, bb] = rgb2lab(r, g, b);
    assert.deepEqual(lab2rgb(L, a, bb), [r, g, b], `round-trip failed for ${hex}`);
  }
});

test('rgb2lab/lab2rgb round-trip exact on random values', () => {
  for (let i = 0; i < 500; i++) {
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);
    const [L, a, bb] = rgb2lab(r, g, b);
    assert.deepEqual(lab2rgb(L, a, bb), [r, g, b], `round-trip failed for ${formatHex(r, g, b)}`);
  }
});

test('base + delta reproduces known GitHub pairs', () => {
  assert.equal(applyDelta('#0366d6', labDelta('#0366d6', '#79b8ff')), '#79b8ff');
  assert.equal(applyDelta('#24292e', labDelta('#24292e', '#39414a')), '#39414a');
  assert.equal(applyDelta('#79b8ff', labDelta('#79b8ff', '#2188ff')), '#2188ff');
});

test('applyDelta: out-of-range deltas are rejected', () => {
  assert.throws(() => applyDelta('#0366d6', [NaN, 0, 0]));
  assert.throws(() => applyDelta('#0366d6', [0, 0]));
  assert.throws(() => applyDelta('#0366d6', [1e9, 0, 0]));
  assert.throws(() => applyDelta('#0366d6', ['a', 0, 0]));
});

test('applyDelta: OKLab boundary deltas are accepted, out-of-range rejected', () => {
  for (const delta of [[-1, 0, 0], [1, 0, 0], [0, 0.4, 0], [0, -0.4, 0], [0, 0, 0.4], [0, 0, -0.4]]) {
    assert.doesNotThrow(() => applyDelta('#0366d6', delta), `boundary delta ${delta} accepted`);
  }
  for (const delta of [[1.01, 0, 0], [-1.01, 0, 0], [0, 0.41, 0], [0, -0.41, 0], [0, 0, 0.41], [0, 0, -0.41]]) {
    assert.throws(() => applyDelta('#0366d6', delta), `out-of-range delta ${delta} rejected`);
  }
});

test('withAlpha produces 8-digit hex', () => {
  assert.equal(withAlpha('#0366d6', 0x44), '#0366d644');
  assert.equal(withAlpha('#0366d6', 0), '#0366d600');
});

test('normalizeHex lowercases and expands shorthand', () => {
  assert.equal(normalizeHex('#6A737D'), '#6a737d');
  assert.equal(normalizeHex('#C00'), '#cc0000');
  assert.equal(normalizeHex('#17E5E633'), '#17e5e633');
});
