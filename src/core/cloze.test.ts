import { describe, expect, it } from 'vitest';
import { buildClozeFromLemmas, buildClozeQuestions, type LemmaTarget } from './cloze';

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

  it('uses an injected distractor picker when provided', () => {
    const qs = buildClozeQuestions(text, ['canapé'], ['ignored'], () => 0, 10, {
      pickDistractors: () => ['lit', 'fauteuil', 'tabouret'],
    });
    expect(qs).toHaveLength(1);
    expect(qs[0]!.options).toEqual(expect.arrayContaining(['canapé', 'lit', 'fauteuil', 'tabouret']));
    expect(qs[0]!.options).not.toContain('ignored');
  });
});

describe('buildClozeFromLemmas', () => {
  const frText = 'Le boxeur a frappé son adversaire. Il mange une pomme rouge.';
  // Minimal lemmatizer: maps the one inflected surface we care about to its lemma.
  const lemmasOf = (s: string): string[] => {
    const m: Record<string, string> = { frappé: 'frapper', mange: 'manger' };
    const low = s.toLowerCase();
    return m[low] ? [low, m[low]!] : [low];
  };
  const pick = () => ['courir', 'partir', 'manger'];

  it('blanks an inflected surface but tracks the lemma for grading', () => {
    const items = buildClozeFromLemmas(frText, [{ lemma: 'frapper' }], { lemmasOf, pickDistractors: pick, rng: () => 0 });
    expect(items).toHaveLength(1);
    expect(items[0]!.answer).toBe('frappé'); // surface, so the sentence reads correctly
    expect(items[0]!.lemma).toBe('frapper'); // SRS key
    expect(items[0]!.prompt).toContain('____');
    expect(items[0]!.prompt).not.toContain('frappé');
    expect(items[0]!.options).toContain('frappé');
  });

  it('skips lemmas absent from the text', () => {
    const items = buildClozeFromLemmas(frText, [{ lemma: 'voler' }], { lemmasOf, pickDistractors: pick, rng: () => 0 });
    expect(items).toHaveLength(0);
  });

  it('respects max and dedups sentences via the shared used-set', () => {
    const used = new Set<string>();
    const targets: LemmaTarget[] = [{ lemma: 'frapper' }, { lemma: 'manger' }];
    const first = buildClozeFromLemmas(frText, targets, { lemmasOf, pickDistractors: pick, rng: () => 0, max: 1, used });
    expect(first).toHaveLength(1);
    // Second pass with the same used-set must not reuse the first sentence.
    const second = buildClozeFromLemmas(frText, targets, { lemmasOf, pickDistractors: pick, rng: () => 0, used });
    expect(second.every((q) => q.prompt !== first[0]!.prompt)).toBe(true);
  });

  it('drops an item when no distractor is available', () => {
    const items = buildClozeFromLemmas(frText, [{ lemma: 'frapper' }], { lemmasOf, pickDistractors: () => [], rng: () => 0 });
    expect(items).toHaveLength(0);
  });
});
