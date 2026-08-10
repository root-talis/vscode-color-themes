const fs = require('node:fs');
const { normalizeHex } = require('./color.js');

const VALID_HEX = /^#[0-9a-f]{6}$/i;

function validatePalette(data, source) {
  if (data.type !== 'dark' && data.type !== 'light') {
    throw new Error(`${source}: "type" must be "dark" or "light", got ${JSON.stringify(data.type)}`);
  }

  if (!data.base || typeof data.base !== 'object') {
    throw new Error(`${source}: missing "base" section`);
  }
  const baseNames = Object.keys(data.base);
  if (baseNames.length !== 16) {
    throw new Error(`${source}: expected 16 base colors, got ${baseNames.length}`);
  }

  if (!data.rust || typeof data.rust !== 'object' || Object.keys(data.rust).length === 0) {
    throw new Error(`${source}: missing "rust" section`);
  }

  const slots = new Map();
  const checkColor = (name, hex) => {
    if (typeof hex !== 'string' || !VALID_HEX.test(hex)) {
      throw new Error(`${source}: slot ${name} has invalid color ${JSON.stringify(hex)} (expected 6-digit hex)`);
    }
    return normalizeHex(hex);
  };

  const base = {};
  for (const name of baseNames) {
    const hex = checkColor(name, data.base[name]);
    base[name] = hex;
    slots.set(name, hex);
  }

  const rust = {};
  for (const name of Object.keys(data.rust)) {
    const hex = checkColor(`rust.${name}`, data.rust[name]);
    rust[name] = hex;
    slots.set(`rust.${name}`, hex);
  }

  return { type: data.type, base, rust, slots };
}

function loadPalette(file) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`cannot read palette ${file}: ${err.message}`);
  }
  return { ...validatePalette(data, file), file };
}

module.exports = { loadPalette, validatePalette };
