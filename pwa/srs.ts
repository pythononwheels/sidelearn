/**
 * Lightweight spaced repetition (Leitner) over the on-device deck (deck.ts).
 * Drives the Vokabeltest: due reviews + newly introduced level-up target words.
 * Retention research: a word needs ~10-20 spaced encounters to stick, so boxes
 * widen the interval on each correct answer and reset on a miss.
 */

import { type Language } from '@/core/config';
import { getDeck, writeDeck, type DeckEntry } from './deck';

const DAY = 86_400_000;
/** Days until next due, per Leitner box (0..5). */
const INTERVAL_DAYS = [0, 1, 2, 4, 8, 16];
export const MAX_BOX = INTERVAL_DAYS.length - 1; // 5
/** Box at which a word counts as "sits" for an Etappe (≈2 correct, spaced). */
export const CLEARED_BOX = 2;
/** Box at which a word counts as "mastered/learned". */
export const MASTERED_BOX = 4;

const now = () => Date.now();
const box = (e: DeckEntry) => e.box ?? 0;
const due = (e: DeckEntry) => e.due ?? 0;
const key = (lang: Language, word: string) => `${lang}:${word.toLowerCase()}`;

/** Entries for a language whose review is due (due <= now), soonest first. */
export function dueEntries(lang: Language, limit?: number): DeckEntry[] {
  const ds = getDeck()
    .filter((d) => d.lang === lang && due(d) <= now())
    .sort((a, b) => due(a) - due(b));
  return limit ? ds.slice(0, limit) : ds;
}

/** How many cards are due right now (for the home tile badge). */
export function dueCount(lang: Language): number {
  return getDeck().filter((d) => d.lang === lang && due(d) <= now()).length;
}

/** Record an answer: correct → next box (longer interval); wrong → back to box 1. */
export function grade(lang: Language, word: string, ok: boolean): void {
  const deck = getDeck();
  const k = key(lang, word);
  let changed = false;
  for (const e of deck) {
    if (key(e.lang, e.word) !== k) continue;
    const b = ok ? Math.min(box(e) + 1, MAX_BOX) : 1;
    e.box = b;
    e.seen = (e.seen ?? 0) + 1;
    e.correct = (e.correct ?? 0) + (ok ? 1 : 0);
    e.due = now() + INTERVAL_DAYS[b]! * DAY;
    changed = true;
    break;
  }
  if (changed) writeDeck(deck);
}

export interface TargetWord {
  word: string;
  translation: string;
  band?: string;
}

/** Seed level-up target words into the deck (idempotent). Returns count added. */
export function addTargets(lang: Language, targets: TargetWord[]): number {
  const deck = getDeck();
  const have = new Set(deck.map((d) => key(d.lang, d.word)));
  let added = 0;
  const fresh: DeckEntry[] = [];
  for (const t of targets) {
    if (!t.word || !t.translation) continue;
    const k = key(lang, t.word);
    if (have.has(k)) continue;
    have.add(k);
    fresh.push({ word: t.word, translation: t.translation, lang, band: t.band, src: 'target', ts: now(), box: 0, due: now(), seen: 0, correct: 0 });
    added++;
  }
  if (added) writeDeck([...fresh, ...deck].slice(0, 4000));
  return added;
}

/** How many of `words` are at/above box `minBox` (i.e. "cleared") for an Etappe. */
export function clearedCount(lang: Language, words: string[], minBox = CLEARED_BOX): number {
  const map = new Map(getDeck().filter((d) => d.lang === lang).map((d) => [d.word.toLowerCase(), d]));
  let n = 0;
  for (const w of words) {
    const e = map.get(w.toLowerCase());
    if (e && box(e) >= minBox) n++;
  }
  return n;
}

/** Mastered (box >= MASTERED_BOX) word count, optionally filtered by CEFR band. */
export function masteredCount(lang: Language, band?: string): number {
  return getDeck().filter((d) => d.lang === lang && box(d) >= MASTERED_BOX && (!band || d.band === band)).length;
}
