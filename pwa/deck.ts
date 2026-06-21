/**
 * The user's personal vocabulary deck — fully on-device (privacy-first).
 * "merken" in a lesson adds a word here; the vocab trainer (later) draws from it.
 * Separate from the server's per-lesson vocab (that's shared content, not the
 * user's choice).
 */

import { type Language } from '@/core/config';

export interface DeckEntry {
  word: string;
  translation: string;
  lang: Language;
  context?: string;
  ts: number;
}

const KEY = 'sl_pwa_deck';

export function getDeck(): DeckEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

function write(d: DeckEntry[]): void {
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
  write([e, ...deck].slice(0, 2000));
  return true;
}

export function removeFromDeck(lang: Language, word: string): void {
  const k = `${lang}:${word.toLowerCase()}`;
  write(getDeck().filter((d) => `${d.lang}:${d.word.toLowerCase()}` !== k));
}

export function inDeck(lang: Language, word: string): boolean {
  const k = `${lang}:${word.toLowerCase()}`;
  return getDeck().some((d) => `${d.lang}:${d.word.toLowerCase()}` === k);
}
