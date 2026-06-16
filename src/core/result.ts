/**
 * Panel results — stacks of cards keyed by page URL, so each page keeps its own
 * sidebar content. Navigating to a fresh page shows an empty panel; returning to
 * a known page restores its last results. Written by the background worker,
 * watched by the panel.
 */

import { storage } from 'wxt/storage';
import { STORAGE_KEYS } from './config';
import type { WordExplanation } from './types';

export interface PanelResult {
  id: string;
  kind: 'translation' | 'explanation';
  status: 'loading' | 'done' | 'error';
  title: string;
  source?: string;
  translation?: string;
  explanation?: WordExplanation;
  error?: string;
}

type ResultsByPage = Record<string, PanelResult[]>;

const MAX_PER_PAGE = 40;
const MAX_PAGES = 50;

const item = storage.defineItem<ResultsByPage>(STORAGE_KEYS.results, { fallback: {} });

/** Normalize a URL to a cache key (drop the hash; keep path + query). */
export function pageKey(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    return u.href;
  } catch {
    return url;
  }
}

export const watchAllResults = (cb: (r: ResultsByPage) => void) => item.watch(cb);

export async function getResultsFor(key: string): Promise<PanelResult[]> {
  return (await item.getValue())[key] ?? [];
}

export async function pushResult(key: string, result: PanelResult): Promise<void> {
  const all = await item.getValue();
  const list = [result, ...(all[key] ?? [])].slice(0, MAX_PER_PAGE);
  await item.setValue(capPages({ ...all, [key]: list }));
}

export async function updateResult(key: string, id: string, patch: Partial<PanelResult>): Promise<void> {
  const all = await item.getValue();
  const list = (all[key] ?? []).map((r) => (r.id === id ? { ...r, ...patch } : r));
  await item.setValue({ ...all, [key]: list });
}

export async function removeResult(key: string, id: string): Promise<void> {
  const all = await item.getValue();
  const list = (all[key] ?? []).filter((r) => r.id !== id);
  await item.setValue({ ...all, [key]: list });
}

export async function clearResults(key: string): Promise<void> {
  const all = await item.getValue();
  const { [key]: _drop, ...rest } = all;
  await item.setValue(rest);
}

/** Keep at most MAX_PAGES pages, dropping the oldest-inserted keys. */
function capPages(all: ResultsByPage): ResultsByPage {
  const keys = Object.keys(all);
  if (keys.length <= MAX_PAGES) return all;
  const drop = keys.slice(0, keys.length - MAX_PAGES);
  const copy = { ...all };
  for (const k of drop) delete copy[k];
  return copy;
}
