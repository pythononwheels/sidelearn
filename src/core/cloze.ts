/**
 * Cloze questions — take real sentences from the page that contain a vocab word,
 * blank the word out, and ask the learner to fill it from options drawn from
 * their other vocab. Instant, no LLM. Pure + testable.
 */

import type { QuizQuestion } from './quiz';

type Rng = () => number;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
): QuizQuestion[] {
  const sentences = splitSentences(pageText);
  const out: QuizQuestion[] = [];
  for (const word of words) {
    if (out.length >= max) break;
    const re = new RegExp(`(^|[^\\p{L}])(${escapeRe(word)})([^\\p{L}]|$)`, 'iu');
    const sentence = sentences.find((s) => re.test(s));
    if (!sentence) continue;
    const distractors = sample(
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
