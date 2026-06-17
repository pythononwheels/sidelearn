#!/usr/bin/env node
/**
 * Collect proper nouns (Wiktextract pos === "name") that appear in any of our
 * frequency lists, so the highlighter can skip names (John, Paris, …) instead of
 * marking them with no translation.
 *
 * Streams stdin (the ~1 GB extract is never saved):
 *   curl -s https://kaikki.org/dictionary/Spanish/...jsonl | node scripts/build-names.mjs es
 *
 * Output: data/sources/names/<lang>.json  (array, merged later by merge-names.mjs)
 */

import { createInterface } from 'node:readline';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'src', 'public', 'data');
const OUT = join(ROOT, 'data', 'sources', 'names');
const norm = (w) => w.toLowerCase().replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');

async function freqUnion() {
  const set = new Set();
  for (const f of (await readdir(DATA)).filter((f) => /^freq-.+\.json$/.test(f))) {
    for (const w of Object.keys(JSON.parse(await readFile(join(DATA, f), 'utf8')))) set.add(w);
  }
  return set;
}

async function main() {
  const lang = process.argv[2];
  if (!lang) throw new Error('usage: build-names.mjs <lang>   (pipe jsonl via stdin)');
  const vocab = await freqUnion();
  const names = new Set();

  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line) continue;
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    if (e.pos !== 'name') continue;
    const w = norm(e.word ?? '');
    if (w.length >= 2 && vocab.has(w)) names.add(w);
  }

  await mkdir(OUT, { recursive: true });
  await writeFile(join(OUT, `${lang}.json`), JSON.stringify([...names]));
  console.log(`names/${lang}.json: ${names.size} proper nouns (in frequency lists)`);
}

await main();
