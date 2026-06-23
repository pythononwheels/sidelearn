/**
 * Pseudo-words (plausible-looking non-words) per language for the Yes/No
 * vocabulary test. Marking these "known" indicates over-claiming, so they act as
 * a reliability control. Curated by hand to follow each language's spelling
 * patterns while not being real words; heuristic, not exhaustive.
 */

import { type Language } from '@/core/config';

export const PSEUDO_WORDS: Record<Language, string[]> = {
  fr: ['blourge', 'frantil', 'vondace', 'miclard', 'pertanche', 'soudrin', 'treuche', 'garnipe', 'lourmet', 'bachive', 'crontel', 'velpoin'],
  de: ['blorken', 'drimsel', 'grunzwal', 'morfeln', 'traxine', 'welbicht', 'zarpfen', 'flundrig', 'narbeit', 'krummsel', 'spelzern', 'wachtorf'],
  en: ['blorient', 'fendle', 'trabish', 'morved', 'glunter', 'snarvle', 'frelth', 'wandic', 'plorse', 'gantel', 'rivolt', 'sclemp'],
  nl: ['blorken', 'fretsel', 'groemte', 'knorvel', 'spreuze', 'wandoek', 'treugel', 'florsem', 'krabsem', 'vlonter', 'gespruik', 'darnel'],
  es: ['blorgar', 'fentil', 'tracimo', 'morvado', 'gluntar', 'narvol', 'feldro', 'treuco', 'bardine', 'colpez', 'rensal', 'pludria'],
  it: ['blorgare', 'fentilo', 'tracimo', 'morvato', 'gluntare', 'narvolo', 'feldro', 'treuco', 'bardino', 'colpezzo', 'rensale', 'pludria'],
};

export function pseudoWordsFor(lang: Language): string[] {
  return PSEUDO_WORDS[lang] ?? [];
}
