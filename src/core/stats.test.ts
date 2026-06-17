import { describe, expect, it } from 'vitest';
import { computeStats } from './stats';
import type { VocabEntry } from './vocab';

const DAY = 86_400_000;

function entry(over: Partial<VocabEntry>): VocabEntry {
  return {
    id: Math.random().toString(36),
    text: 'x',
    learn: 'fr',
    native: 'de',
    ts: 0,
    seen: 1,
    reviews: 0,
    ...over,
  };
}

describe('computeStats', () => {
  const now = 100 * DAY;

  it('buckets vocab by capture age (7d / 30d / all)', () => {
    const vocab = [
      entry({ ts: now - 1 * DAY }),
      entry({ ts: now - 10 * DAY }),
      entry({ ts: now - 40 * DAY }),
    ];
    const s = computeStats(vocab, now);
    expect(s.vocab.week).toBe(1);
    expect(s.vocab.month).toBe(2);
    expect(s.vocab.all).toBe(3);
  });

  it('aggregates review accuracy across entries', () => {
    const vocab = [
      entry({ reviews: 4, correct: 3 }),
      entry({ reviews: 6, correct: 3 }),
    ];
    const s = computeStats(vocab, now);
    expect(s.review.answered).toBe(10);
    expect(s.review.correct).toBe(6);
    expect(s.review.accuracy).toBeCloseTo(0.6);
  });

  it('handles an empty store without dividing by zero', () => {
    const s = computeStats([], now);
    expect(s).toEqual({
      vocab: { week: 0, month: 0, all: 0 },
      review: { answered: 0, correct: 0, accuracy: 0 },
    });
  });
});
