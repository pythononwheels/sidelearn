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

  it('buckets new vocab by capture age (7d / 30d / all)', () => {
    const s = computeStats(
      [
        entry({ ts: now - 1 * DAY }),
        entry({ ts: now - 10 * DAY }),
        entry({ ts: now - 40 * DAY }),
      ],
      now,
    );
    expect(s.week.added).toBe(1);
    expect(s.month.added).toBe(2);
    expect(s.all.added).toBe(3);
  });

  it('counts practised words by last-review age', () => {
    const s = computeStats(
      [
        entry({ reviews: 2, correct: 1, lastReviewed: now - 2 * DAY }),
        entry({ reviews: 1, correct: 1, lastReviewed: now - 20 * DAY }),
        entry({ reviews: 0 }), // never reviewed
      ],
      now,
    );
    expect(s.week.reviewed).toBe(1);
    expect(s.month.reviewed).toBe(2);
    expect(s.all.reviewed).toBe(2);
  });

  it('aggregates overall review accuracy', () => {
    const s = computeStats(
      [entry({ reviews: 4, correct: 3 }), entry({ reviews: 6, correct: 3 })],
      now,
    );
    expect(s.answered).toBe(10);
    expect(s.correct).toBe(6);
    expect(s.accuracy).toBeCloseTo(0.6);
  });

  it('handles an empty store without dividing by zero', () => {
    const s = computeStats([], now);
    expect(s.all).toEqual({ added: 0, reviewed: 0 });
    expect(s.accuracy).toBe(0);
  });
});
