/**
 * Vocabulary-driven learning route (on-device). A CEFR level is reached by
 * acquiring the NEXT level's words (i+1) with spaced repetition:
 *   - a level = 10 Etappen (~1 week each).
 *   - each Etappe assigns a batch of ETAPPE_GOAL next-level target words; you
 *     "clear" them via the Vokabeltest (SRS). When the batch sits, the weekly
 *     Etappentest unlocks. After 10 Etappen the Aufstiegstest promotes you.
 * The actual word-progress lives in the SRS deck (srs.ts); this module tracks
 * which Etappe you're on and handles Etappentest/Aufstieg advancement.
 *
 * Migrated from the old node-sequence model (sl_pwa_route {node}) on read.
 */

import { type CefrLevel } from '@/core/difficulty/banding';

export const STAGE_LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];
export const ETAPPEN_PER_LEVEL = 10;
export const ETAPPE_GOAL = 50; // next-level target words per Etappe (week)
export const TARGETS_PER_LEVEL = ETAPPEN_PER_LEVEL * ETAPPE_GOAL; // 500

/** Activities that can advance the route (only the tests do, now). */
export type NodeType = 'lesson' | 'vocab' | 'cloze' | 'etappentest' | 'aufstieg';

export function nextLevel(level: CefrLevel): CefrLevel {
  const i = STAGE_LEVELS.indexOf(level);
  return i >= 0 && i < STAGE_LEVELS.length - 1 ? STAGE_LEVELS[i + 1]! : level;
}

interface RouteState {
  level: CefrLevel;
  etappe: number; // completed Etappen this level, 0..10 (10 = ready for Aufstieg)
}

const KEY = 'sl_pwa_route';
const OLD_KEY = 'sl_pwa_stage';

function read(): RouteState | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && s.level && typeof s.etappe === 'number') return s as RouteState;
    // Migrate the older node-sequence model ({level, node}, 30 nodes / 3 per Etappe).
    if (s && s.level && typeof s.node === 'number') {
      return { level: s.level, etappe: Math.min(ETAPPEN_PER_LEVEL, Math.floor(s.node / 3)) };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function write(s: RouteState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

function migrate(): RouteState | null {
  try {
    const old = JSON.parse(localStorage.getItem(OLD_KEY) || 'null');
    if (old && old.baseLevel) {
      const step = typeof old.step === 'number' ? old.step : 1;
      return { level: old.baseLevel, etappe: Math.min(ETAPPEN_PER_LEVEL, step - 1) };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Current route state, reconciled with the active reading level (manual level
 * change restarts the route at that level). */
export function getRoute(currentLevel: CefrLevel): RouteState {
  let s = read() ?? migrate() ?? { level: currentLevel, etappe: 0 };
  if (s.level !== currentLevel) s = { level: currentLevel, etappe: 0 };
  s.etappe = Math.max(0, Math.min(ETAPPEN_PER_LEVEL, s.etappe));
  write(s);
  return s;
}

/** [start, end) index range into the level's ordered next-level target words. */
export function batchRange(etappe: number): [number, number] {
  const start = Math.min(etappe, ETAPPEN_PER_LEVEL - 1) * ETAPPE_GOAL;
  return [start, start + ETAPPE_GOAL];
}

export interface RouteProgress {
  level: CefrLevel;
  etappe: number; // 0-based index of the current Etappe (0..10)
  etappeDisplay: number; // 1..10 for UI
  atAufstieg: boolean; // all 10 Etappen done → Aufstiegstest is the next step
  nextLevel: CefrLevel;
  label: string; // "A2 · Etappe 3/10" or "A2 · Aufstieg"
}

export function getRouteProgress(currentLevel: CefrLevel): RouteProgress {
  const s = getRoute(currentLevel);
  const atAufstieg = s.etappe >= ETAPPEN_PER_LEVEL;
  return {
    level: s.level,
    etappe: s.etappe,
    etappeDisplay: Math.min(s.etappe + 1, ETAPPEN_PER_LEVEL),
    atAufstieg,
    nextLevel: nextLevel(s.level),
    label: atAufstieg ? `${s.level} · Aufstieg` : `${s.level} · Etappe ${s.etappe + 1}/${ETAPPEN_PER_LEVEL}`,
  };
}

export interface CompleteResult {
  advanced: boolean;
  etappeDone: boolean;
  levelUp: boolean;
  level: CefrLevel;
}

/** Advance the route. Only the tests move it now:
 *  - 'etappentest' → next Etappe (caller ensures the weekly word goal is met).
 *  - 'aufstieg'    → level up (only when all 10 Etappen are done).
 *  Everything else is a no-op (lessons/vocab/cloze give XP but don't advance). */
export function completeActivity(currentLevel: CefrLevel, type: NodeType): CompleteResult {
  const s = getRoute(currentLevel);
  const idle: CompleteResult = { advanced: false, etappeDone: false, levelUp: false, level: s.level };
  if (type === 'etappentest' && s.etappe < ETAPPEN_PER_LEVEL) {
    write({ level: s.level, etappe: s.etappe + 1 });
    return { advanced: true, etappeDone: true, levelUp: false, level: s.level };
  }
  if (type === 'aufstieg' && s.etappe >= ETAPPEN_PER_LEVEL) {
    const next = nextLevel(s.level);
    write({ level: next, etappe: 0 });
    return { advanced: true, etappeDone: true, levelUp: next !== s.level, level: next };
  }
  return idle;
}

/** Frequency-rank window [lo, hi] for a CEFR band (1-based ranks). */
export function bandRankRange(level: CefrLevel): [number, number] {
  const T: Record<string, [number, number]> = {
    A1: [1, 750],
    A2: [751, 1500],
    B1: [1501, 3000],
    B2: [3001, 6000],
    C1: [6001, 12000],
    C2: [12001, 40000],
  };
  return T[level] ?? [751, 1500];
}
