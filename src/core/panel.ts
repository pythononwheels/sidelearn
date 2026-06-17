/**
 * Which browser windows currently have the side panel open. The panel opens a
 * runtime port named `panel:<windowId>`; the background adds/removes the id.
 * The content script marks only when its own window is in this set, so marking
 * doesn't bleed into other windows that have no panel open.
 */

import { storage } from 'wxt/storage';
import { STORAGE_KEYS } from './config';

const item = storage.defineItem<number[]>(STORAGE_KEYS.panelOpen, { fallback: [] });

export const getOpenWindows = () => item.getValue();
export const watchOpenWindows = (cb: (ids: number[]) => void) => item.watch(cb);
export const clearOpenWindows = () => item.setValue([]);

export async function addOpenWindow(id: number): Promise<void> {
  const ids = await item.getValue();
  if (!ids.includes(id)) await item.setValue([...ids, id]);
}

export async function removeOpenWindow(id: number): Promise<void> {
  const ids = await item.getValue();
  await item.setValue(ids.filter((x) => x !== id));
}
