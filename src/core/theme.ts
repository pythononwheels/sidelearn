/**
 * Page theme — a small palette extracted from the active page so the panel can
 * adapt to it. Written by the content script, watched by the panel.
 */

import { storage } from 'wxt/storage';
import { STORAGE_KEYS } from './config';

export interface PageTheme {
  bg: string;
  surface: string;
  border: string;
  text: string;
  textSoft: string;
}

const item = storage.defineItem<PageTheme | null>(STORAGE_KEYS.pageTheme, { fallback: null });

export const getPageTheme = () => item.getValue();
export const setPageTheme = (t: PageTheme) => item.setValue(t);
export const watchPageTheme = (cb: (t: PageTheme | null) => void) => item.watch(cb);
