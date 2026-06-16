/**
 * Settings persistence via WXT's storage helper. Centralizes read/write so the
 * default-merging logic lives in exactly one place.
 */

import { storage } from 'wxt/storage';
import { DEFAULT_SETTINGS, STORAGE_KEYS, type Settings } from './config';

const item = storage.defineItem<Settings>(STORAGE_KEYS.settings, {
  fallback: DEFAULT_SETTINGS,
});

export async function getSettings(): Promise<Settings> {
  return item.getValue();
}

export async function setSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await item.getValue()), ...patch };
  await item.setValue(next);
  return next;
}

export function watchSettings(cb: (s: Settings) => void): () => void {
  return item.watch(cb);
}
