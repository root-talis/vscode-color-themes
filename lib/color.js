function pyround(x) {
  const f = Math.floor(x);
  const diff = x - f;
  if (diff < 0.5) return f;
  if (diff > 0.5) return f + 1;
  return f % 2 === 0 ? f : f + 1;
}


function lab2rgb(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  let r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  let b2 = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  const f = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * (c ** (1 / 2.4)) - 0.055);
  r = f(r); g = f(g); b2 = f(b2);
  const s2 = (c) => (c > 1 ? 255 : c < 0 ? 0 : pyround(c * 255));
  return [s2(r), s2(g), s2(b2)];
}
function rgb2lab(r, g, b) {
  const f = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const rn = f(r / 255);
  const gn = f(g / 255);
  const bn = f(b / 255);
  const l = 0.4122214708 * rn + 0.5363325363 * gn + 0.0514459929 * bn;
  const m = 0.2119034982 * rn + 0.6806995451 * gn + 0.1073969566 * bn;
  const s = 0.0883024619 * rn + 0.2817188376 * gn + 0.6299787005 * bn;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  return [
    0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
  ];
}

function parseHex(hex) {
  if (typeof hex !== 'string') throw new Error(`invalid hex: ${hex}`);
  let h = hex.trim();
  if (!/^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$|^#[0-9a-fA-F]{8}$/.test(h)) {
    throw new Error(`invalid hex: ${hex}`);
  }
  if (h.length === 4) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  h = h.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
    a: h.length === 8 ? parseInt(h.slice(6, 8), 16) : 255,
  };
}

function formatHex(r, g, b, a) {
  const hex = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
  return a === undefined || a === 255 ? hex : hex + a.toString(16).padStart(2, '0');
}

function normalizeHex(hex) {
  const { r, g, b, a } = parseHex(hex);
  return formatHex(r, g, b, a);
}

function normalizeHexInObject(value) {
  if (typeof value === 'string') {
    return /^#[0-9a-fA-F]+$/.test(value) ? normalizeHex(value) : value;
  }
  if (Array.isArray(value)) return value.map(normalizeHexInObject);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value)) out[key] = normalizeHexInObject(value[key]);
    return out;
  }
  return value;
}

function labDelta(baseHex, targetHex) {
  const base = parseHex(baseHex);
  const target = parseHex(targetHex);
  const blab = rgb2lab(base.r, base.g, base.b);
  const tlab = rgb2lab(target.r, target.g, target.b);
  return [tlab[0] - blab[0], tlab[1] - blab[1], tlab[2] - blab[2]];
}

function validateDelta(delta) {
  if (!Array.isArray(delta) || delta.length !== 3) {
    throw new Error(`invalid delta: ${JSON.stringify(delta)}`);
  }
  for (const v of delta) {
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new Error(`invalid delta component: ${v}`);
    }
  }
  const [L, a, b] = delta;
  if (Math.abs(L) > 1 || Math.abs(a) > 0.4 || Math.abs(b) > 0.4) {
    throw new Error(`delta out of range: ${JSON.stringify(delta)}`);
  }
}

function applyDelta(baseHex, delta) {
  validateDelta(delta);
  const base = parseHex(baseHex);
  const blab = rgb2lab(base.r, base.g, base.b);
  const [r, g, b] = lab2rgb(blab[0] + delta[0], blab[1] + delta[1], blab[2] + delta[2]);
  return formatHex(r, g, b);
}

function withAlpha(hex, a) {
  if (a < 0 || a > 255 || !Number.isInteger(a)) {
    throw new Error(`invalid alpha byte: ${a}`);
  }
  const { r, g, b } = parseHex(hex);
  return formatHex(r, g, b, a);
}

function roundFloat(number, decimalPoints) {
  const decimal = Math.pow(10, decimalPoints);
  return Math.round(number * decimal) / decimal;
}

function rgb2hsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  const l = (min + max) / 2;
  const chroma = max - min;

  if (chroma > 0) {
    s = Math.min(l <= 0.5 ? chroma / (2 * l) : chroma / (2 - 2 * l), 1);
    switch (max) {
      case rn: h = (gn - bn) / chroma + (gn < bn ? 6 : 0); break;
      case gn: h = (bn - rn) / chroma + 2; break;
      default: h = (rn - gn) / chroma + 4; break;
    }
    h *= 60;
    h = Math.round(h);
  }

  return [
    Math.max(0, Math.min(360, h)) | 0,
    roundFloat(Math.max(0, Math.min(1, s)), 3),
    roundFloat(Math.max(0, Math.min(1, l)), 3),
  ];
}

function hue2rgb(p, q, t) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function hsl2rgb(h, s, l) {
  const hn = h / 360;
  let r;
  let g;
  let b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, hn + 1 / 3);
    g = hue2rgb(p, q, hn);
    b = hue2rgb(p, q, hn - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function relativeLuminance(r, g, b) {
  const f = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return roundFloat(0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b), 4);
}

module.exports = {
  parseHex,
  formatHex,
  rgb2lab,
  lab2rgb,
  labDelta,
  applyDelta,
  withAlpha,
  normalizeHex,
  normalizeHexInObject,
  validateDelta,
  rgb2hsl,
  hsl2rgb,
  relativeLuminance,
};
