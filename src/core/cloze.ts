/**
 * Cloze questions — take real sentences from the page that contain a vocab word,
 * blank the word out, and ask the learner to fill it from options drawn from
 * their other vocab. Instant, no LLM. Pure + testable.
 */

import type { QuizQuestion } from './quiz';

type Rng = () => number;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A word the learner is acquiring (SRS deck lemma), to be blanked where it
 *  occurs in the article. `band` drives part-of-speech/band-matched distractors. */
export interface LemmaTarget {
  lemma: string; // SRS key — the deck lemma, e.g. "frapper"
  band?: string; // CEFR band of the lemma (for distractor matching)
}

/** A cloze question that also carries the SRS lemma it tests, so the caller can
 *  grade the answer back into the spaced-repetition deck. */
export interface ClozeItem extends QuizQuestion {
  lemma: string; // the matched deck lemma — SRS grading key
}

export interface ClozeFromLemmasOpts {
  /** surface form (as written in the text) → candidate lemmas, lowercased. */
  lemmasOf: (surface: string) => string[];
  /** plausible distractor surface forms for an answer (POS/band-aware). */
  pickDistractors: (answerSurface: string, lemma: string, band: string | undefined, n: number) => string[];
  rng?: Rng;
  max?: number;
  /** sentences already consumed by a prior pass — avoids blanking one twice. */
  used?: Set<string>;
}

/**
 * Build cloze questions from a priority list of SRS deck LEMMAS, blanking each
 * lemma where an inflected form of it actually occurs in the article text.
 *
 * Unlike `buildClozeQuestions` (which matches the literal surface of the given
 * word), this lemmatizes each article token via the injected `lemmasOf` and
 * matches against the target lemma — so a deck lemma like "frapper" blanks the
 * surface "frappé" in the sentence. The displayed `answer` stays the surface
 * form (the revealed sentence reads correctly); `lemma` is carried for grading.
 *
 * Pure: the lemmatizer and distractor picker are injected, so no dictionary or
 * app imports leak into core and the helper stays unit-testable.
 */
export function buildClozeFromLemmas(
  pageText: string,
  targets: LemmaTarget[],
  opts: ClozeFromLemmasOpts,
): ClozeItem[] {
  const { lemmasOf, pickDistractors, rng = Math.random, max = 10 } = opts;
  const sentences = splitSentences(pageText);
  const usedSentences = opts.used ?? new Set<string>();
  const usedLemmas = new Set<string>();
  const out: ClozeItem[] = [];

  for (const tgt of targets) {
    if (out.length >= max) break;
    const lemma = tgt.lemma.toLowerCase();
    if (usedLemmas.has(lemma)) continue;

    // Find the first unused sentence with a token that lemmatizes to this lemma.
    let hit: { sentence: string; surface: string } | null = null;
    for (const s of sentences) {
      if (usedSentences.has(s)) continue;
      for (const m of s.matchAll(/(\p{L}[\p{L}\-']*)/gu)) {
        const surface = m[1]!;
        if (lemmasOf(surface).includes(lemma)) { hit = { sentence: s, surface }; break; }
      }
      if (hit) break;
    }
    if (!hit) continue;

    const distractors = sample(unique(pickDistractors(hit.surface, lemma, tgt.band, 3)), 3, rng);
    if (distractors.length < 1) continue;

    const re = new RegExp(`(^|[^\\p{L}])(${escapeRe(hit.surface)})([^\\p{L}]|$)`, 'iu');
    out.push({
      prompt: hit.sentence.replace(re, (_m, a, _w, c) => `${a} ____ ${c}`),
      options: shuffle([hit.surface, ...distractors], rng),
      answer: hit.surface, // surface so the revealed sentence reads correctly
      lemma, // SRS grading key
    });
    usedSentences.add(hit.sentence);
    usedLemmas.add(lemma);
  }
  return out;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12 && s.length <= 240);
}

/**
 * @param words   vocab words to test, in priority order
 * @param pool    all vocab words (distractor source)
 */
export function buildClozeQuestions(
  pageText: string,
  words: string[],
  pool: string[],
  rng: Rng = Math.random,
  max = 10,
  opts?: { pickDistractors?: (answer: string, n: number) => string[] },
): QuizQuestion[] {
  const sentences = splitSentences(pageText);
  const out: QuizQuestion[] = [];
  for (const word of words) {
    if (out.length >= max) break;
    const re = new RegExp(`(^|[^\\p{L}])(${escapeRe(word)})([^\\p{L}]|$)`, 'iu');
    const sentence = sentences.find((s) => re.test(s));
    if (!sentence) continue;
    const distractors = opts?.pickDistractors
      ? sample(unique(opts.pickDistractors(word, 3).filter((d) => d.toLowerCase() !== word.toLowerCase())), 3, rng)
      : sample(
          unique(pool.filter((d) => d.toLowerCase() !== word.toLowerCase())),
          3,
          rng,
        );
    if (distractors.length < 1) continue;
    out.push({
      prompt: sentence.replace(re, (_m, a, _w, c) => `${a} ____ ${c}`),
      options: shuffle([word, ...distractors], rng),
      answer: word,
    });
  }
  return out;
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
