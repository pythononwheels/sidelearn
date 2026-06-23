/**
 * Level-appropriate seed vocabulary, built at runtime from the already-bundled
 * frequency list + dictionary/glossary — no extra payload. Used to pre-fill the
 * Vokabeltest (so it's never empty) and to populate the Wörterbuch ("Alle").
 *
 * Words are taken in frequency order, kept if their CEFR band is at/below the
 * learner's level (cumulative), and require a known translation. Languages
 * without offline data yet (e.g. it) simply yield an empty list.
 */

import { type Language } from '@/core/config';
import { type CefrLevel, rankToBand, levelIndex } from '@/core/difficulty/banding';
import { loadRanks } from '@/core/difficulty/frequency';
import { lookup } from '@/core/dict/freedict';

export interface SeedWord {
  word: string;
  translation: string;
  band: CefrLevel;
}

const cache = new Map<string, SeedWord[]>();

/**
 * Cumulative seed vocabulary up to `level`, sorted most-frequent first, capped
 * at `limit`. Cached per (learn, native, level, limit). Empty when the language
 * has no bundled frequency/dictionary data.
 */
export async function seedVocab(
  learn: Language,
  native: Language,
  level: CefrLevel,
  limit: number,
): Promise<SeedWord[]> {
  const key = `${learn}-${native}-${level}-${limit}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const ranks = await loadRanks(learn);
  const entries = Object.entries(ranks);
  if (entries.length === 0) {
    cache.set(key, []);
    return [];
  }
  entries.sort((a, b) => a[1] - b[1]); // ascending rank = most frequent first

  const maxIdx = levelIndex(level);
  const out: SeedWord[] = [];
  const seen = new Set<string>();
  for (const [word, rank] of entries) {
    if (out.length >= limit) break;
    const band = rankToBand(rank);
    if (levelIndex(band) > maxIdx) continue; // harder than the learner's level
    const w = word.toLowerCase();
    // Skip 2-letter glue words: they make poor flashcards and FreeDict's entries
    // for them are often noisy (e.g. es "de" → "Handvoll"). Content words start
    // a little deeper and are reliably translated.
    if (w.length < 3 || seen.has(w)) continue;
    if (!/^[\p{L}]+$/u.test(w)) continue; // letters only — skip numbers/punctuation
    const senses = await lookup(word, learn, native);
    const tr = senses[0]?.translations?.slice(0, 2).join(', ');
    if (!tr) continue;
    seen.add(w);
    out.push({ word, translation: tr, band });
  }
  cache.set(key, out);
  return out;
}
