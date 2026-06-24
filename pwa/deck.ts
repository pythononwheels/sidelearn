/**
 * The user's personal vocabulary deck — fully on-device (privacy-first).
 * Words enter via "merken" while reading (src 'user') or as level-up target
 * words seeded per Etappe (src 'target'). Each entry carries lightweight
 * spaced-repetition state (see srs.ts) so the Vokabeltest can schedule reviews.
 */

import { type Language } from '@/core/config';

export interface DeckEntry {
  word: string;
  translation: string;
  lang: Language;
  context?: string;
  ts: number;
  /** Spaced repetition (Leitner). Older entries may lack these → treated as box 0, due now. */
  box?: number; // 0..5
  due?: number; // timestamp when next due
  seen?: number; // times reviewed
  correct?: number; // times answered correctly
  band?: string; // CEFR band of the word (e.g. 'A2')
  src?: 'user' | 'target'; // user-saved vs. level-up target word
}

const KEY = 'sl_pwa_deck';

export function getDeck(): DeckEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function writeDeck(d: DeckEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* ignore */
  }
}

/** Add a word (dedupe by lang + lowercased word). Returns false if already there. */
export function addToDeck(e: DeckEntry): boolean {
  const deck = getDeck();
  const k = `${e.lang}:${e.word.toLowerCase()}`;
  if (deck.some((d) => `${d.lang}:${d.word.toLowerCase()}` === k)) return false;
  const entry: DeckEntry = { box: 0, due: e.ts, seen: 0, correct: 0, src: 'user', ...e };
  writeDeck([entry, ...deck].slice(0, 4000));
  return true;
}

export function removeFromDeck(lang: Language, word: string): void {
  const k = `${lang}:${word.toLowerCase()}`;
  writeDeck(getDeck().filter((d) => `${d.lang}:${d.word.toLowerCase()}` !== k));
}

export function inDeck(lang: Language, word: string): boolean {
  const k = `${lang}:${word.toLowerCase()}`;
  return getDeck().some((d) => `${d.lang}:${d.word.toLowerCase()}` === k);
}
