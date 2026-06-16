/**
 * Collect study words from a page — pick a level-appropriate mix of vocabulary
 * already present on the page, using frequency bands (instant, no LLM).
 *
 * Default plan: ~10 words at the learner's level, a few one and two levels above
 * (a manageable "i+1/i+2" stretch). Pure + testable.
 */

import { levelIndex, type CefrLevel } from './difficulty/banding';

export interface Candidate {
  word: string;
  band: CefrLevel;
  translation?: string;
}

/** How many words to take per level-offset above the learner. */
export const DEFAULT_PLAN: Record<number, number> = { 0: 10, 1: 6, 2: 4 };

/**
 * From candidates (must have a translation), take `plan[offset]` words for each
 * offset = band − level. Below-level and far-above words are skipped.
 */
export function pickStudyWords(
  candidates: Candidate[],
  level: CefrLevel,
  plan: Record<number, number> = DEFAULT_PLAN,
): Candidate[] {
  const base = levelIndex(level);
  const buckets = new Map<number, Candidate[]>();
  for (const c of candidates) {
    if (!c.translation) continue;
    const offset = levelIndex(c.band) - base;
    if (plan[offset] === undefined) continue;
    (buckets.get(offset) ?? buckets.set(offset, []).get(offset)!).push(c);
  }
  const out: Candidate[] = [];
  for (const offset of Object.keys(plan).map(Number)) {
    out.push(...(buckets.get(offset) ?? []).slice(0, plan[offset]));
  }
  return out;
}
