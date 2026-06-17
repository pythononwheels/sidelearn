/**
 * Daily-challenge state: the article picked for today, whether it's done, and a
 * streak of consecutive completed days. Cached per calendar day so we fetch the
 * Wikipedia feed at most once a day (and refetch if the learning language
 * changes). Streak survives across days; `done` resets each new day.
 */

import { storage } from 'wxt/storage';
import { STORAGE_KEYS, type Language } from './config';
import { fetchDailyArticle, type DailyArticle } from './wikifeed';

export interface DailyState {
  /** Calendar day (local) the cached article belongs to: 'YYYY-MM-DD'. */
  dateKey: string;
  /** Learning language the article was fetched for. */
  lang: Language;
  article: DailyArticle | null;
  /** Last day the challenge was marked done. */
  doneDateKey?: string;
  /** Consecutive completed days, as of doneDateKey. */
  streak: number;
}

const item = storage.defineItem<DailyState | null>(STORAGE_KEYS.daily, { fallback: null });

/** Local 'YYYY-MM-DD' for a date. */
export function dateKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

function shiftKey(date: Date, days: number): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  return dateKey(d);
}

export const watchDaily = (cb: (s: DailyState | null) => void) => item.watch(cb);
export async function getDaily(): Promise<DailyState | null> {
  return item.getValue();
}

/** True when today's challenge has already been completed. */
export function isDoneToday(state: DailyState | null, date: Date): boolean {
  return !!state && state.doneDateKey === dateKey(date);
}

/** The live streak to display: kept alive only if done today or yesterday. */
export function activeStreak(state: DailyState | null, date: Date): number {
  if (!state || !state.doneDateKey) return 0;
  if (state.doneDateKey === dateKey(date) || state.doneDateKey === shiftKey(date, -1)) {
    return state.streak;
  }
  return 0; // streak broken (missed a day)
}

/**
 * Ensure `state` holds today's article for `learn`, fetching if the day rolled
 * over or the language changed. Preserves streak/doneDateKey. Returns the
 * (possibly refetched) state; the article may be null on a network failure.
 */
export async function ensureToday(learn: Language, date: Date): Promise<DailyState> {
  const today = dateKey(date);
  const prev = await item.getValue();
  if (prev && prev.dateKey === today && prev.lang === learn && prev.article) {
    return prev;
  }
  const article = await fetchDailyArticle(learn, date);
  const next: DailyState = {
    dateKey: today,
    lang: learn,
    article,
    doneDateKey: prev?.doneDateKey,
    streak: prev?.streak ?? 0,
  };
  await item.setValue(next);
  return next;
}

/** Mark today's challenge done, advancing the streak (idempotent per day). */
export async function markDoneToday(date: Date): Promise<DailyState | null> {
  const prev = await item.getValue();
  if (!prev) return null;
  const today = dateKey(date);
  if (prev.doneDateKey === today) return prev; // already counted today
  const continues = prev.doneDateKey === shiftKey(date, -1);
  const next: DailyState = {
    ...prev,
    doneDateKey: today,
    streak: continues ? prev.streak + 1 : 1,
  };
  await item.setValue(next);
  return next;
}
