/**
 * Vocabulary capture store — the local record of words the user looked up.
 *
 * This is the foundation for spaced-repetition review and page quizzes. Stored
 * in chrome.storage.local (fully local) as a capped, newest-first list,
 * deduplicated by language + normalized word. Review fields are tracked now so
 * the review feature can build on them without a migration later.
 */

import { storage } from 'wxt/storage';
import type { CefrLevel } from './difficulty/banding';
import { STORAGE_KEYS, type Language } from './config';
import { normalize } from './difficulty/frequency';

export interface VocabEntry {
  id: string;
  text: string;
  learn: Language;
  native: Language;
  band?: CefrLevel;
  /** Main translation(s), comma-joined, for quick display + review prompts. */
  translation?: string;
  /** Sentence the word was found in, for context. */
  context?: string;
  /** First captured (ms). */
  ts: number;
  /** How often it has been looked up. */
  seen: number;
  /** Spaced-repetition bookkeeping. */
  reviews: number;
  /** How many of those reviews were answered correctly. */
  correct?: number;
  lastReviewed?: number;
  lastCorrect?: boolean;
}

const MAX_VOCAB = 1000;

const item = storage.defineItem<VocabEntry[]>(STORAGE_KEYS.vocab, { fallback: [] });

const keyOf = (learn: Language, text: string) => `${learn}:${normalize(text)}`;

export const getVocab = () => item.getValue();
export const watchVocab = (cb: (v: VocabEntry[]) => void) => item.watch(cb);
export const clearVocab = () => item.setValue([]);

/**
 * Add a word. If it already exists for this language, bump its `seen` count and
 * move it to the top (keeping the original review history).
 */
export async function addVocab(entry: VocabEntry): Promise<void> {
  const current = await item.getValue();
  const key = keyOf(entry.learn, entry.text);
  const existing = current.find((e) => keyOf(e.learn, e.text) === key);
  const merged: VocabEntry = existing
    ? { ...existing, ...entry, id: existing.id, seen: existing.seen + 1, reviews: existing.reviews }
    : entry;
  const rest = current.filter((e) => keyOf(e.learn, e.text) !== key);
  await item.setValue([merged, ...rest].slice(0, MAX_VOCAB));
}

export async function removeVocab(id: string): Promise<void> {
  const current = await item.getValue();
  await item.setValue(current.filter((e) => e.id !== id));
}

/** Record the outcome of a review question for spaced-repetition ordering. */
export async function recordReview(id: string, correct: boolean): Promise<void> {
  const current = await item.getValue();
  await item.setValue(
    current.map((e) =>
      e.id === id
        ? {
            ...e,
            reviews: e.reviews + 1,
            correct: (e.correct ?? 0) + (correct ? 1 : 0),
            lastReviewed: Date.now(),
            lastCorrect: correct,
          }
        : e,
    ),
  );
}
