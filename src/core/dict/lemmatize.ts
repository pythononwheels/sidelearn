/**
 * Lightweight lemmatization for dictionary lookups.
 *
 * FreeDict headwords are base forms, but pages contain inflected words
 * ("champions", "maisons"). Rather than ship a full morphology resource, we
 * generate a handful of candidate base forms per language and let the lookup
 * try them in order (exact form first, so correct entries always win).
 *
 * This is deliberately simple — it catches the common plural/verb cases that
 * caused most "no dictionary entry" misses, not every irregular form.
 */

import type { Language } from '../config';

/** Ordered candidate forms for `word` (already normalized lowercase). */
export function lemmaCandidates(word: string, lang: Language): string[] {
  const out = new Set<string>([word]);
  const add = (s: string) => {
    if (s.length >= 2) out.add(s);
  };
  const ends = (s: string) => word.endsWith(s);

  switch (lang) {
    case 'fr':
      if (ends('aux')) add(word.slice(0, -3) + 'al'); // chevaux → cheval
      if (ends('x')) add(word.slice(0, -1)); // -x plural
      if (ends('s')) add(word.slice(0, -1)); // -s plural
      if (ends('e')) add(word.slice(0, -1)); // feminine → masculine
      break;
    case 'nl':
      if (ends('en')) add(word.slice(0, -2)); // huizen → huiz… (best effort)
      if (ends('s')) add(word.slice(0, -1));
      break;
    case 'en':
      if (ends('ies')) add(word.slice(0, -3) + 'y'); // cities → city
      if (ends('es')) add(word.slice(0, -2));
      if (ends('s')) add(word.slice(0, -1));
      if (ends('ing')) add(word.slice(0, -3)); // running → runn… (best effort)
      if (ends('ed')) add(word.slice(0, -2));
      break;
    case 'de':
      if (ends('en')) add(word.slice(0, -2));
      if (ends('er')) add(word.slice(0, -2));
      if (ends('e')) add(word.slice(0, -1));
      if (ends('s')) add(word.slice(0, -1));
      break;
  }
  return [...out];
}
