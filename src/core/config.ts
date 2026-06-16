/**
 * Central configuration — single source of truth.
 *
 * Everything tunable (LLM endpoint, model, supported languages, default level)
 * lives here so it is never duplicated across content script, background and panel.
 */

import type { CefrLevel } from './difficulty/banding';

export interface LangPair {
  /** Language being learned, ISO 639-1. */
  readonly source: 'fr' | 'nl';
  /** Language explanations/translations are rendered in. */
  readonly target: 'de';
  readonly label: string;
}

export const LANG_PAIRS: readonly LangPair[] = [
  { source: 'fr', target: 'de', label: 'Französisch → Deutsch' },
  { source: 'nl', target: 'de', label: 'Niederländisch → Deutsch' },
] as const;

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
  langPair: LangPair['source'];
  level: CefrLevel;
  /** Selected LM Studio model id (e.g. "google/gemma-4-e2b"). */
  model: string;
  /** Inline highlighting on the live page (the optional "Kür" layer). */
  inlineEnabled: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  langPair: 'fr',
  level: 'A2',
  model: DEFAULT_MODEL,
  inlineEnabled: true,
};

/** Storage keys, centralized to avoid stringly-typed drift. */
export const STORAGE_KEYS = {
  settings: 'local:settings',
} as const;
