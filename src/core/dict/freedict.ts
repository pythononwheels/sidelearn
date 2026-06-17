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
import { lemmaCandidates } from './lemmatize';

type DictMap = Record<string, DictSense[]>;
/** Supplementary glossary (frequency-list words missing from FreeDict). */
type GlossMap = Record<string, string[]>;

const cache = new Map<string, DictMap>();
const glossCache = new Map<string, GlossMap>();

async function loadGloss(learn: Language, native: Language): Promise<GlossMap> {
  const key = `${learn}-${native}`;
  const cached = glossCache.get(key);
  if (cached) return cached;

  let map: GlossMap = {};
  try {
    const url = browser.runtime.getURL(`/data/gloss-${learn}-${native}.json` as never);
    const res = await fetch(url);
    if (res.ok) map = (await res.json()) as GlossMap;
  } catch {
    // No glossary for this pair yet.
  }
  glossCache.set(key, map);
  return map;
}

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
  const candidates = lemmaCandidates(normalize(word), learn);
  // 1) FreeDict (curated). Try exact form first, then lemmatized fallbacks.
  const dict = await loadDict(learn, native);
  for (const candidate of candidates) {
    const hit = dict[candidate];
    if (hit) return hit;
  }
  // 2) Supplementary glossary for frequency words FreeDict doesn't cover.
  const gloss = await loadGloss(learn, native);
  for (const candidate of candidates) {
    const hit = gloss[candidate];
    if (hit?.length) return [{ translations: hit }];
  }
  return [];
}
