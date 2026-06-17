/**
 * Learning stats derived from the vocab store — no extra persistence needed.
 * Pure so it can be unit-tested.
 *
 * Per-period values use timestamps we already keep: `ts` (first captured) for
 * new vocab, `lastReviewed` for practice activity. Overall review accuracy comes
 * from the accumulated `reviews`/`correct` counters. (Page-quiz results aren't
 * persisted yet — that's a phase-2 addition.)
 */

import type { VocabEntry } from './vocab';

export type Period = 'week' | 'month' | 'all';

export interface PeriodStat {
  /** New vocab captured in the period. */
  added: number;
  /** Distinct words practised in the period (by last review). */
  reviewed: number;
}

export interface LearnStats {
  week: PeriodStat;
  month: PeriodStat;
  all: PeriodStat;
  /** Overall review accuracy across all entries. */
  answered: number;
  correct: number;
  accuracy: number;
}

const DAY = 86_400_000;

export function computeStats(vocab: VocabEntry[], now: number): LearnStats {
  const mk = (): PeriodStat => ({ added: 0, reviewed: 0 });
  const week = mk();
  const month = mk();
  const all = mk();
  let answered = 0;
  let correct = 0;

  for (const v of vocab) {
    const age = now - v.ts;
    all.added++;
    if (age <= 30 * DAY) month.added++;
    if (age <= 7 * DAY) week.added++;

    if ((v.reviews ?? 0) > 0) {
      all.reviewed++;
      if (v.lastReviewed !== undefined) {
        const rAge = now - v.lastReviewed;
        if (rAge <= 30 * DAY) month.reviewed++;
        if (rAge <= 7 * DAY) week.reviewed++;
      }
    }

    answered += v.reviews ?? 0;
    correct += v.correct ?? 0;
  }

  return {
    week,
    month,
    all,
    answered,
    correct,
    accuracy: answered > 0 ? correct / answered : 0,
  };
}
