const fs = require('node:fs');
const path = require('node:path');
const { loadPalette } = require('./palette.js');
const { buildTheme } = require('./theme.js');
const { applyRustRules } = require('./rust-rules.js');

const ROOT = path.join(__dirname, '..');

function loadThemes(configFile = path.join(ROOT, 'generator.json')) {
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  const base = path.dirname(configFile);
  return config.themes.map((t) => ({
    name: t.name,
    spec: path.join(base, t.spec),
    palette: path.join(base, t.palette),
  }));
}

function buildOne({ name, spec: specFile, palette: paletteFile }, options = {}) {
  const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
  const palette = loadPalette(paletteFile);
  let theme = buildTheme(palette, spec);
  if (!options.noRustRules) theme = applyRustRules(theme, palette);
  const out = `themes/${name}.json`;
  fs.writeFileSync(out, JSON.stringify(theme, null, '\t') + '\n');
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const options = {};
  let configFile;
  const wanted = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--no-rust-rules') {
      options.noRustRules = true;
    } else if (args[i] === '--config') {
      configFile = args[++i];
    } else {
      wanted.push(args[i]);
    }
  }
  const THEMES = loadThemes(configFile);
  const targets = wanted.length ? THEMES.filter((t) => wanted.includes(t.name)) : THEMES;
  if (!targets.length) {
    console.error(`unknown theme(s): ${wanted.join(', ')} (available: ${THEMES.map((t) => t.name).join(', ')})`);
    process.exit(1);
  }
  for (const t of targets) {
    const out = buildOne(t, options);
    console.log(`wrote ${out}`);
  }
}

if (require.main === module) main();

module.exports = { loadThemes, buildOne };
