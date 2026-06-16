import { describe, expect, it } from 'vitest';
import { estimateTokens, splitForBudget } from './tokens';

describe('estimateTokens', () => {
  it('estimates roughly one token per four characters', () => {
    expect(estimateTokens('a'.repeat(40))).toBe(10);
  });
});

describe('splitForBudget', () => {
  it('returns the whole text as one chunk when within budget', () => {
    const text = 'Le chat dort. Il fait beau.';
    expect(splitForBudget(text, 1000)).toEqual([text]);
  });

  it('splits across sentence boundaries when over budget', () => {
    // budget of 4 tokens ≈ 16 chars forces splitting
    const chunks = splitForBudget('Un. Deux. Trois. Quatre.', 4);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join(' ')).toContain('Quatre');
  });

  it('keeps every chunk within the character budget', () => {
    const long = Array.from({ length: 50 }, (_, i) => `Phrase numéro ${i}.`).join(' ');
    const maxTokens = 20;
    for (const chunk of splitForBudget(long, maxTokens)) {
      expect(chunk.length).toBeLessThanOrEqual(maxTokens * 4);
    }
  });
});
