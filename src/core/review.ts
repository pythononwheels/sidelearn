/**
 * Review session builder — turns captured vocabulary into a multiple-choice
 * quiz. Distractors come from the user's *other* vocab translations (instant,
 * no LLM, and good discrimination because they're words actually encountered).
 *
 * Pure and deterministic given an `rng`, so it is unit-testable.
 */

import type { VocabEntry } from './vocab';

export interface ReviewQuestion {
  entryId: string;
  /** The word shown (in the learning language). */
  word: string;
  /** The correct native translation. */
  answer: string;
  /** Answer + distractors, shuffled. */
  options: string[];
}

type Rng = () => number;

/** First translation of an entry, trimmed. */
export function primary(entry: VocabEntry): string {
  return (entry.translation ?? '').split(/[,;]/)[0]!.trim();
}

/** Accuracy 0..1; never-reviewed counts as 0 (so it's prioritized). */
function accuracy(e: VocabEntry): number {
  return e.reviews > 0 ? (e.correct ?? 0) / e.reviews : 0;
}

/**
 * Order entries for review (simple spaced repetition): never-reviewed first,
 * then lowest accuracy (often-wrong before often-right), then answered-wrong
 * last time, then least-recently reviewed. So mastered words resurface least.
 */
export function selectForReview(vocab: VocabEntry[], size: number): VocabEntry[] {
  return vocab
    .filter((e) => primary(e))
    .slice()
    .sort((a, b) => {
      const af = a.reviews === 0 ? 0 : 1;
      const bf = b.reviews === 0 ? 0 : 1;
      if (af !== bf) return af - bf; // never-reviewed first
      if (accuracy(a) !== accuracy(b)) return accuracy(a) - accuracy(b); // weakest first
      const aw = a.lastCorrect === false ? 0 : 1;
      const bw = b.lastCorrect === false ? 0 : 1;
      if (aw !== bw) return aw - bw;
      return (a.lastReviewed ?? 0) - (b.lastReviewed ?? 0);
    })
    .slice(0, size);
}

export function buildQuestion(entry: VocabEntry, pool: VocabEntry[], rng: Rng): ReviewQuestion {
  const answer = primary(entry);
  const distractorPool = unique(
    pool.map(primary).filter((t) => t && t.toLowerCase() !== answer.toLowerCase()),
  );
  const distractors = sample(distractorPool, 3, rng);
  return {
    entryId: entry.id,
    word: entry.text,
    answer,
    options: shuffle([answer, ...distractors], rng),
  };
}

export function buildSession(vocab: VocabEntry[], size = 10, rng: Rng = Math.random): ReviewQuestion[] {
  return selectForReview(vocab, size).map((e) => buildQuestion(e, vocab, rng));
}

/** Whether there is enough material for a meaningful quiz. */
export function canReview(vocab: VocabEntry[]): boolean {
  return unique(vocab.map(primary).filter(Boolean)).length >= 4;
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function sample<T>(items: T[], n: number, rng: Rng): T[] {
  return shuffle(items, rng).slice(0, n);
}
