const { parseHex, formatHex, rgb2lab, lab2rgb, relativeLuminance, normalizeHex } = require('./color.js');
const { validatePalette } = require('./palette.js');

// The 8 color-named base slots form the chromatic families; their base colors
// are the "chromatic centers" the borrow convention derives from. Names match
// derive-palette.js CHROMATIC_SLOTS so the family vocabulary is stable.
const CHROMATIC_FAMILIES = ['blue', 'green', 'red', 'orange', 'yellow', 'purple', 'pink', 'cyan'];

const HUE_TOLERANCE = 30;
const BLUE_HUE = 260;
const MIN_CHROMA = 0.04;
const MIN_LIGHTNESS_DELTA = 0.2;

const registry = new Map();

function register(module) {
  if (!module || typeof module.name !== 'string' || !Array.isArray(module.slots)) {
    throw new Error(`suggest: language module must export { name, slots }, got ${JSON.stringify(module)}`);
  }
  registry.set(module.name, module.slots);
}

function registeredLanguages() {
  return [...registry.keys()].sort();
}

function luminance(hex) {
  const { r, g, b } = parseHex(hex);
  return relativeLuminance(r, g, b);
}

function contrastRatio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return la >= lb ? (la + 0.05) / (lb + 0.05) : (lb + 0.05) / (la + 0.05);
}

function labOf(hex) {
  const { r, g, b } = parseHex(hex);
  return rgb2lab(r, g, b);
}

function hueAngle(hex) {
  const [, a, b] = labOf(hex);
  const h = (Math.atan2(b, a) * 180) / Math.PI;
  return h < 0 ? h + 360 : h;
}

function hueDistance(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function hexAt(L, a, b) {
  const [r, g, bb] = lab2rgb(L, a, b);
  return formatHex(r, g, bb);
}

// Bisect lightness in OKLab (keeping the center's a,b) until contrast against the
// background equals the target, clamping to the sRGB gamut via lab2rgb. Returns
// the center itself when the target equals the center's own contrast.
function solveLightness(centerHex, bgHex, target) {
  const [L, a, b] = labOf(centerHex);
  const centerContrast = contrastRatio(centerHex, bgHex);
  if (Math.abs(target - centerContrast) < 1e-9) return normalizeHex(centerHex);

  const away = target > centerContrast;
  const above = luminance(centerHex) > luminance(bgHex);
  let lo;
  let hi;
  if (away && above) {
    lo = L;
    hi = 100;
  } else if (away) {
    lo = 0;
    hi = L;
  } else if (above) {
    lo = 0;
    hi = L;
  } else {
    lo = L;
    hi = 100;
  }

  const loBelow = contrastRatio(hexAt(lo, a, b), bgHex) - target < 0;
  for (let i = 0; i < 64; i++) {
    const mid = (lo + hi) / 2;
    const below = contrastRatio(hexAt(mid, a, b), bgHex) - target < 0;
    if (below === loBelow) lo = mid;
    else hi = mid;
  }
  return hexAt((lo + hi) / 2, a, b);
}

function familyCenter(base, family) {
  const hex = base[family];
  if (hex === undefined || !CHROMATIC_FAMILIES.includes(family)) {
    throw new Error(`suggest: unknown chromatic family ${JSON.stringify(family)}`);
  }
  return hex;
}

function resolveFixedSlot(slot, palette) {
  const bg = palette.base.bg;
  const center = familyCenter(palette.base, slot.families[0]);
  const target = Math.max(contrastRatio(center, bg) * slot.factor, slot.floor);
  return solveLightness(center, bg, target);
}

// A suggested color is distinguishable from the reference (the regular comment
// color) when it is chromatic enough, or when its lightness is far enough from
// the reference's. Both axes are thresholds in OKLab space; comments are near
// neutral, so a chromatic docComment always separates by hue, while a gray
// docComment needs the lightness gap.
function isDistinct(referenceLab, colorHex) {
  const [L, a, b] = labOf(colorHex);
  return Math.hypot(a, b) >= MIN_CHROMA || Math.abs(L - referenceLab[0]) >= MIN_LIGHTNESS_DELTA;
}

// Among chromatic families no earlier slot claimed, pick the one with the fewest
// unclaimed neighbors within the 30-degree OKLCH hue tolerance, tie-breaking
// toward the blue family at 260 degrees (stable chromatic order breaks any
// remaining tie), then apply the relative-contrast band against that family's
// center. When the slot declares a distinctness reference, walk the candidates
// in that same order and use the first whose suggested color is distinguishable
// from the reference (see isDistinct); if none is, fall back to the first
// candidate.
function resolveLeastCommonHue(slot, slots, palette) {
  const bg = palette.base.bg;
  const claimed = new Set();
  for (const slot of slots) {
    if (slot.families) claimed.add(slot.families[0]);
  }
  const candidates = CHROMATIC_FAMILIES.filter((family) => !claimed.has(family) && palette.base[family] !== undefined);
  if (candidates.length === 0) {
    throw new Error('suggest: no unclaimed chromatic family for the least-common-hue slot');
  }

  const hue = new Map(candidates.map((family) => [family, hueAngle(palette.base[family])]));
  const ordered = [...candidates].sort((a, b) => {
    const neighbors = (family) =>
      candidates.filter((other) => hueDistance(hue.get(other), hue.get(family)) <= HUE_TOLERANCE).length;
    const byNeighbors = neighbors(a) - neighbors(b);
    return byNeighbors !== 0
      ? byNeighbors
      : hueDistance(hue.get(a), BLUE_HUE) - hueDistance(hue.get(b), BLUE_HUE);
  });

  const referenceHex =
    (slot.distinctFrom !== undefined && palette.base[slot.distinctFrom]) || palette.base.fg;
  const referenceLab = referenceHex === undefined ? undefined : labOf(referenceHex);

  const colorFor = (family) => {
    const center = palette.base[family];
    const target = Math.max(contrastRatio(center, bg) * slot.factor, slot.floor);
    return solveLightness(center, bg, target);
  };

  for (const family of ordered) {
    const color = colorFor(family);
    if (referenceLab === undefined || isDistinct(referenceLab, color)) {
      return color;
    }
  }
  return colorFor(ordered[0]);
}

function suggest(language, paletteData) {
  const slots = registry.get(language);
  if (!slots) {
    throw new Error(
      `suggest: unknown language ${JSON.stringify(language)} (registered: ${registeredLanguages().join(', ')})`
    );
  }
  const palette = validatePalette(paletteData, 'suggest palette');

  const activeSlots = slots.filter(
    (slot) => !slot.requirePaletteSlot || palette.rust[slot.name] !== undefined
  );

  const out = {};
  for (const slot of activeSlots) {
    if (slot.strategy === 'least-common-hue') continue;
    if (!slot.families || slot.families.length === 0 || slot.factor === undefined || slot.floor === undefined) {
      throw new Error(`suggest: slot ${JSON.stringify(slot.name)} must define families, factor, and floor`);
    }
    out[slot.name] = resolveFixedSlot(slot, palette);
  }
  for (const slot of activeSlots) {
    if (slot.strategy === 'least-common-hue') {
      out[slot.name] = resolveLeastCommonHue(slot, activeSlots, palette);
    }
  }
  return out;
}

module.exports = { register, suggest, registeredLanguages };
require('./suggest-rust.js');
