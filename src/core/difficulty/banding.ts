/**
 * Difficulty banding — maps a word's frequency rank to an approximate CEFR band,
 * and decides whether a word is "above" the learner's level (= worth highlighting).
 *
 * Rationale: there is no clean, free CEFR word list for every language, but CEFR
 * vocabulary size correlates strongly with frequency rank. We bucket the rank.
 * For French this can later be refined with FLELex; see doc/tech/architecture.md.
 *
 * Pure module — no browser/WXT imports — so it is trivially unit-testable.
 */

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

/**
 * Upper rank bound (inclusive) for each band. A word ranked within `bound`
 * most-frequent words is assigned that band. Heuristic, intentionally tunable.
 */
export const RANK_THRESHOLDS: ReadonlyArray<readonly [CefrLevel, number]> = [
  ['A1', 750],
  ['A2', 1500],
  ['B1', 3000],
  ['B2', 6000],
  ['C1', 12000],
  ['C2', Number.POSITIVE_INFINITY],
] as const;

/** 1-based frequency rank → CEFR band. Lower rank = more common = easier. */
export function rankToBand(rank: number): CefrLevel {
  for (const [band, bound] of RANK_THRESHOLDS) {
    if (rank <= bound) return band;
  }
  return 'C2';
}

/** Ordinal position of a CEFR level (A1 = 0 … C2 = 5). */
export function levelIndex(level: CefrLevel): number {
  return CEFR_LEVELS.indexOf(level);
}

/**
 * True when `wordBand` is strictly harder than the learner's `userLevel` —
 * i.e. the word should be highlighted as "challenging".
 */
export function isAboveLevel(wordBand: CefrLevel, userLevel: CefrLevel): boolean {
  return levelIndex(wordBand) > levelIndex(userLevel);
}
