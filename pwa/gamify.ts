/**
 * Gentle gamification, fully on-device (localStorage). Tracks XP per day, a
 * streak of active days, a level from total XP, and a daily goal. XP is awarded
 * for reading paragraphs, correct quiz answers and completing lessons — each
 * lesson is credited only once so re-reading doesn't farm XP.
 */

const DAYS_KEY = 'sl_pwa_days';
const CREDITED_KEY = 'sl_pwa_credited';

export const XP = { paragraph: 2, correct: 5, lesson: 10 };
export const DAILY_GOAL = 30; // XP per day
const LEVEL_SPAN = 100; // XP per level

export function todayKey(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function shift(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return todayKey(d);
}

type Days = Record<string, number>; // dateKey -> xp

function readDays(): Days {
  try {
    return JSON.parse(localStorage.getItem(DAYS_KEY) || '{}');
  } catch {
    return {};
  }
}
function writeDays(d: Days): void {
  try {
    localStorage.setItem(DAYS_KEY, JSON.stringify(d));
  } catch {
    /* ignore */
  }
}

export function award(xp: number): void {
  if (xp <= 0) return;
  const days = readDays();
  const k = todayKey();
  days[k] = (days[k] || 0) + xp;
  writeDays(days);
}

/** Award a lesson's XP only the first time it's credited. */
export function creditLesson(url: string): boolean {
  let set: string[];
  try {
    set = JSON.parse(localStorage.getItem(CREDITED_KEY) || '[]');
  } catch {
    set = [];
  }
  if (set.includes(url)) return false;
  set.push(url);
  try {
    localStorage.setItem(CREDITED_KEY, JSON.stringify(set.slice(-500)));
  } catch {
    /* ignore */
  }
  return true;
}

export function isLessonCredited(url: string): boolean {
  try {
    return (JSON.parse(localStorage.getItem(CREDITED_KEY) || '[]') as string[]).includes(url);
  } catch {
    return false;
  }
}

export interface Stats {
  totalXp: number;
  level: number;
  intoLevel: number; // xp into the current level
  levelSpan: number;
  streak: number;
  todayXp: number;
  goal: number;
  last7: { key: string; xp: number }[];
}

export function getStats(): Stats {
  const days = readDays();
  const totalXp = Object.values(days).reduce((a, b) => a + b, 0);
  const level = Math.floor(totalXp / LEVEL_SPAN) + 1;
  const intoLevel = totalXp % LEVEL_SPAN;

  // streak: consecutive days with xp>0 ending today or yesterday
  let streak = 0;
  const start = (days[todayKey()] || 0) > 0 ? 0 : -1;
  if ((days[todayKey()] || 0) > 0 || (days[shift(-1)] || 0) > 0) {
    for (let i = start; ; i--) {
      if ((days[shift(i)] || 0) > 0) streak++;
      else break;
    }
  }

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const key = shift(-(6 - i));
    return { key, xp: days[key] || 0 };
  });

  return { totalXp, level, intoLevel, levelSpan: LEVEL_SPAN, streak, todayXp: days[todayKey()] || 0, goal: DAILY_GOAL, last7 };
}
