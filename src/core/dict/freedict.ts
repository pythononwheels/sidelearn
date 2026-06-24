/**
 * Instant bilingual dictionary lookup (Stage 2 hover content).
 *
 * Data is generated offline from FreeDict (fra-deu / nld-deu) by
 * `scripts/build-wordlists.mjs` into `data/generated/dict-<lang>.json` as a
 * `{ headword: DictSense[] }` map. Loaded lazily; missing data fails soft.
 */

import { dictFile, type Language } from '../config';
import { dataUrl } from '../dataurl';
import type { DictSense } from '../types';
import { normalize } from '../difficulty/frequency';
import { lemmaCandidates } from './lemmatize';

type DictMap = Record<string, DictSense[]>;
/** Supplementary glossary (frequency-list words missing from FreeDict). */
type GlossMap = Record<string, string[]>;

const cache = new Map<string, DictMap>();
const glossCache = new Map<string, GlossMap>();
/** inflected form → lemma, from Wiktionary (per learning language). */
const formsCache = new Map<Language, Record<string, string>>();

export async function loadForms(learn: Language): Promise<Record<string, string>> {
  const cached = formsCache.get(learn);
  if (cached) return cached;
  let map: Record<string, string> = {};
  try {
    const url = dataUrl(`/data/forms-${learn}.json`);
    const res = await fetch(url);
    if (res.ok) map = (await res.json()) as Record<string, string>;
  } catch {
    // No forms map for this language yet.
  }
  formsCache.set(learn, map);
  return map;
}

async function loadGloss(learn: Language, native: Language): Promise<GlossMap> {
  const key = `${learn}-${native}`;
  const cached = glossCache.get(key);
  if (cached) return cached;

  let map: GlossMap = {};
  try {
    const url = dataUrl(`/data/gloss-${learn}-${native}.json`);
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
    const url = dataUrl(`/data/${dictFile(learn, native)}`);
    const res = await fetch(url);
    if (res.ok) map = (await res.json()) as DictMap;
  } catch {
    // No dictionary for this pair — hover falls back to band only; "more" uses the LLM.
  }
  cache.set(key, map);
  return map;
}

/* ---- Rich dictionary (richdict-<learn>-<native>.json) --------------------
 * Pre-built, grounded learner dictionary: per word a CEFR band + 1-3 senses,
 * each with German meaning, part of speech, and an example (learning lang + DE).
 * Built once by scripts/build-richdict.mjs; loaded lazily, fails soft. */

export interface RichSense {
  t: string; // German meaning
  p?: string; // part of speech (German)
  ex?: string; // example in the learning language
  exd?: string; // German translation of the example
}
export interface RichEntry {
  b?: string; // CEFR band
  s: RichSense[];
  alt?: string[];
}
type RichMap = Record<string, RichEntry>;

const richCache = new Map<string, RichMap>();

export async function loadRichDict(learn: Language, native: Language): Promise<RichMap> {
  const key = `${learn}-${native}`;
  const cached = richCache.get(key);
  if (cached) return cached;
  let map: RichMap = {};
  try {
    const res = await fetch(dataUrl(`/data/richdict-${learn}-${native}.json`));
    if (res.ok) map = (await res.json()) as RichMap;
  } catch {
    // Not built for this pair yet — callers fall back to FreeDict/LLM.
  }
  richCache.set(key, map);
  return map;
}

/** Rich entry for a (possibly inflected) word, or null. */
export async function richLookup(
  word: string,
  learn: Language,
  native: Language,
): Promise<RichEntry | null> {
  const base = normalize(word);
  const rich = await loadRichDict(learn, native);
  for (const c of lemmaCandidates(base, learn)) if (rich[c]) return rich[c];
  const lemma = (await loadForms(learn))[base];
  if (lemma && rich[lemma]) return rich[lemma];
  return null;
}

export async function lookup(
  word: string,
  learn: Language,
  native: Language,
): Promise<DictSense[]> {
  const base = normalize(word);
  const rule = lemmaCandidates(base, learn); // exact form + rule-based lemmas
  const dict = await loadDict(learn, native);
  const gloss = await loadGloss(learn, native);

  // 1) FreeDict on the exact form / rule-derived lemmas.
  for (const c of rule) if (dict[c]) return dict[c];
  // 2) Hand glossary (curated; wins over the Wiktionary auto-mapping).
  for (const c of rule) {
    const hit = gloss[c];
    if (hit?.length) return [{ translations: hit }];
  }
  // 3) Wiktionary inflection → lemma (e.g. tengo→tener), then FreeDict/gloss.
  const lemma = (await loadForms(learn))[base];
  if (lemma) {
    if (dict[lemma]) return dict[lemma];
    const hit = gloss[lemma];
    if (hit?.length) return [{ translations: hit }];
  }
  return [];
}
