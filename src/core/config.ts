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
  baseUrl: 'http://localhost:1234/v1',
  /** Start fast; bump to gemma-3n-e4b if quality is insufficient (see doc/tech/architecture.md). */
  model: 'google/gemma-3n-e2b',
  /** Generation stays short — we explain words and translate paragraphs, not essays. */
  maxTokens: 512,
  temperature: 0.3,
} as const;

export interface Settings {
  langPair: LangPair['source'];
  level: CefrLevel;
  /** Inline highlighting on the live page (the optional "Kür" layer). */
  inlineEnabled: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  langPair: 'fr',
  level: 'A2',
  inlineEnabled: true,
};

/** Storage keys, centralized to avoid stringly-typed drift. */
export const STORAGE_KEYS = {
  settings: 'local:settings',
} as const;
