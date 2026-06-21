/**
 * Frequency-rank lookup for the learner's source language.
 *
 * The rank tables are generated offline from the FrequencyWords (OpenSubtitles)
 * lists by `scripts/build-wordlists.mjs` into `data/generated/freq-<lang>.json`
 * as a `{ "word": rank }` map. Loaded lazily and cached per language.
 *
 * Until the data files are generated this returns `undefined` (unknown rank),
 * which the caller treats as "not challenging" — fail-soft, never blocks reading.
 */

import { freqFile, type Language } from '../config';
import { dataUrl } from '../dataurl';

type RankMap = Record<string, number>;

const cache = new Map<Language, RankMap>();

export async function loadRanks(lang: Language): Promise<RankMap> {
  const cached = cache.get(lang);
  if (cached) return cached;

  let map: RankMap = {};
  try {
    const url = dataUrl(`/data/${freqFile(lang)}`);
    const res = await fetch(url);
    if (res.ok) map = (await res.json()) as RankMap;
  } catch {
    // Data not bundled yet — degrade gracefully to "everything unknown".
  }
  cache.set(lang, map);
  return map;
}

/** Look up the 1-based frequency rank of a surface form, or `undefined` if unknown. */
export function rankOf(ranks: RankMap, word: string): number | undefined {
  return ranks[normalize(word)];
}

/** Lowercase + strip surrounding punctuation; keeps accented letters intact. */
export function normalize(word: string): string {
  return word.toLowerCase().replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
}
