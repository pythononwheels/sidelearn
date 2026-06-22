/**
 * On-device persistence for the PWA (privacy-first: nothing leaves the device).
 * localStorage is plenty for v1; can move to IndexedDB later.
 */

import { type Language } from '@/core/config';
import { type CefrLevel } from '@/core/difficulty/banding';
import { type ThemeId, isThemeId } from './theme';

export interface PwaSettings {
  learn: Language;
  native: Language;
  level: CefrLevel;
  theme: ThemeId;
  onboarded: boolean;
}

const SETTINGS_KEY = 'sl_pwa_settings';
const PROGRESS_KEY = 'sl_pwa_progress';

const DEFAULTS: PwaSettings = { learn: 'fr', native: 'de', level: 'A2', theme: 'jelly', onboarded: false };

export function getSettings(): PwaSettings {
  try {
    const s = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
    // Migrate a retired theme (e.g. old 'warm'/'mint'/…) to the default.
    if (!isThemeId(s.theme)) s.theme = DEFAULTS.theme;
    return s;
  } catch {
    return DEFAULTS;
  }
}

export function saveSettings(s: PwaSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export interface LessonProgress {
  progress: number; // furthest paragraph revealed (1-based)
  completed: boolean;
  answered: number;
  correct: number;
}

type ProgressMap = Record<string, LessonProgress>;

function readProgress(): ProgressMap {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
  } catch {
    return {};
  }
}

export function getProgress(url: string): LessonProgress | undefined {
  return readProgress()[url];
}

export function isCompleted(url: string): boolean {
  return !!readProgress()[url]?.completed;
}

export function saveProgress(url: string, p: LessonProgress): void {
  try {
    const all = readProgress();
    all[url] = p;
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}
