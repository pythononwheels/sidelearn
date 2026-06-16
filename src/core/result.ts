/**
 * Shared "panel result" — the single slot the side panel renders.
 *
 * Both the right-click context menu (translate selection) and the hover "more"
 * (explain word) write here via the background worker; the panel watches it.
 * Using storage means the result survives the panel being closed/reopened and
 * decouples producer (background) from consumer (panel).
 */

import { storage } from 'wxt/storage';
import { STORAGE_KEYS } from './config';
import type { WordExplanation } from './types';

export interface PanelResult {
  kind: 'translation' | 'explanation';
  status: 'loading' | 'done' | 'error';
  /** Heading shown in the panel (the word, or "Übersetzung"). */
  title: string;
  source?: string;
  translation?: string;
  explanation?: WordExplanation;
  error?: string;
}

const item = storage.defineItem<PanelResult | null>(STORAGE_KEYS.result, { fallback: null });

export const getResult = () => item.getValue();
export const setResult = (r: PanelResult) => item.setValue(r);
export const clearResult = () => item.setValue(null);
export const watchResult = (cb: (r: PanelResult | null) => void) => item.watch(cb);
