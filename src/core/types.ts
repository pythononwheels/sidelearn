import type { CefrLevel } from './difficulty/banding';

/** A single dictionary sense for a headword (from FreeDict). */
export interface DictSense {
  translations: string[];
  note?: string;
}

/** Result of the instant, LLM-free word lookup (Stages 1–2). */
export interface WordInfo {
  word: string;
  /** Base/dictionary form if it differs from the surface form. */
  lemma?: string;
  band: CefrLevel;
  /** Whether the word is above the learner's level. */
  challenging: boolean;
  senses: DictSense[];
}

/** Richer, on-demand explanation produced by the local LLM (Stage 3). */
export interface WordExplanation {
  word: string;
  meaning: string;
  examples: string[];
  synonyms: string[];
  grammarNote?: string;
}

/** On-demand paragraph translation (Stage 4). */
export interface ParagraphTranslation {
  source: string;
  translation: string;
}
