function stripComments(src) {
  const out = [];
  for (const line of src.split('\n')) {
    if (line.trim().startsWith('//')) continue;
    out.push(line);
  }
  return out.join('\n');
}

function fixTrailingCommas(src) {
  return src.replace(/,\s*([}\]])/g, '$1');
}

function parseJsonc(src) {
  return JSON.parse(fixTrailingCommas(stripComments(src)));
}

module.exports = { stripComments, fixTrailingCommas, parseJsonc };
