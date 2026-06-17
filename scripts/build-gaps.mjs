#!/usr/bin/env node
/**
 * List the frequency-list words that have NO dictionary translation (after
 * lemmatization), so they can be glossed. Writes data/sources/gap-<pair>.json
 * as [{ w, rank, band }], sorted by rank (most common first).
 *
 * Usage: node scripts/build-gaps.mjs <learn> <native>   (e.g. fr de)
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'src', 'public', 'data');
const OUT = join(ROOT, 'data', 'sources');

const norm = (w) => w.toLowerCase().replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');

// Mirror of src/core/dict/lemmatize.ts.
function candidates(w, lang) {
  w = norm(w);
  const out = new Set([w]);
  const add = (s) => { if (s.length >= 2) out.add(s); };
  const ends = (s) => w.endsWith(s);
  if (lang === 'fr') {
    if (ends('ant')) add(w.slice(0, -3) + 'er');
    if (ends('ées')) add(w.slice(0, -3) + 'er');
    else if (ends('ée')) add(w.slice(0, -2) + 'er');
    else if (ends('és')) add(w.slice(0, -2) + 'er');
    else if (ends('é')) add(w.slice(0, -1) + 'er');
    if (ends('aux')) add(w.slice(0, -3) + 'al');
    if (ends('x')) add(w.slice(0, -1));
    if (ends('s')) add(w.slice(0, -1));
    if (ends('e')) add(w.slice(0, -1));
  } else if (lang === 'es') {
    if (ends('ando')) add(w.slice(0, -4) + 'ar');
    if (ends('iendo')) { add(w.slice(0, -5) + 'er'); add(w.slice(0, -5) + 'ir'); }
    if (ends('ado')) add(w.slice(0, -3) + 'ar');
    if (ends('ido')) { add(w.slice(0, -3) + 'er'); add(w.slice(0, -3) + 'ir'); }
    if (ends('es')) add(w.slice(0, -2));
    if (ends('s')) add(w.slice(0, -1));
  } else if (lang === 'en') {
    if (ends('ies')) add(w.slice(0, -3) + 'y');
    if (ends('es')) add(w.slice(0, -2));
    if (ends('s')) add(w.slice(0, -1));
    if (ends('ing')) add(w.slice(0, -3));
    if (ends('ed')) add(w.slice(0, -2));
  } else if (lang === 'de') {
    if (ends('en')) add(w.slice(0, -2));
    if (ends('er')) add(w.slice(0, -2));
    if (ends('e')) add(w.slice(0, -1));
    if (ends('s')) add(w.slice(0, -1));
  } else if (lang === 'nl') {
    if (ends('en')) add(w.slice(0, -2));
    if (ends('s')) add(w.slice(0, -1));
  }
  return [...out];
}

const THRESHOLDS = [['A1', 750], ['A2', 1500], ['B1', 3000], ['B2', 6000], ['C1', 12000], ['C2', Infinity]];
const band = (rank) => THRESHOLDS.find(([, b]) => rank <= b)[0];

async function main() {
  const [learn, native] = process.argv.slice(2);
  if (!learn || !native) throw new Error('usage: build-gaps.mjs <learn> <native>');

  const ranks = JSON.parse(await readFile(join(DATA, `freq-${learn}.json`), 'utf8'));
  const dict = JSON.parse(await readFile(join(DATA, `dict-${learn}-${native}.json`), 'utf8'));
  const byRank = Object.entries(ranks).sort((a, b) => a[1] - b[1]);

  const gap = [];
  for (const [w, rank] of byRank) {
    if (w.length < 3) continue;
    if (candidates(w, learn).some((c) => dict[c])) continue;
    gap.push({ w, rank, band: band(rank) });
  }

  await mkdir(OUT, { recursive: true });
  await writeFile(join(OUT, `gap-${learn}-${native}.json`), JSON.stringify(gap));
  console.log(`gap-${learn}-${native}: ${gap.length} words without a dict entry`);
}

await main();
