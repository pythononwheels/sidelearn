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
const OUT = join(ROOT, 'src', 'public', 'data');

/** Frequency list per language (top N ranks). */
const LANGS = ['fr', 'de', 'en', 'nl'];

/** How many top words to bundle per language. Trade-off: size vs coverage. */
const TOP_N = 20_000;

/**
 * Directed dictionary pairs [learn, native]. Only pairs that FreeDict actually
 * publishes are listed; missing pairs fail soft at runtime (band-only hover,
 * LLM-backed "more"). Extend as needed.
 */
const DICT_PAIRS = [
  ['fr', 'de'], ['en', 'de'], ['nl', 'de'],
  ['de', 'en'], ['fr', 'en'], ['nl', 'en'],
];

async function buildFrequency(lang) {
  // TODO: download FrequencyWords list for `lang`, take top TOP_N lines,
  // assign 1-based rank, return { word: rank }.
  console.log(`[freq:${lang}] TODO — FrequencyWords download, top ${TOP_N}`);
  return null;
}

async function buildDictionary(learn, native) {
  // TODO: parse the FreeDict ${learn}-${native} .dict/.index files into
  // { headword: DictSense[] }.
  console.log(`[dict:${learn}-${native}] TODO — FreeDict parsing`);
  return null;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  for (const lang of LANGS) {
    const freq = await buildFrequency(lang);
    if (freq) await writeFile(join(OUT, `freq-${lang}.json`), JSON.stringify(freq));
  }
  for (const [learn, native] of DICT_PAIRS) {
    const dict = await buildDictionary(learn, native);
    if (dict) await writeFile(join(OUT, `dict-${learn}-${native}.json`), JSON.stringify(dict));
  }
  console.log('Done. (Sample files are kept when a source is not yet wired up.)');
}

await main();
