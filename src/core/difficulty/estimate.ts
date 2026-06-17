/**
 * Rough difficulty estimate for a chunk of text in the learning language.
 *
 * Reuses the frequency→band machinery: of the alphabetic tokens we actually
 * know a rank for, what share sits above the learner's level. That share maps
 * to a coarse tag we can show on the daily-challenge card. Deliberately fuzzy —
 * it's a hint ("passt zu A2" / "anspruchsvoll"), not a score.
 */

import type { Language } from '../config';
import { isAboveLevel, rankToBand, type CefrLevel } from './banding';
import { loadRanks, normalize, rankOf } from './frequency';

export type DifficultyTag = 'leicht' | 'passt' | 'fordernd' | 'schwer';

export interface DifficultyEstimate {
  /** Fraction (0–1) of known words above the user's level. */
  aboveShare: number;
  /** Number of known words the estimate is based on. */
  sample: number;
  tag: DifficultyTag;
}

/** German label for the tag, referencing the user's level where useful. */
export function difficultyLabel(tag: DifficultyTag, level: CefrLevel): string {
  switch (tag) {
    case 'leicht':
      return `leicht für ${level}`;
    case 'passt':
      return `passt zu ${level}`;
    case 'fordernd':
      return 'etwas anspruchsvoll';
    case 'schwer':
      return 'anspruchsvoll';
  }
}

export async function estimateDifficulty(
  text: string,
  learn: Language,
  level: CefrLevel,
): Promise<DifficultyEstimate> {
  const ranks = await loadRanks(learn);
  const tokens = text.split(/[^\p{L}]+/u).filter((t) => t.length >= 3);

  let known = 0;
  let above = 0;
  for (const tok of tokens) {
    const rank = rankOf(ranks, normalize(tok));
    if (rank === undefined) continue; // unknown (often names/loanwords) — ignore
    known++;
    if (isAboveLevel(rankToBand(rank), level)) above++;
  }

  const aboveShare = known > 0 ? above / known : 0;
  return { aboveShare, sample: known, tag: tagFor(aboveShare, known) };
}

/** Map the above-level share to a coarse tag. Thresholds are heuristic. */
function tagFor(share: number, sample: number): DifficultyTag {
  // Too little signal (no freq data, or very short text) → don't over-claim.
  if (sample < 10) return 'passt';
  if (share < 0.12) return 'leicht';
  if (share < 0.25) return 'passt';
  if (share < 0.42) return 'fordernd';
  return 'schwer';
}
