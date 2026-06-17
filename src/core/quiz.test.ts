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

  it('coerces "correct" given as a numeric string', () => {
    const raw = '{"questions":[{"q":"A?","options":["x","y","z"],"correct":"2"}]}';
    expect(parseQuiz(raw)[0]!.answer).toBe('z');
  });

  it('accepts a letter answer (B → index 1)', () => {
    const raw = '{"questions":[{"q":"A?","options":["x","y","z"],"correct":"B"}]}';
    expect(parseQuiz(raw)[0]!.answer).toBe('y');
  });

  it('accepts the answer given as option text', () => {
    const raw = '{"questions":[{"q":"A?","options":["chat","chien"],"answer":"chien"}]}';
    expect(parseQuiz(raw)[0]!.answer).toBe('chien');
  });

  it('accepts alternative keys and object-shaped options', () => {
    const raw =
      '{"quiz":[{"question":"A?","choices":[{"text":"x"},{"text":"y"}],"correctIndex":1}]}';
    expect(parseQuiz(raw)[0]!.answer).toBe('y');
  });

  it('salvages complete questions from truncated JSON', () => {
    // Second question is cut off mid-object; the first must still parse.
    const raw =
      '{"questions":[{"q":"One?","options":["a","b"],"correct":0},{"q":"Two?","options":["c","d"';
    const qs = parseQuiz(raw);
    expect(qs).toHaveLength(1);
    expect(qs[0]!.answer).toBe('a');
  });
});
