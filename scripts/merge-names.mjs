#!/usr/bin/env node
/**
 * Merge per-language name shards (data/sources/names/*.json) into one global
 * proper-noun stoplist src/public/data/names.json (sorted unique array).
 */

import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'data', 'sources', 'names');

async function main() {
  const set = new Set();
  for (const f of (await readdir(SRC)).filter((f) => f.endsWith('.json'))) {
    for (const w of JSON.parse(await readFile(join(SRC, f), 'utf8'))) set.add(w);
  }
  const out = [...set].sort();
  await writeFile(join(ROOT, 'src', 'public', 'data', 'names.json'), JSON.stringify(out));
  console.log(`names.json: ${out.length} proper nouns`);
}

await main();
