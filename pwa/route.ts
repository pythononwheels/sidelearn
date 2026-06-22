/**
 * Staged learning progress as a **typed node route** (on-device). Each CEFR level
 * is a sequence of 10 Etappen × 3 nodes = 30 nodes. Node types repeat per Etappe:
 *   pos 0 → lesson, pos 1 → vocab/cloze (alternating), pos 2 → etappentest
 * The last Etappe's test is the full Aufstiegstest, which levels you up.
 * A node is completed by doing its matching activity (see completeActivity).
 *
 * Replaces the old points-based 3-Etappen model (sl_pwa_stage); migrated on read.
 */

import { type CefrLevel } from '@/core/difficulty/banding';

export const STAGE_LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];
export const ETAPPEN_PER_LEVEL = 10;
export const NODES_PER_ETAPPE = 3;
export const NODES_PER_LEVEL = ETAPPEN_PER_LEVEL * NODES_PER_ETAPPE; // 30

export type NodeType = 'lesson' | 'vocab' | 'cloze' | 'etappentest' | 'aufstieg';

/** The node type at index i (0..29) within a level. */
export function nodeType(_level: CefrLevel, i: number): NodeType {
  const etappe = Math.floor(i / NODES_PER_ETAPPE);
  const pos = i % NODES_PER_ETAPPE;
  if (pos === 0) return 'lesson';
  if (pos === 1) return etappe % 2 === 0 ? 'vocab' : 'cloze';
  return etappe === ETAPPEN_PER_LEVEL - 1 ? 'aufstieg' : 'etappentest';
}

export function nextLevel(level: CefrLevel): CefrLevel {
  const i = STAGE_LEVELS.indexOf(level);
  return i >= 0 && i < STAGE_LEVELS.length - 1 ? STAGE_LEVELS[i + 1]! : level;
}

interface RouteState {
  level: CefrLevel;
  node: number; // completed-count = index of the current node (0..NODES_PER_LEVEL)
}

const KEY = 'sl_pwa_route';
const OLD_KEY = 'sl_pwa_stage';

function read(): RouteState | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && typeof s.node === 'number' && s.level) return s as RouteState;
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

/** Migrate the old 3-Etappen stage model, if present, to the node route. */
function migrate(): RouteState | null {
  try {
    const old = JSON.parse(localStorage.getItem(OLD_KEY) || 'null');
    if (old && old.baseLevel) {
      const step = typeof old.step === 'number' ? old.step : 1;
      return { level: old.baseLevel, node: Math.min(NODES_PER_LEVEL - 1, (step - 1) * NODES_PER_ETAPPE) };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Current route state, reconciled with the active reading level. A manual reading
 * level change restarts the route at that level (node 0).
 */
export function getRoute(currentLevel: CefrLevel): RouteState {
  let s = read() ?? migrate() ?? { level: currentLevel, node: 0 };
  if (s.level !== currentLevel) s = { level: currentLevel, node: 0 };
  write(s);
  return s;
}

export interface RouteProgress {
  level: CefrLevel;
  node: number;
  etappe: number; // 1..10
  pos: number; // 0..NODES_PER_ETAPPE-1
  nodeType: NodeType;
  ratio: number; // progress within current Etappe (0..1)
  label: string; // "A2 · Etappe 3/10"
  ready: boolean; // current node is a test (etappentest/aufstieg)
  levelDone: boolean;
}

export function getRouteProgress(currentLevel: CefrLevel): RouteProgress {
  const s = getRoute(currentLevel);
  const levelDone = s.node >= NODES_PER_LEVEL;
  const node = Math.min(s.node, NODES_PER_LEVEL - 1);
  const etappe = Math.floor(node / NODES_PER_ETAPPE);
  const pos = node % NODES_PER_ETAPPE;
  const t = nodeType(s.level, node);
  return {
    level: s.level,
    node: s.node,
    etappe: etappe + 1,
    pos,
    nodeType: t,
    ratio: pos / NODES_PER_ETAPPE,
    label: `${s.level} · Etappe ${etappe + 1}/${ETAPPEN_PER_LEVEL}`,
    ready: t === 'etappentest' || t === 'aufstieg',
    levelDone,
  };
}

export interface CompleteResult {
  advanced: boolean;
  etappeDone: boolean; // finished an Etappe (completed its test)
  levelUp: boolean;
  level: CefrLevel; // (possibly new) level after completion
  node: number;
}

/**
 * Mark the current node done if `type` matches it. Completing the last node
 * (the Aufstiegstest) levels up. No-op if it doesn't match — non-matching
 * activities still give XP elsewhere, they just don't advance the route.
 */
export function completeActivity(currentLevel: CefrLevel, type: NodeType): CompleteResult {
  const s = getRoute(currentLevel);
  const idle: CompleteResult = { advanced: false, etappeDone: false, levelUp: false, level: s.level, node: s.node };
  if (s.node >= NODES_PER_LEVEL) return idle;
  if (nodeType(s.level, s.node) !== type) return idle;

  const etappeDone = s.node % NODES_PER_ETAPPE === NODES_PER_ETAPPE - 1;
  const wasLast = s.node === NODES_PER_LEVEL - 1; // the Aufstiegstest
  if (wasLast) {
    const next = nextLevel(s.level);
    const levelUp = next !== s.level;
    write({ level: next, node: levelUp ? 0 : NODES_PER_LEVEL });
    return { advanced: true, etappeDone: true, levelUp, level: next, node: levelUp ? 0 : NODES_PER_LEVEL };
  }
  write({ level: s.level, node: s.node + 1 });
  return { advanced: true, etappeDone, levelUp: false, level: s.level, node: s.node + 1 };
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
