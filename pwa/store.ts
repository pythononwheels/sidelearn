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

/* ---- Backup: export/import all on-device data (privacy-first, stays local) --- */

/** Serialise all Learny localStorage (settings, route, streak, deck, …) to JSON. */
export function exportData(): string {
  const data: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('sl_')) data[k] = localStorage.getItem(k) ?? '';
  }
  return JSON.stringify({ app: 'learny', v: 1, ts: new Date().toISOString(), data }, null, 2);
}

/** Restore from an exported backup. Returns true on success (caller reloads). */
export function importData(json: string): boolean {
  try {
    const o = JSON.parse(json);
    if (!o || typeof o.data !== 'object' || o.data === null) return false;
    for (const [k, v] of Object.entries(o.data)) {
      if (k.startsWith('sl_') && typeof v === 'string') localStorage.setItem(k, v);
    }
    return true;
  } catch {
    return false;
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
