import { describe, expect, it } from 'vitest';
import { isAboveLevel, levelIndex, rankToBand } from './banding';

describe('rankToBand', () => {
  it('maps the most frequent words to A1', () => {
    expect(rankToBand(1)).toBe('A1');
    expect(rankToBand(750)).toBe('A1');
  });

  it('maps rank ranges to the expected bands at their boundaries', () => {
    expect(rankToBand(751)).toBe('A2');
    expect(rankToBand(1500)).toBe('A2');
    expect(rankToBand(1501)).toBe('B1');
    expect(rankToBand(3000)).toBe('B1');
    expect(rankToBand(6000)).toBe('B2');
    expect(rankToBand(12000)).toBe('C1');
  });

  it('maps very rare words to C2', () => {
    expect(rankToBand(50_000)).toBe('C2');
  });
});

describe('isAboveLevel', () => {
  it('flags words harder than the learner level', () => {
    expect(isAboveLevel('B1', 'A2')).toBe(true);
    expect(isAboveLevel('C2', 'A1')).toBe(true);
  });

  it('does not flag words at or below the learner level', () => {
    expect(isAboveLevel('A2', 'A2')).toBe(false);
    expect(isAboveLevel('A1', 'A2')).toBe(false);
  });
});

describe('levelIndex', () => {
  it('orders CEFR levels ascending', () => {
    expect(levelIndex('A1')).toBeLessThan(levelIndex('C2'));
  });
});
