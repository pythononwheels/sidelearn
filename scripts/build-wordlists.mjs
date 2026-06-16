#!/usr/bin/env node
/**
 * Generate the bundled frequency + dictionary data from open sources.
 *
 * Sources (see data/README.md for licenses):
 *   - Frequency: hermitdave/FrequencyWords (OpenSubtitles) → rank map
 *   - Dictionary: FreeDict fra-deu / nld-deu → headword → senses map
 *
 * Output: public/data/freq-<lang>.json and public/data/dict-<lang>.json
 *
 * NOTE: this is a documented scaffold. The download/parse steps are marked
 * TODO so the data pipeline is reproducible without committing large blobs.
 * The repo ships small hand-made sample files so the extension runs out of the box.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'data');

const LANGS = ['fr', 'nl'];

async function buildFrequency(lang) {
  // TODO: download FrequencyWords list for `lang`, take top N lines,
  // assign 1-based rank, return { word: rank }.
  console.log(`[freq:${lang}] TODO — wire up FrequencyWords download`);
  return null;
}

async function buildDictionary(lang) {
  // TODO: parse FreeDict ${lang}-deu .dict/.index, return { headword: DictSense[] }.
  console.log(`[dict:${lang}] TODO — wire up FreeDict parsing`);
  return null;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  for (const lang of LANGS) {
    const freq = await buildFrequency(lang);
    if (freq) await writeFile(join(OUT, `freq-${lang}.json`), JSON.stringify(freq));
    const dict = await buildDictionary(lang);
    if (dict) await writeFile(join(OUT, `dict-${lang}.json`), JSON.stringify(dict));
  }
  console.log('Done. (Sample files are kept when a source is not yet wired up.)');
}

await main();
