/**
 * Panel results — a stack of cards the side panel renders (newest first).
 *
 * The right-click context menu (translate / explain) and the hover "more" write
 * here via the background worker; the panel watches it. Storage-backed so the
 * stack survives the panel closing and decouples producer from consumer.
 *
 * Whether new results accumulate or replace the previous one is controlled by
 * the `keepResults` setting (the caller clears first when it is off).
 */

import { storage } from 'wxt/storage';
import { STORAGE_KEYS } from './config';
import type { WordExplanation } from './types';

export interface PanelResult {
  id: string;
  kind: 'translation' | 'explanation';
  status: 'loading' | 'done' | 'error';
  /** Heading shown on the card (the word, or "Übersetzung"). */
  title: string;
  source?: string;
  translation?: string;
  explanation?: WordExplanation;
  error?: string;
}

/** Cap the stack so storage stays bounded. */
const MAX_RESULTS = 40;

const item = storage.defineItem<PanelResult[]>(STORAGE_KEYS.results, { fallback: [] });

export const getResults = () => item.getValue();
export const watchResults = (cb: (r: PanelResult[]) => void) => item.watch(cb);
export const clearResults = () => item.setValue([]);

/** Add a new card to the top of the stack. */
export async function pushResult(result: PanelResult): Promise<void> {
  const current = await item.getValue();
  await item.setValue([result, ...current].slice(0, MAX_RESULTS));
}

/** Patch an existing card by id (e.g. loading → done). */
export async function updateResult(id: string, patch: Partial<PanelResult>): Promise<void> {
  const current = await item.getValue();
  await item.setValue(current.map((r) => (r.id === id ? { ...r, ...patch } : r)));
}

/** Remove a single card (the per-card ×). */
export async function removeResult(id: string): Promise<void> {
  const current = await item.getValue();
  await item.setValue(current.filter((r) => r.id !== id));
}
