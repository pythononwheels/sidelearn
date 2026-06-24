/**
 * Per-Etappe achievement snapshots for the Lernpfad — what you actually did to
 * reach a sublevel (words learned, articles read, check passed). Written when an
 * Etappentest is passed; read by the Lernpfad to show a meaningful summary.
 */

export interface Milestone {
  level: string; // CEFR level the Etappe belonged to
  etappe: number; // 0-based index of the Etappe that was completed
  sublevel: string; // e.g. "A1.3"
  words: number; // target words cleared in the Etappe
  articles: number; // articles read during the Etappe
  ts: number;
}

const KEY = 'sl_pwa_milestones';

function read(): Milestone[] {
  try {
    const a = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

export function getMilestones(): Milestone[] {
  return read();
}

export function getMilestone(level: string, etappe: number): Milestone | undefined {
  return read().find((m) => m.level === level && m.etappe === etappe);
}

/** Timestamp of the most recent milestone for a level (Etappe-window start), or 0. */
export function lastMilestoneTs(level: string): number {
  return read().filter((m) => m.level === level).reduce((mx, m) => Math.max(mx, m.ts), 0);
}

export function recordMilestone(m: Milestone): void {
  try {
    const all = read().filter((x) => !(x.level === m.level && x.etappe === m.etappe));
    all.push(m);
    localStorage.setItem(KEY, JSON.stringify(all.slice(-120)));
  } catch {
    /* ignore */
  }
}
