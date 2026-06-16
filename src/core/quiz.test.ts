import { describe, expect, it } from 'vitest';
import { parseQuiz } from './quiz';

describe('parseQuiz', () => {
  it('parses valid quiz JSON into questions with the right answer', () => {
    const raw =
      '{"questions":[{"q":"Quel animal?","options":["chat","chien","oiseau","poisson"],"correct":1}]}';
    const qs = parseQuiz(raw);
    expect(qs).toHaveLength(1);
    expect(qs[0]!.prompt).toBe('Quel animal?');
    expect(qs[0]!.answer).toBe('chien');
  });

  it('tolerates surrounding prose/fences', () => {
    const raw = 'Sure!\n```json\n{"questions":[{"q":"A?","options":["x","y"],"correct":0}]}\n```';
    expect(parseQuiz(raw)[0]!.answer).toBe('x');
  });

  it('drops malformed questions (bad index, too few options)', () => {
    const raw =
      '{"questions":[{"q":"ok","options":["a","b"],"correct":5},{"q":"","options":["a","b"],"correct":0},{"q":"good","options":["a","b","c"],"correct":2}]}';
    const qs = parseQuiz(raw);
    expect(qs).toHaveLength(1);
    expect(qs[0]!.answer).toBe('c');
  });

  it('returns [] when there is no JSON', () => {
    expect(parseQuiz('no json here')).toEqual([]);
  });
});
