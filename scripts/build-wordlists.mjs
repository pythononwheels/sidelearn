#!/usr/bin/env node
/**
 * Generate the bundled frequency + dictionary data from open sources.
 *
 * Sources (see data/README.md for licenses):
 *   - Frequency: hermitdave/FrequencyWords (OpenSubtitles) → { word: rank }
 *   - Dictionary: FreeDict dictd packages → { headword: DictSense[] }
 *
 * Output: src/public/data/freq-<lang>.json and dict-<learn>-<native>.json
 *
 * Size control: dictionaries are filtered to the top DICT_VOCAB frequency words
 * of the learning language, so even large pairs (deu-eng ~20 MB) stay compact.
 * Words beyond that still get an LLM-backed "more" explanation at runtime.
 *
 * Network: downloads to data/sources/ (gitignored). Re-run is incremental —
 * already-downloaded sources are reused.
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src', 'public', 'data');
const SRC = join(ROOT, 'data', 'sources');

const LANGS = ['fr', 'de', 'en', 'nl', 'es', 'it'];
const ISO3 = { fr: 'fra', de: 'deu', en: 'eng', nl: 'nld', es: 'spa', it: 'ita' };

/** Directed dictionary pairs [learn, native]. Missing FreeDict pairs are skipped. */
const DICT_PAIRS = [
  ['fr', 'de'], ['en', 'de'], ['nl', 'de'], ['es', 'de'], ['it', 'de'],
  ['de', 'en'], ['fr', 'en'], ['nl', 'en'], ['es', 'en'],
  ['es', 'fr'], ['es', 'nl'],
  ['de', 'es'], ['en', 'es'], ['fr', 'es'], ['nl', 'es'],
  // Stufe 2 — NL / IT / FR natives (FreeDict directed packages exist for these).
  ['fr', 'nl'], ['de', 'nl'], ['en', 'nl'], ['it', 'nl'],
  ['fr', 'it'], ['de', 'it'], ['en', 'it'], ['nl', 'it'], ['es', 'it'],
  ['de', 'fr'], ['en', 'fr'], ['nl', 'fr'],
];

const TOP_RANKS = 20_000; // ranks bundled into freq-*.json
const DICT_VOCAB = 50_000; // headwords kept in dictionaries (per learning language)

const freqUrl = (l) =>
  `https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/${l}/${l}_50k.txt`;
const FREEDICT_DB = 'https://freedict.org/freedict-database.json';

/** Mirror of the runtime normalize() in src/core/difficulty/frequency.ts. */
const normalize = (w) => w.toLowerCase().replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');

async function download(url, dest) {
  if (existsSync(dest)) return dest;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  return dest;
}

// --- Frequency ------------------------------------------------------------

/** Returns { ranks: {word:rank top-N}, vocab: Set(top-DICT_VOCAB) }. */
async function buildFrequency(lang) {
  const file = await download(freqUrl(lang), join(SRC, `${lang}_50k.txt`));
  const lines = (await readFile(file, 'utf-8')).split('\n');
  const ranks = {};
  const vocab = new Set();
  let rank = 0;
  for (const line of lines) {
    const word = normalize(line.split(' ')[0] ?? '');
    if (!word || word in ranks) continue;
    rank += 1;
    if (rank <= TOP_RANKS) ranks[word] = rank;
    if (rank <= DICT_VOCAB) vocab.add(word);
    if (rank >= DICT_VOCAB) break;
  }
  await writeFile(join(OUT, `freq-${lang}.json`), JSON.stringify(ranks));
  console.log(`[freq:${lang}] ${Object.keys(ranks).length} ranks, ${vocab.size} vocab`);
  return vocab;
}

// --- Dictionary -----------------------------------------------------------

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64VAL = Object.fromEntries([...B64].map((c, i) => [c, i]));
const decodeOffset = (s) => [...s].reduce((n, c) => n * 64 + B64VAL[c], 0);

/** Parse one dictd entry body into a list of translation groups. */
function parseEntry(text) {
  const lines = text.split('\n').map((l) => l.trim());
  const senses = [];
  for (const line of lines.slice(1)) {
    // skip the headword/IPA/pos line (index 0)
    if (!line) continue;
    const numbered = line.match(/^(\d+)\.\s*(.+)$/);
    if (numbered) {
      const term = numbered[2].replace(/\s*\d+\.?\s*$/, '').trim(); // drop trailing "N."
      if (term) senses.push(term);
    } else if (senses.length === 0 && !line.startsWith('(') && line.length <= 60) {
      senses.push(line); // single-sense entry: first bare line is the translation
    }
    // otherwise: source-language definition / note → ignore
  }
  return senses
    .map((s) => ({
      // Strip grammatical markers like "<n, f>" (their commas would split wrong).
      translations: s
        .replace(/<[^>]*>/g, '')
        .split(/[,;]/)
        .map((t) => t.trim())
        .filter((t) => t && t.length <= 40),
    }))
    .filter((s) => s.translations.length);
}

async function resolveDictUrl(db, learn, native) {
  const name = `${ISO3[learn]}-${ISO3[native]}`;
  const entry = db.find((e) => e.name === name);
  const release = entry?.releases?.find((r) => r.platform === 'dictd');
  return release ? { name, url: release.URL } : null;
}

async function buildDictionary(db, learn, native, vocab) {
  const resolved = await resolveDictUrl(db, learn, native);
  if (!resolved) {
    console.log(`[dict:${learn}-${native}] no dictd release — skipped`);
    return;
  }
  const tar = await download(resolved.url, join(SRC, `${resolved.name}.tar.xz`));
  const dir = join(SRC, resolved.name);
  await mkdir(dir, { recursive: true });
  execSync(`tar xf "${tar}" -C "${dir}" --strip-components=1`, { stdio: 'ignore' });

  const dict = gunzipSync(await readFile(join(dir, `${resolved.name}.dict.dz`)));
  const index = await readFile(join(dir, `${resolved.name}.index`), 'utf-8');

  const out = {};
  for (const ln of index.split('\n')) {
    const [hw, o, l] = ln.split('\t');
    if (!hw || hw.startsWith('00database') || hw.includes(' ')) continue;
    const key = normalize(hw);
    if (!key || !vocab.has(key)) continue;
    const body = dict.subarray(decodeOffset(o), decodeOffset(o) + decodeOffset(l)).toString('utf-8');
    const senses = parseEntry(body);
    if (senses.length) out[key] = senses;
  }
  await writeFile(join(OUT, `dict-${learn}-${native}.json`), JSON.stringify(out));
  console.log(`[dict:${learn}-${native}] ${Object.keys(out).length} headwords`);
}

// --- Main -----------------------------------------------------------------

async function main() {
  await mkdir(OUT, { recursive: true });
  await mkdir(SRC, { recursive: true });

  const vocab = {};
  for (const lang of LANGS) vocab[lang] = await buildFrequency(lang);

  const db = await (await fetch(FREEDICT_DB)).json();
  for (const [learn, native] of DICT_PAIRS) {
    await buildDictionary(db, learn, native, vocab[learn]);
  }
  console.log('Done.');
}

await main();
