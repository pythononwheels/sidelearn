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
import { lookup, loadRichDict } from '@/core/dict/freedict';
import { nextLevel } from './route';

export interface SeedWord {
  word: string;
  translation: string;
  band: CefrLevel;
  pos?: string;
  example?: string;
  exampleDe?: string;
  alternatives?: string[];
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

  // Prefer the rich dictionary (correct primary sense + example/pos); fall back
  // to the flat FreeDict lookup where richdict isn't built yet.
  const rich = await loadRichDict(learn, native);
  const maxIdx = levelIndex(level);
  const out: SeedWord[] = [];
  const seen = new Set<string>();
  for (const [word, rank] of entries) {
    if (out.length >= limit) break;
    const band = rankToBand(rank);
    if (levelIndex(band) > maxIdx) continue; // harder than the learner's level
    const w = word.toLowerCase();
    // Skip 2-letter glue words: they make poor flashcards.
    if (w.length < 3 || seen.has(w)) continue;
    if (!/^[\p{L}]+$/u.test(w)) continue; // letters only

    const re = rich[w];
    if (re?.s?.length) {
      const s0 = re.s[0]!;
      seen.add(w);
      out.push({
        word, band, translation: s0.t, pos: s0.p, example: s0.ex, exampleDe: s0.exd,
        alternatives: [...new Set([...re.s.slice(1).map((s) => s.t), ...(re.alt ?? [])])],
      });
      continue;
    }
    const senses = await lookup(word, learn, native);
    const tr = senses[0]?.translations?.slice(0, 2).join(', ');
    if (!tr) continue;
    seen.add(w);
    out.push({ word, translation: tr, band });
  }
  cache.set(key, out);
  return out;
}

const targetCache = new Map<string, SeedWord[]>();

/**
 * The NEXT level's vocabulary, in frequency order — the "i+1" target words a
 * learner must acquire to level up. Pulled from richdict (band === next level),
 * with meaning + example. Empty if richdict isn't built for the pair.
 */
export async function nextLevelTargets(
  learn: Language,
  native: Language,
  level: CefrLevel,
  n: number,
): Promise<SeedWord[]> {
  const target = nextLevel(level);
  if (target === level) return []; // already at the top
  const key = `${learn}-${native}-${target}-${n}`;
  const hit = targetCache.get(key);
  if (hit) return hit;

  const ranks = await loadRanks(learn);
  const rich = await loadRichDict(learn, native);
  // Frequency order: iterate ranks ascending, keep words whose richdict band is
  // the next level (so they are genuinely one step above the learner).
  const order = Object.entries(ranks).sort((a, b) => a[1] - b[1]);
  const out: SeedWord[] = [];
  for (const [word] of order) {
    if (out.length >= n) break;
    const e = rich[word.toLowerCase()];
    if (!e?.s?.length || e.b !== target) continue;
    const s0 = e.s[0]!;
    out.push({
      word, band: target as CefrLevel, translation: s0.t, pos: s0.p, example: s0.ex, exampleDe: s0.exd,
      alternatives: [...new Set([...e.s.slice(1).map((s) => s.t), ...(e.alt ?? [])])],
    });
  }
  targetCache.set(key, out);
  return out;
}
