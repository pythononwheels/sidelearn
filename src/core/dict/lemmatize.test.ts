import { describe, expect, it } from 'vitest';
import { lemmaCandidates } from './lemmatize';

describe('lemmaCandidates', () => {
  it('keeps the exact form first', () => {
    expect(lemmaCandidates('champion', 'fr')[0]).toBe('champion');
  });

  it('reduces French plurals to the singular', () => {
    expect(lemmaCandidates('champions', 'fr')).toContain('champion');
    expect(lemmaCandidates('maisons', 'fr')).toContain('maison');
    expect(lemmaCandidates('chevaux', 'fr')).toContain('cheval');
  });

  it('reduces French participles to the infinitive', () => {
    expect(lemmaCandidates('utilisant', 'fr')).toContain('utiliser'); // participe présent
    expect(lemmaCandidates('publié', 'fr')).toContain('publier'); // participe passé
    expect(lemmaCandidates('référencée', 'fr')).toContain('référencer');
  });

  it('reduces English plurals and -ies', () => {
    expect(lemmaCandidates('cities', 'en')).toContain('city');
    expect(lemmaCandidates('dogs', 'en')).toContain('dog');
  });

  it('reduces Dutch and German plural endings', () => {
    expect(lemmaCandidates('huizens', 'nl')).toContain('huizen');
    expect(lemmaCandidates('kinder', 'de')).toContain('kind');
  });
});
