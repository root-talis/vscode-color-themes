const fs = require('node:fs');
const readline = require('node:readline');
const { loadPalette } = require('./palette.js');
const { suggest, registeredLanguages } = require('./suggest.js');

function parseArgs(argv) {
  const parsed = { paletteFile: null, language: null, conflict: null, error: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--language') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) {
        return { ...parsed, error: '--language requires a language argument' };
      }
      parsed.language = value;
      i++;
    } else if (arg === '--conflict-skip' || arg === '--conflict-overwrite') {
      if (parsed.conflict !== null) {
        return { ...parsed, error: '--conflict-skip and --conflict-overwrite are mutually exclusive' };
      }
      parsed.conflict = arg === '--conflict-skip' ? 'skip' : 'overwrite';
    } else if (arg.startsWith('--')) {
      return { ...parsed, error: `unexpected argument ${arg}` };
    } else if (parsed.paletteFile === null) {
      parsed.paletteFile = arg;
    } else {
      return { ...parsed, error: `unexpected argument ${arg}` };
    }
  }
  if (parsed.paletteFile === null) {
    return { ...parsed, error: 'a palette file is required' };
  }
  return parsed;
}

async function fillPalette(palette, targets, resolveConflict) {
  const result = { ...palette };
  const report = [];
  for (const language of targets) {
    const suggested = suggest(language, palette);
    const existing = palette[language];
    const hasColors = existing !== null && typeof existing === 'object' && Object.keys(existing).length > 0;
    if (!hasColors) {
      result[language] = { ...suggested };
      report.push({ language, action: 'filled' });
      continue;
    }
    const action = resolveConflict ? await resolveConflict(language) : 'merge';
    if (action === 'skip') {
      report.push({ language, action: 'skipped' });
    } else if (action === 'overwrite') {
      result[language] = { ...suggested };
      report.push({ language, action: 'overwritten' });
    } else {
      const added = {};
      for (const [slot, color] of Object.entries(suggested)) {
        if (!(slot in existing)) added[slot] = color;
      }
      result[language] = { ...existing, ...added };
      report.push({ language, action: 'merged' });
    }
  }
  return { palette: result, report };
}

function askConflict(language) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    const ask = () => {
      rl.question(
        `palette "${language}" section already has colors; skip, overwrite, or merge? [merge] `,
        (answer) => {
          const value = answer.trim().toLowerCase();
          if (value === 'skip' || value === 's') return resolve('skip');
          if (value === 'overwrite' || value === 'o') return resolve('overwrite');
          if (value === 'merge' || value === 'm' || value === '') return resolve('merge');
          console.log(`unrecognized answer "${answer}"; choose skip, overwrite, or merge`);
          ask();
        }
      );
    };
    ask();
  }).finally(() => rl.close());
}

function makeResolveConflict(conflict, prompt) {
  if (conflict !== null && conflict !== undefined) {
    return () => conflict;
  }
  if (prompt !== undefined) {
    return async (language) => prompt(language);
  }
  if (process.stdin.isTTY) {
    return (language) => askConflict(language);
  }
  return () => 'merge';
}

async function runPaletteSuggestions({ paletteFile, language, conflict, prompt }) {
  loadPalette(paletteFile);
  const palette = JSON.parse(fs.readFileSync(paletteFile, 'utf8'));
  const targets = language ? [language] : registeredLanguages();
  const resolveConflict = makeResolveConflict(conflict, prompt);
  const { palette: filled, report } = await fillPalette(palette, targets, resolveConflict);
  fs.writeFileSync(paletteFile, JSON.stringify(filled, null, 2) + '\n');
  return report;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.paletteFile || args.error) {
    console.error(args.error || '');
    console.error(
      'usage: node lib/suggest-palette.js <palette.json> [--language <name>] [--conflict-skip | --conflict-overwrite]'
    );
    process.exitCode = 1;
    return;
  }
  try {
    const report = await runPaletteSuggestions({
      paletteFile: args.paletteFile,
      language: args.language,
      conflict: args.conflict,
    });
    for (const entry of report) {
      console.log(`${entry.action} ${entry.language}`);
    }
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = { parseArgs, fillPalette, runPaletteSuggestions, main };
