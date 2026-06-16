/**
 * Central configuration — single source of truth.
 *
 * Everything tunable (LLM endpoint, model, supported languages, default level)
 * lives here so it is never duplicated across content script, background and panel.
 */

import type { CefrLevel } from './difficulty/banding';

/** Supported languages (ISO 639-1). Any can be native or learning language. */
export const LANGUAGES = ['fr', 'de', 'en', 'nl'] as const;
export type Language = (typeof LANGUAGES)[number];

/** Endonym labels for the UI (each language in its own name). */
export const LANG_LABELS: Record<Language, string> = {
  fr: 'Français',
  de: 'Deutsch',
  en: 'English',
  nl: 'Nederlands',
};

/** English names, used inside LLM prompts. */
export const LANG_NAMES_EN: Record<Language, string> = {
  fr: 'French',
  de: 'German',
  en: 'English',
  nl: 'Dutch',
};

/** Directed dictionary data file name: learning → native. */
export function dictFile(learn: Language, native: Language): string {
  return `dict-${learn}-${native}.json`;
}

/** Frequency data file name (per learning language). */
export function freqFile(learn: Language): string {
  return `freq-${learn}.json`;
}

/** LM Studio exposes an OpenAI-compatible server. Defaults match its out-of-the-box setup. */
export const LM_STUDIO = {
  /** OpenAI-compatible base (chat/completions, models). */
  baseUrl: 'http://localhost:1234/v1',
  /** Native LM Studio REST base — richer model info (context length, load state). */
  nativeBaseUrl: 'http://localhost:1234/api/v0',
  /** Generation stays short — we explain words and translate paragraphs, not essays. */
  maxTokens: 512,
  temperature: 0.3,
  /**
   * Hard cap on input tokens per call. Keeps latency and RAM predictable: large
   * inputs are split into chunks below this budget rather than sent in one shot.
   * Tunable; see doc/tech/architecture.md.
   */
  maxInputTokens: 5000,
} as const;

/**
 * Models we have tested and approved. The picker shows these (intersected with
 * what LM Studio actually has), and prefers them as default. Other installed
 * models can still be chosen manually but are flagged as untested.
 */
export const APPROVED_MODELS = ['google/gemma-4-e2b', 'google/gemma-4-e4b'] as const;

/** Fallback when no approved model is loaded yet. */
export const DEFAULT_MODEL: string = 'google/gemma-4-e4b';

export interface Settings {
  /** The user's native language — explanations & translations are rendered in it. */
  nativeLang: Language;
  /** The language being learned — the page is read in it. */
  learnLang: Language;
  level: CefrLevel;
  /** Selected LM Studio model id (e.g. "google/gemma-4-e2b"). */
  model: string;
  /** Inline highlighting on the live page (the optional "Kür" layer). */
  inlineEnabled: boolean;
  /** Keep result cards stacked (true) or only show the latest (false). */
  keepResults: boolean;
  /** Adapt the panel body colors to the currently loaded page. */
  adaptToPage: boolean;
  /** False until the first-run onboarding (languages + level) is completed. */
  onboarded: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  nativeLang: 'de',
  learnLang: 'fr',
  level: 'A2',
  model: DEFAULT_MODEL,
  inlineEnabled: true,
  keepResults: true,
  adaptToPage: true,
  onboarded: false,
};

/** Storage keys, centralized to avoid stringly-typed drift. */
export const STORAGE_KEYS = {
  settings: 'local:settings',
  /** Stack of LLM result cards shown in the panel. */
  results: 'local:results',
  /** Palette extracted from the active page, for adaptive panel theming. */
  pageTheme: 'local:pageTheme',
} as const;
