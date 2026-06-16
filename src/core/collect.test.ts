import { describe, expect, it } from 'vitest';
import { pickStudyWords, type Candidate } from './collect';

const c = (word: string, band: Candidate['band']): Candidate => ({
  word,
  band,
  translation: `${word}-de`,
});

describe('pickStudyWords', () => {
  const cands: Candidate[] = [
    c('a1word', 'A1'), // below A2 → skipped
    c('at1', 'A2'),
    c('at2', 'A2'),
    c('plus1a', 'B1'),
    c('plus1b', 'B1'),
    c('plus2', 'B2'),
    c('far', 'C2'), // too far → skipped
  ];

  it('keeps only at-level, +1 and +2 within the plan caps', () => {
    const picked = pickStudyWords(cands, 'A2', { 0: 5, 1: 1, 2: 5 });
    const words = picked.map((p) => p.word);
    expect(words).toContain('at1');
    expect(words).toContain('at2');
    expect(words).toContain('plus2');
    expect(words).not.toContain('a1word');
    expect(words).not.toContain('far');
    // +1 capped at 1
    expect(words.filter((w) => w.startsWith('plus1')).length).toBe(1);
  });

  it('skips candidates without a translation', () => {
    const picked = pickStudyWords([{ word: 'x', band: 'A2' }], 'A2');
    expect(picked).toHaveLength(0);
  });
});
