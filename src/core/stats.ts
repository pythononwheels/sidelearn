/**
 * Learning stats derived from the vocab store — no extra persistence needed.
 * Pure so it can be unit-tested.
 *
 * Vocab counts come from each entry's capture time (`ts`); review accuracy from
 * the per-entry `reviews`/`correct` bookkeeping accumulated by the review flow.
 * (Page-quiz results aren't persisted yet — that's a phase-2 addition.)
 */

import type { VocabEntry } from './vocab';

export interface LearnStats {
  vocab: { week: number; month: number; all: number };
  review: { answered: number; correct: number; accuracy: number };
}

const DAY = 86_400_000;

export function computeStats(vocab: VocabEntry[], now: number): LearnStats {
  let week = 0;
  let month = 0;
  let answered = 0;
  let correct = 0;
  for (const v of vocab) {
    const age = now - v.ts;
    if (age <= 7 * DAY) week++;
    if (age <= 30 * DAY) month++;
    answered += v.reviews ?? 0;
    correct += v.correct ?? 0;
  }
  return {
    vocab: { week, month, all: vocab.length },
    review: { answered, correct, accuracy: answered > 0 ? correct / answered : 0 },
  };
}
