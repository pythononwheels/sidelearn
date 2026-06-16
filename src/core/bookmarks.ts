/**
 * Bookmarked pages — a curated list the user keeps ("Seite merken"), shown in
 * the Sites view. Keyed by the same page key as the result cache, so a bookmark
 * and its cached results line up.
 */

import { storage } from 'wxt/storage';
import { STORAGE_KEYS } from './config';

export interface Bookmark {
  /** Page key (normalized URL) — also the result-cache key. */
  url: string;
  title: string;
  favIconUrl?: string;
  /** A markant page colour (theme-color meta / body bg). */
  color?: string;
  ts: number;
}

const item = storage.defineItem<Bookmark[]>(STORAGE_KEYS.bookmarks, { fallback: [] });

export const getBookmarks = () => item.getValue();
export const watchBookmarks = (cb: (b: Bookmark[]) => void) => item.watch(cb);

export async function addBookmark(bookmark: Bookmark): Promise<void> {
  const current = await item.getValue();
  const rest = current.filter((b) => b.url !== bookmark.url);
  await item.setValue([bookmark, ...rest]);
}

export async function removeBookmark(url: string): Promise<void> {
  const current = await item.getValue();
  await item.setValue(current.filter((b) => b.url !== url));
}
