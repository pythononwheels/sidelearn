/**
 * Instant bilingual dictionary lookup (Stage 2 hover content).
 *
 * Data is generated offline from FreeDict (fra-deu / nld-deu) by
 * `scripts/build-wordlists.mjs` into `data/generated/dict-<lang>.json` as a
 * `{ headword: DictSense[] }` map. Loaded lazily; missing data fails soft.
 */

import type { LangPair } from '../config';
import type { DictSense } from '../types';
import { normalize } from '../difficulty/frequency';

type DictMap = Record<string, DictSense[]>;

const cache = new Map<LangPair['source'], DictMap>();

async function loadDict(lang: LangPair['source']): Promise<DictMap> {
  const cached = cache.get(lang);
  if (cached) return cached;

  let map: DictMap = {};
  try {
    const url = browser.runtime.getURL(`/data/dict-${lang}.json` as never);
    const res = await fetch(url);
    if (res.ok) map = (await res.json()) as DictMap;
  } catch {
    // No dictionary bundled yet — hover falls back to frequency band only.
  }
  cache.set(lang, map);
  return map;
}

export async function lookup(word: string, lang: LangPair['source']): Promise<DictSense[]> {
  const dict = await loadDict(lang);
  return dict[normalize(word)] ?? [];
}
