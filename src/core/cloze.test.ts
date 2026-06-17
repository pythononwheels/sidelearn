import { describe, expect, it } from 'vitest';
import { buildClozeQuestions } from './cloze';

const text =
  'Le chat dort sur le canapé. Les entreprises utilisent la plateforme. ' +
  'La maison est grande et belle aujourd’hui.';

describe('buildClozeQuestions', () => {
  it('blanks the target word and keeps it as the answer', () => {
    const qs = buildClozeQuestions(text, ['canapé'], ['chat', 'maison', 'plateforme', 'canapé'], () => 0);
    expect(qs).toHaveLength(1);
    expect(qs[0]!.answer).toBe('canapé');
    expect(qs[0]!.prompt).toContain('____');
    expect(qs[0]!.prompt).not.toContain('canapé');
    expect(qs[0]!.options).toContain('canapé');
  });

  it('skips words not present on the page', () => {
    expect(buildClozeQuestions(text, ['inexistant'], ['a', 'b', 'c', 'd'], () => 0)).toHaveLength(0);
  });

  it('respects the max', () => {
    const qs = buildClozeQuestions(text, ['chat', 'maison'], ['chat', 'maison', 'x', 'y'], () => 0, 1);
    expect(qs).toHaveLength(1);
  });
});
