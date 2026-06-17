/**
 * Daily-challenge state: a small set of articles picked for today, plus a streak
 * of consecutive completed days. Cached per calendar day so we fetch the
 * Wikipedia feed at most once a day (and refetch if the learning language or set
 * size changes). Completion is derived from the lesson store; the streak is
 * credited once all of the day's articles are finished.
 */

import { storage } from 'wxt/storage';
import { STORAGE_KEYS, type Language } from './config';
import { fetchDailyArticles, type DailyArticle } from './wikifeed';

export interface DailyState {
  /** Calendar day (local) the cached set belongs to: 'YYYY-MM-DD'. */
  dateKey: string;
  /** Learning language the set was fetched for. */
  lang: Language;
  /** The day's mini-lesson articles. */
  articles: DailyArticle[];
  /** Last day the challenge (all articles) was completed. */
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
 * Ensure `state` holds today's article set for `learn`, fetching if the day
 * rolled over, the language changed, or fewer than `count` articles are cached.
 * Preserves streak/doneDateKey. Articles may be empty on a network failure.
 */
export async function ensureToday(learn: Language, date: Date, count: number): Promise<DailyState> {
  const today = dateKey(date);
  const prev = await item.getValue();
  if (
    prev &&
    prev.dateKey === today &&
    prev.lang === learn &&
    Array.isArray(prev.articles) &&
    prev.articles.length >= count
  ) {
    return prev;
  }
  const articles = await fetchDailyArticles(learn, date, count);
  const next: DailyState = {
    dateKey: today,
    lang: learn,
    articles,
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
