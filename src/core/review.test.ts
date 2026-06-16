import { describe, expect, it } from 'vitest';
import type { VocabEntry } from './vocab';
import { buildQuestion, canReview, selectForReview } from './review';

const entry = (over: Partial<VocabEntry>): VocabEntry => ({
  id: Math.random().toString(),
  text: 'mot',
  learn: 'fr',
  native: 'de',
  translation: 'Wort',
  ts: 0,
  seen: 1,
  reviews: 0,
  ...over,
});

const vocab: VocabEntry[] = [
  entry({ id: 'a', text: 'chat', translation: 'Katze, Kater' }),
  entry({ id: 'b', text: 'chien', translation: 'Hund' }),
  entry({ id: 'c', text: 'maison', translation: 'Haus' }),
  entry({ id: 'd', text: 'arbre', translation: 'Baum' }),
];

describe('canReview', () => {
  it('needs at least four distinct translations', () => {
    expect(canReview(vocab)).toBe(true);
    expect(canReview(vocab.slice(0, 3))).toBe(false);
  });
});

describe('selectForReview', () => {
  it('puts never-reviewed before reviewed, then wrong before right', () => {
    const list = [
      entry({ id: 'seen-ok', reviews: 2, lastCorrect: true, lastReviewed: 100 }),
      entry({ id: 'fresh', reviews: 0 }),
      entry({ id: 'seen-wrong', reviews: 2, lastCorrect: false, lastReviewed: 50 }),
    ];
    const order = selectForReview(list, 10).map((e) => e.id);
    expect(order[0]).toBe('fresh');
    expect(order[1]).toBe('seen-wrong');
    expect(order[2]).toBe('seen-ok');
  });
});

describe('buildQuestion', () => {
  it('includes the correct answer among the options', () => {
    const q = buildQuestion(vocab[0]!, vocab, () => 0);
    expect(q.answer).toBe('Katze');
    expect(q.options).toContain('Katze');
  });

  it('produces up to four unique options', () => {
    const q = buildQuestion(vocab[0]!, vocab, () => 0.5);
    expect(q.options.length).toBeGreaterThanOrEqual(2);
    expect(new Set(q.options).size).toBe(q.options.length);
    expect(q.options).not.toContain(''); // no empty distractors
  });
});
