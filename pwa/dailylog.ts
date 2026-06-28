/**
 * Per-day activity counts (date → {art, voc, gap}) — the data behind the
 * Lernpfad's little daily-summary cards ("28.6. · 2 ART · 30 VOK · 2 LÜC").
 * Counts only what the user actually did; stays on-device. ~180 days kept.
 *   art — articles read   ·   voc — words learned (read-credits + merken)   ·   gap — cloze rounds
 */

const KEY = 'sl_pwa_daily_log';

export interface DayCounts { art: number; voc: number; gap: number }
export interface DayEntry { date: string; counts: DayCounts }
type Log = Record<string, DayCounts>;

/** Local YYYY-MM-DD (matches App's dayStamp). */
const day = (ts = Date.now()): string => new Date(ts).toLocaleDateString('sv');

function read(): Log {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || '{}');
    return o && typeof o === 'object' ? (o as Log) : {};
  } catch {
    return {};
  }
}
function write(l: Log): void {
  try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* ignore */ }
}

/** Add `n` to today's count for `kind`. */
export function bumpDaily(kind: keyof DayCounts, n = 1): void {
  if (n <= 0) return;
  const l = read();
  const d = day();
  const c = l[d] ?? { art: 0, voc: 0, gap: 0 };
  c[kind] = (c[kind] || 0) + n;
  l[d] = c;
  // keep it bounded (oldest first)
  const ks = Object.keys(l).sort();
  while (ks.length > 180) delete l[ks.shift() as string];
  write(l);
}

/** Active days (with any activity) on/after `sinceTs`, oldest→newest, capped to
 *  `limit` (most recent). Used for the current Etappe window. */
export function dailyLogSince(sinceTs: number, limit = 8): DayEntry[] {
  const since = day(sinceTs || 1);
  return Object.entries(read())
    .filter(([d, c]) => d >= since && c.art + c.voc + c.gap > 0)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-limit)
    .map(([date, counts]) => ({ date, counts }));
}
