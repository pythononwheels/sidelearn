/**
 * Staged learning progress (on-device). Each CEFR reading level is split into 3
 * "Etappen". An Etappe fills with mastery points earned by reading, quizzes,
 * cloze and saved words; once full, the Etappen-Test unlocks. Passing it advances
 * one Etappe — and crossing the third one moves up to the next CEFR level (which
 * the app applies to the reading level).
 *
 * Standards this leans on: CEFR sub-levels (A2.1/A2.2/A2.3 — common in course
 * books) for the staging, and a Yes/No vocabulary check + short reading
 * comprehension for the gate (see LevelTestView).
 */

import { type CefrLevel } from '@/core/difficulty/banding';

// Levels we have server content for, in order (staging stays within these).
export const STAGE_LEVELS: CefrLevel[] = ['A2', 'B1', 'B2', 'C1'];
export const STEPS_PER_LEVEL = 3;
export const STAGE_TARGET = 100; // mastery points to fill one Etappe

// Mastery points per event (separate from daily XP in gamify.ts).
export const MASTERY = { lesson: 40, quizCorrect: 10, clozeCorrect: 6, merken: 3 };

const KEY = 'sl_pwa_stage';

interface StageState {
  baseLevel: CefrLevel; // the reading level this stage belongs to
  step: number; // 1..STEPS_PER_LEVEL
  points: number; // 0..STAGE_TARGET
}

function read(): StageState | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && typeof s.step === 'number') return s as StageState;
  } catch {
    /* ignore */
  }
  return null;
}

function write(s: StageState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/**
 * Current stage, reconciled with the active reading level. If the user changed
 * their reading level manually (or it's the first run), the stage restarts at
 * step 1 of that level.
 */
export function getStage(currentLevel: CefrLevel): StageState {
  const s = read();
  if (!s || s.baseLevel !== currentLevel) {
    const fresh: StageState = { baseLevel: currentLevel, step: 1, points: 0 };
    write(fresh);
    return fresh;
  }
  return s;
}

export interface StageProgress {
  level: CefrLevel;
  step: number;
  steps: number;
  points: number;
  target: number;
  ratio: number; // 0..1 within the current Etappe
  ready: boolean; // Etappe full → test available
  label: string; // e.g. "A2 · Etappe 2/3"
}

export function getProgress(currentLevel: CefrLevel): StageProgress {
  const s = getStage(currentLevel);
  return {
    level: s.baseLevel,
    step: s.step,
    steps: STEPS_PER_LEVEL,
    points: s.points,
    target: STAGE_TARGET,
    ratio: Math.min(1, s.points / STAGE_TARGET),
    ready: s.points >= STAGE_TARGET,
    label: `${s.baseLevel} · Etappe ${s.step}/${STEPS_PER_LEVEL}`,
  };
}

/** Add mastery points to the current Etappe (capped at the target). */
export function creditMastery(currentLevel: CefrLevel, points: number): void {
  if (points <= 0) return;
  const s = getStage(currentLevel);
  s.points = Math.min(STAGE_TARGET, s.points + points);
  write(s);
}

export interface AdvanceResult {
  levelUp: boolean;
  level: CefrLevel; // new reading level (may be unchanged)
  step: number;
}

/**
 * Advance after a passed Etappen-Test. Within a level: step+1. After the last
 * step: move to the next CEFR level (step 1) if one exists. Returns the new
 * stage so the caller can apply a reading-level change.
 */
export function advanceStage(currentLevel: CefrLevel): AdvanceResult {
  const s = getStage(currentLevel);
  if (s.step < STEPS_PER_LEVEL) {
    s.step += 1;
    s.points = 0;
    write(s);
    return { levelUp: false, level: s.baseLevel, step: s.step };
  }
  // last step passed → next level if available
  const idx = STAGE_LEVELS.indexOf(s.baseLevel);
  const next = idx >= 0 && idx < STAGE_LEVELS.length - 1 ? STAGE_LEVELS[idx + 1]! : s.baseLevel;
  const up = next !== s.baseLevel;
  write({ baseLevel: next, step: up ? 1 : STEPS_PER_LEVEL, points: 0 });
  return { levelUp: up, level: next, step: up ? 1 : STEPS_PER_LEVEL };
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
