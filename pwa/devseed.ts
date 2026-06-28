/**
 * Dev-only demo data so a local release check SHOWS data-driven features
 * (streak, Lernpfad daily cards, quest, vocab deck, completed Etappen …) without
 * first doing a bunch of articles/vocab by hand.
 *
 * Runs ONLY under `vite dev` (import.meta.env.DEV) — a no-op in the production
 * build. Behaviour:
 *   - first visit on an empty dev profile  → auto-seed (localhost is preseeded)
 *   - `…/app/?seed`                        → force re-seed
 *   - `…/app/?fresh`                       → wipe (test onboarding); stays empty on reloads
 *
 * Never touches anything in production.
 */

import { addToDeck } from './deck';

const day = (off = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + off);
  return d.toLocaleDateString('sv'); // YYYY-MM-DD local
};
const tsDays = (off: number): number => Date.now() + off * 86_400_000;

function clearSl(): void {
  for (const k of Object.keys(localStorage)) if (k.startsWith('sl_')) localStorage.removeItem(k);
}

function seedDemo(): void {
  clearSl();
  const set = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));

  set('sl_pwa_settings', { learn: 'fr', native: 'de', level: 'B1', theme: 'jelly', onboarded: true });

  // streak + XP → home hero feels alive
  const days: Record<string, number> = {};
  for (let i = 0; i < 14; i++) days[day(-i)] = 120;
  set('sl_pwa_days', days);

  // mid-level route so the Lernpfad shows completed sublevels AND a current window
  set('sl_pwa_route', { level: 'B1', etappe: 2 });
  set('sl_pwa_milestones', [
    { level: 'B1', etappe: 0, sublevel: 'B1.1', words: 50, articles: 4, ts: tsDays(-8) },
    { level: 'B1', etappe: 1, sublevel: 'B1.2', words: 50, articles: 3, ts: tsDays(-4) },
  ]);

  // daily activity inside the current Etappe window (since the last milestone, -4d)
  set('sl_pwa_daily_log', {
    [day(0)]: { art: 2, voc: 30, gap: 2 },
    [day(-1)]: { art: 1, voc: 12, gap: 0 },
    [day(-2)]: { art: 0, voc: 8, gap: 1 },
    [day(-3)]: { art: 3, voc: 22, gap: 1 },
  });

  set('sl_pwa_quest', { date: day(0), id: 0, tasks: ['article', 'article_plus1'] });

  // a few personal deck words so the Vokabeltest has user words right away
  const words: [string, string][] = [
    ['joueur', 'Spieler'], ['équipe', 'Mannschaft'], ['gagner', 'gewinnen'], ['monde', 'Welt'],
    ['histoire', 'Geschichte'], ['ville', 'Stadt'], ['langue', 'Sprache'], ['semaine', 'Woche'],
  ];
  for (const [w, tr] of words) addToDeck({ word: w, translation: tr, lang: 'fr', ts: Date.now(), band: 'B1' });
}

export function devSeed(): void {
  if (!import.meta.env.DEV) return;
  try {
    const u = new URL(location.href);
    if (u.searchParams.has('fresh')) {
      clearSl();
      localStorage.setItem('dev_fresh', '1'); // survives clearSl (not an sl_ key)
      u.searchParams.delete('fresh');
      history.replaceState(null, '', u.toString());
      return;
    }
    if (u.searchParams.has('seed')) {
      localStorage.removeItem('dev_fresh');
      seedDemo();
      u.searchParams.delete('seed');
      history.replaceState(null, '', u.toString());
      return;
    }
    // auto-seed once on a truly empty dev profile → localhost is preseeded
    if (!localStorage.getItem('sl_pwa_settings') && !localStorage.getItem('dev_fresh')) seedDemo();
  } catch {
    /* ignore */
  }
}
