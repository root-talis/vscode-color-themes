const { parseHex, formatHex, rgb2lab, lab2rgb, applyDelta, validateDelta, normalizeHex } = require('./color.js');

class MissingSlotError extends Error {}

function parseExpression(expression) {
  if (typeof expression !== 'string') {
    throw new Error(`expression must be a string, got ${JSON.stringify(expression)}`);
  }
  const expr = expression.trim();

  if (expr.startsWith('#')) {
    return { kind: 'literal', hex: normalizeHex(expr) };
  }

  let token = expr;
  let alpha;
  const at = expr.indexOf('@');
  if (at !== -1) {
    token = expr.slice(0, at);
    alpha = expr.slice(at + 1);
    if (!/^[0-9a-fA-F]{2}$/.test(alpha)) {
      throw new Error(`invalid alpha byte in expression ${expression}`);
    }
    alpha = parseInt(alpha, 16);
  }

  return { kind: 'ref', token, alpha };
}

function resolveColor(expression, { slots, derived }) {
  const parsed = parseExpression(expression);

  if (parsed.kind === 'literal') {
    return parsed.hex;
  }

  const { token, alpha } = parsed;
  let hex;

  if (derived.has(token)) {
    const { ref, d } = derived.get(token);
    const base = slots.get(ref);
    if (!base) {
      throw new MissingSlotError(`derived token ${token} references unknown slot ${ref}`);
    }
    validateDelta(d);
    hex = applyDelta(base, d);
  } else if (slots.has(token)) {
    hex = slots.get(token);
  } else {
    throw new MissingSlotError(`unknown color expression ${expression}`);
  }

  if (alpha === undefined) return hex;

  const { r, g, b } = parseHex(hex);
  return formatHex(r, g, b, alpha);
}

function labOf(hex) {
  const { r, g, b } = parseHex(hex);
  return rgb2lab(r, g, b);
}

module.exports = { parseExpression, resolveColor, labOf, MissingSlotError };
