/**
 * Central configuration — single source of truth.
 *
 * Everything tunable (LLM endpoint, model, supported languages, default level)
 * lives here so it is never duplicated across content script, background and panel.
 */

import type { CefrLevel } from './difficulty/banding';

/** Supported languages (ISO 639-1). Any can be native or learning language. */
export const LANGUAGES = ['fr', 'de', 'en', 'nl', 'es', 'it'] as const;
export type Language = (typeof LANGUAGES)[number];

/** Endonym labels for the UI (each language in its own name). */
export const LANG_LABELS: Record<Language, string> = {
  fr: 'Français',
  de: 'Deutsch',
  en: 'English',
  nl: 'Nederlands',
  es: 'Español',
  it: 'Italiano',
};

/** English names, used inside LLM prompts. */
export const LANG_NAMES_EN: Record<Language, string> = {
  fr: 'French',
  de: 'German',
  en: 'English',
  nl: 'Dutch',
  es: 'Spanish',
  it: 'Italian',
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
  /** Show a simplified (level-adapted, same-language) version under each paragraph. */
  simplifyInline: boolean;
  /** Underline colour for marks: 'auto' (by page brightness) or a fixed hex. */
  markerColor: string;
  /** Only underline words that have a dictionary entry (instant translation). */
  markOnlyWithDict: boolean;
  /** Keep result cards stacked (true) or only show the latest (false). */
  keepResults: boolean;
  /** Last-used review mode. */
  reviewMode: 'words' | 'sentences' | 'mix';
  /** Show the daily-challenge card (fetches the Wikipedia featured feed — the
   *  only non-localhost network call). Off keeps Sidelearn fully local. */
  dailyChallenge: boolean;
  /** How many mini-lessons make up the daily challenge. */
  dailySetSize: number;
  /** Use the Sidelearn content server for pre-baked, multi-level lessons. */
  serverEnabled: boolean;
  /** Base URL of the content server. */
  serverUrl: string;
  /** Preferred reading level for server lessons (defaults to `level`). */
  serverLevel: CefrLevel;
  /** False until the first-run onboarding (languages + level) is completed. */
  onboarded: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  nativeLang: 'de',
  learnLang: 'fr',
  level: 'A2',
  model: DEFAULT_MODEL,
  inlineEnabled: true,
  simplifyInline: false,
  markerColor: 'auto',
  markOnlyWithDict: false,
  keepResults: true,
  reviewMode: 'words',
  dailyChallenge: true,
  dailySetSize: 2,
  serverEnabled: true,
  serverUrl: 'https://api.sidelearn.pyrates.io',
  serverLevel: 'A2',
  onboarded: false,
};

/** Marker colour quick-pick: Auto + five fixed, dark-friendly hues. */
export const MARKER_COLORS: ReadonlyArray<{ label: string; value: string }> = [
  { label: 'Auto', value: 'auto' },
  { label: 'Violett', value: '#8b78f0' },
  { label: 'Türkis', value: '#22c0d4' },
  { label: 'Bernstein', value: '#e8b53e' },
  { label: 'Pink', value: '#ec5fa6' },
  { label: 'Grün', value: '#33c995' },
];

/** Storage keys, centralized to avoid stringly-typed drift. */
export const STORAGE_KEYS = {
  settings: 'local:settings',
  /** Stack of LLM result cards shown in the panel. */
  results: 'local:results',
  /** Captured vocabulary (looked-up words) for review. */
  vocab: 'local:vocab',
  /** Whether the side panel is currently open (gates inline marking). */
  panelOpen: 'local:panelOpen',
  /** Bookmarked pages shown in the "Sites" view. */
  bookmarks: 'local:bookmarks',
  /** Per-page chat history. */
  chats: 'local:chats',
  /** Transient "jump to this card" request written by the hover, read by the panel. */
  focus: 'local:focus',
  /** Daily-challenge state: today's article, done flag, and streak. */
  daily: 'local:daily',
  /** Cached per-page simplified paragraphs (level-adapted reading aid). */
  simplify: 'local:simplify',
  /** Learn-app-mode lessons: worked-through daily articles + their content. */
  lessons: 'local:lessons',
} as const;
