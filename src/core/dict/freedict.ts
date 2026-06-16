/**
 * Instant bilingual dictionary lookup (Stage 2 hover content).
 *
 * Data is generated offline from FreeDict (fra-deu / nld-deu) by
 * `scripts/build-wordlists.mjs` into `data/generated/dict-<lang>.json` as a
 * `{ headword: DictSense[] }` map. Loaded lazily; missing data fails soft.
 */

import { dictFile, type Language } from '../config';
import type { DictSense } from '../types';
import { normalize } from '../difficulty/frequency';

type DictMap = Record<string, DictSense[]>;

const cache = new Map<string, DictMap>();

async function loadDict(learn: Language, native: Language): Promise<DictMap> {
  const key = `${learn}-${native}`;
  const cached = cache.get(key);
  if (cached) return cached;

  let map: DictMap = {};
  try {
    const url = browser.runtime.getURL(`/data/${dictFile(learn, native)}` as never);
    const res = await fetch(url);
    if (res.ok) map = (await res.json()) as DictMap;
  } catch {
    // No dictionary for this pair — hover falls back to band only; "more" uses the LLM.
  }
  cache.set(key, map);
  return map;
}

export async function lookup(
  word: string,
  learn: Language,
  native: Language,
): Promise<DictSense[]> {
  const dict = await loadDict(learn, native);
  return dict[normalize(word)] ?? [];
}
