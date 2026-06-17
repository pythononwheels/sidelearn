/**
 * Per-page cache of simplified paragraphs, so re-scrolling (or revisiting) a
 * page is instant and never re-hits the local model. Keyed by page URL, then by
 * a (lang, level, text-hash) key — changing level/language naturally yields new
 * keys and a fresh simplification.
 */

import { storage } from 'wxt/storage';
import { STORAGE_KEYS, type Language } from './config';

type ByKey = Record<string, string>;
type Cache = Record<string, ByKey>;

const MAX_PAGES = 30;

const item = storage.defineItem<Cache>(STORAGE_KEYS.simplify, { fallback: {} });

/** Stable short hash (djb2) of a paragraph's text. */
function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function cacheKey(lang: Language, level: string, text: string): string {
  return `${lang}:${level}:${hash(text.replace(/\s+/g, ' ').trim())}`;
}

export async function getCached(pageKey: string, key: string): Promise<string | undefined> {
  return (await item.getValue())[pageKey]?.[key];
}

export async function putCached(pageKey: string, key: string, value: string): Promise<void> {
  const all = await item.getValue();
  const page = { ...(all[pageKey] ?? {}), [key]: value };
  await item.setValue(capPages({ ...all, [pageKey]: page }));
}

/** Keep at most MAX_PAGES pages, dropping the oldest-inserted keys. */
function capPages(all: Cache): Cache {
  const keys = Object.keys(all);
  if (keys.length <= MAX_PAGES) return all;
  const copy = { ...all };
  for (const k of keys.slice(0, keys.length - MAX_PAGES)) delete copy[k];
  return copy;
}
