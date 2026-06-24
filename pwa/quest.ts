/**
 * Daily quest — a small combo of two tasks, chosen deterministically from the
 * date so it is stable for the whole day (no re-roll on app start) and identical
 * across reloads/devices. Task completion is derived from the per-day "done"
 * flags in App (dailyDone), so any way of finishing a task — guided or
 * self-initiated — ticks the quest; off-combo activities count as bonus.
 */

import { todayKey } from './gamify';

export type QuestTask = 'article' | 'article_plus1' | 'cloze' | 'vocab' | 'rubrik';

export interface Quest {
  date: string;
  id: number;
  tasks: QuestTask[];
}

// Each combo is two tasks. Kept varied so the daily rhythm changes day to day.
const COMBOS: QuestTask[][] = [
  ['article', 'article_plus1'], // Doppel-Lesen (1 + 1× ein Level höher)
  ['cloze', 'vocab'],           // Lücken & Vokabeln
  ['rubrik', 'cloze'],          // Entdecken & Lücken
  ['article_plus1', 'vocab'],   // Challenge: höheres Level lesen & Vokabeln
  ['article', 'rubrik'],        // Lesetag: Tageslektion & eine Rubrik
];

const KEY = 'sl_pwa_quest';

// Small stable string hash → combo index. Same date → same combo, always.
function hashDate(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Today's quest. Frozen on first call of the day (stored), so editing COMBOS
 * later never reshuffles a day already in progress. */
export function getTodayQuest(): Quest {
  const date = todayKey();
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null') as Quest | null;
    if (saved && saved.date === date && Array.isArray(saved.tasks)) return saved;
  } catch { /* ignore */ }
  const id = hashDate(date) % COMBOS.length;
  const tasks: QuestTask[] = COMBOS[id] ?? ['article', 'cloze'];
  const quest: Quest = { date, id, tasks };
  try { localStorage.setItem(KEY, JSON.stringify(quest)); } catch { /* ignore */ }
  return quest;
}
