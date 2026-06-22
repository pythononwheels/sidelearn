/**
 * On-device activity log — the chronological trail behind the Lernroute: which
 * lessons were read and how the Etappen-Tests went. Newest entries kept, capped.
 */

export type ActivityType = 'lesson' | 'test' | 'levelup';

export interface Activity {
  id: string;
  type: ActivityType;
  ts: number;
  level: string;
  title?: string; // lesson title
  ok?: boolean; // test passed?
  detail?: string; // e.g. "Quiz 2/3" or new level label
}

const KEY = 'sl_pwa_activity';
const CAP = 100;

function read(): Activity[] {
  try {
    const a = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

/** Append an event (id + ts filled in). Returns nothing. */
export function logActivity(e: Omit<Activity, 'id' | 'ts'> & { ts?: number }): void {
  try {
    const ts = e.ts ?? Date.now();
    const id = `${ts}-${Math.random().toString(36).slice(2, 7)}`;
    const all = read();
    all.push({ ...e, ts, id });
    localStorage.setItem(KEY, JSON.stringify(all.slice(-CAP)));
  } catch {
    /* ignore */
  }
}

/** Most recent first. */
export function getActivity(): Activity[] {
  return read().sort((a, b) => b.ts - a.ts);
}
