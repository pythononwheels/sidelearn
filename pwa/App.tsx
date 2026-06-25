/**
 * Learny — mobile PWA (part of the Sidelearn family). Server-powered (no local
 * LLM): the daily
 * challenge and lessons come pre-baked from the content server; word lookups use
 * the bundled dictionary. Personal progress stays on-device.
 */

import { type ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { LANGUAGES, LANG_LABELS, type Language } from '@/core/config';
import { CEFR_LEVELS, isAboveLevel, rankToBand, type CefrLevel } from '@/core/difficulty/banding';
import { loadRanks, rankOf, normalize } from '@/core/difficulty/frequency';
import { lemmaCandidates } from '@/core/dict/lemmatize';
import { loadNames } from '@/core/names';
import { resolveWord } from '@/core/wordinfo';
import { lookup, richLookup, loadRichDict, loadForms, type RichEntry, type RichSense } from '@/core/dict/freedict';
import {
  fetchServerArchive,
  fetchServerDaily,
  fetchSentenceTranslation,
  fetchServerLesson,
  fetchSurprise,
  fetchAreaList,
  fetchWordTranslation,
  fetchDigest,
  type ServerDaily,
  type ServerLesson,
  type AreaArticle,
} from '@/core/serverapi';
import { buildClozeQuestions } from '@/core/cloze';
import { type QuizQuestion } from '@/core/quiz';
import { getSettings, saveSettings, getProgress, isCompleted, saveProgress, exportData, importData, type PwaSettings } from './store';
import { award, creditLesson, isLessonCredited, getStats, XP } from './gamify';
import { addToDeck, getDeck, inDeck, removeFromDeck } from './deck';
import { seedVocab, nextLevelTargets, type SeedWord } from './seedvocab';
import { THEMES, applyTheme } from './theme';
import {
  bandRankRange,
  completeActivity,
  getRouteProgress as getStageProgress,
  nextLevel,
  batchRange,
  ETAPPEN_PER_LEVEL,
  ETAPPE_GOAL,
  TARGETS_PER_LEVEL,
  STAGE_LEVELS,
  type CompleteResult,
  type NodeType,
} from './route';
import { addTargets, dueEntries, grade as srsGrade, clearedCount, encounter as srsEncounter } from './srs';
import { recordMilestone, getMilestone, lastMilestoneTs } from './milestones';
import { pseudoWordsFor } from './pseudowords';
import { getActivity, logActivity, type Activity } from './activity';
import { getTodayQuest, type QuestTask } from './quest';
import { pop, celebrate } from './confetti';

type Tab = 'home' | 'challenges' | 'report' | 'settings';
type ArticleRef = { id: string; title: string; url: string; thumb?: string };

declare const __APP_VERSION__: string;

const SERVER = 'https://api.sidelearn.pyrates.io';
const LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

/** Tiny per-day "done today" flags for the Lernpfad activity chain (article /
 * cloze). Resets at local midnight. The vocab goal has its own SRS state. */
const DAILY_ACT_KEY = 'sl_pwa_daily_act';
type DailyKind = 'article' | 'article_plus1' | 'cloze' | 'vocab' | 'rubrik';
function dayStamp(): string { return new Date().toLocaleDateString('sv'); } // YYYY-MM-DD, local
function dailyDone(kind: DailyKind): boolean {
  try { const o = JSON.parse(localStorage.getItem(DAILY_ACT_KEY) || '{}'); return o.d === dayStamp() && !!o[kind]; } catch { return false; }
}
function markDailyDone(kind: DailyKind): void {
  try {
    const o = JSON.parse(localStorage.getItem(DAILY_ACT_KEY) || '{}');
    const cur = o.d === dayStamp() ? o : { d: dayStamp() };
    cur[kind] = true;
    localStorage.setItem(DAILY_ACT_KEY, JSON.stringify(cur));
  } catch { /* ignore */ }
}

// Pastel dot colours for numbered (future) etappes; gold for chest checkpoints.
const PASTEL_DOTS = [
  { background: '#d9ecff', color: '#4f86d6' },
  { background: '#e0f5d6', color: '#5aa648' },
  { background: '#fde3ca', color: '#df7f33' },
  { background: '#e9dcfb', color: '#9162da' },
  { background: '#d3f1ea', color: '#2fa893' },
];
const CHEST_DOT = { background: '#ffe39c', color: '#d99a14' };
const pastelDot = (i: number) => PASTEL_DOTS[((i % PASTEL_DOTS.length) + PASTEL_DOTS.length) % PASTEL_DOTS.length];

/** This Etappe's next-level target words (seeded into the SRS deck) + how many
 * are "cleared" (box≥2). The weekly word goal that gates the Etappentest. */
async function etappeBatch(settings: PwaSettings, etappe: number): Promise<{ words: string[]; cleared: number; targets: SeedWord[]; batch: SeedWord[] }> {
  const targets = await nextLevelTargets(settings.learn, settings.native, settings.level, TARGETS_PER_LEVEL);
  const [start, end] = batchRange(etappe);
  const batch = targets.slice(start, end);
  addTargets(settings.learn, batch.map((t) => ({ word: t.word, translation: t.translation, band: t.band })));
  const words = batch.map((t) => t.word);
  return { words, cleared: clearedCount(settings.learn, words), targets, batch };
}

/** Scan read text for this Etappe's outstanding target words and credit each as
 * an SRS encounter (with a reference to the source). Returns how many were hit. */
async function creditWordsFromText(settings: PwaSettings, text: string, ref: string): Promise<number> {
  const prog = getStageProgress(settings.level);
  if (prog.atAufstieg) return 0;
  const { words } = await etappeBatch(settings, prog.etappe);
  if (!words.length) return 0;
  const targetSet = new Set(words.map((w) => w.toLowerCase()));
  const forms = await loadForms(settings.learn);
  const credited = new Set<string>();
  for (const tok of text.split(/(\p{L}[\p{L}\-']*)/u)) {
    const base = normalize(tok);
    if (base.length < 2) continue;
    // exact form, rule-based lemmas, and the Wiktionary inflection→lemma map.
    const cands = [base, ...lemmaCandidates(base, settings.learn), forms[base] ?? ''];
    for (const c of cands) {
      if (c && targetSet.has(c) && !credited.has(c)) {
        if (srsEncounter(settings.learn, c, ref)) credited.add(c);
        break;
      }
    }
  }
  return credited.size;
}

/** The daily "+1 Stretch": the 2nd daily article is read one level up (i+1) so the
 * learner meets next-level vocabulary in context. Returns the read-level or undefined. */
function stretchReadLevel(articles: { url: string }[], url: string, level: CefrLevel): CefrLevel | undefined {
  const nl = nextLevel(level);
  if (nl === level) return undefined; // already at the top level
  return articles.length > 1 && articles[1]?.url === url ? nl : undefined;
}

type Overlay =
  | { kind: 'lesson'; article: ArticleRef; route: boolean; readLevel?: CefrLevel }
  | { kind: 'digest'; article: ArticleRef }
  | { kind: 'dict'; mode: 'all' | 'mine' }
  | { kind: 'trainer' }
  | { kind: 'surprise' }
  | { kind: 'cloze' }
  | { kind: 'test' }
  | { kind: 'route' }
  | null;

export function App() {
  const [settings, setSettings] = useState<PwaSettings>(getSettings());
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [tab, setTab] = useState<Tab>('home');

  const patch = (p: Partial<PwaSettings>) => {
    const next = { ...settings, ...p };
    setSettings(next);
    saveSettings(next);
  };

  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  if (!settings.onboarded) {
    return (
      <div class="app-col">
        <Updater />
        <Onboarding settings={settings} onDone={(p) => patch({ ...p, onboarded: true })} />
      </div>
    );
  }

  // route=true → completing the read advances the learning route (daily lesson).
  // Free reads (Artikelrubriken, digest fallback) pass route=false: XP only.
  const openLesson = (article: ArticleRef, route = true, readLevel?: CefrLevel) => setOverlay({ kind: 'lesson', article, route, readLevel });
  const goTab = (t: Tab) => { setOverlay(null); setTab(t); };

  let content: ComponentChildren;
  if (overlay?.kind === 'lesson') {
    content = (
      <Lesson
        key={overlay.article.id + (overlay.readLevel ?? settings.level)}
        article={overlay.article}
        route={overlay.route}
        readLevel={overlay.readLevel}
        settings={settings}
        onLevel={(level) => patch({ level })}
        onBack={() => setOverlay(null)}
        onOpen={openLesson}
        onHome={() => goTab('home')}
      />
    );
  } else if (overlay?.kind === 'dict') {
    content = <DictView settings={settings} initialMode={overlay.mode} onBack={() => setOverlay(null)} />;
  } else if (overlay?.kind === 'trainer') {
    content = <TrainerView settings={settings} onBack={() => setOverlay(null)} />;
  } else if (overlay?.kind === 'digest') {
    content = (
      <DigestView
        key={overlay.article.id + settings.level}
        article={overlay.article}
        settings={settings}
        onOpen={openLesson}
        onBack={() => setOverlay(null)}
        onHome={() => goTab('home')}
      />
    );
  } else if (overlay?.kind === 'surprise') {
    content = <SurpriseView settings={settings} onOpen={openLesson} onDigest={(a) => setOverlay({ kind: 'digest', article: a })} onBack={() => setOverlay(null)} />;
  } else if (overlay?.kind === 'cloze') {
    content = <ClozeView settings={settings} onBack={() => setOverlay(null)} />;
  } else if (overlay?.kind === 'test') {
    content = getStageProgress(settings.level).atAufstieg ? (
      <LevelTestView
        settings={settings}
        onAdvance={(r) => { if (r.levelUp) patch({ level: r.level }); }}
        onBack={() => setOverlay(null)}
      />
    ) : (
      <EtappenTest settings={settings} onBack={() => setOverlay(null)} />
    );
  } else if (overlay?.kind === 'route') {
    content = (
      <RouteView
        settings={settings}
        onTrainer={() => setOverlay({ kind: 'trainer' })}
        onTest={() => setOverlay({ kind: 'test' })}
        onBack={() => setOverlay(null)}
      />
    );
  } else if (tab === 'home') {
    content = (
      <HomeTab
        settings={settings}
        onPatch={patch}
        onOpen={openLesson}
        onTrainer={() => setOverlay({ kind: 'trainer' })}
        onDict={() => setOverlay({ kind: 'dict', mode: 'all' })}
        onSurprise={() => setOverlay({ kind: 'surprise' })}
        onCloze={() => setOverlay({ kind: 'cloze' })}
        onRoute={() => setOverlay({ kind: 'route' })}
        onTest={() => setOverlay({ kind: 'test' })}
      />
    );
  } else if (tab === 'challenges') {
    content = <ChallengesTab settings={settings} onOpen={openLesson} onDigest={(a) => setOverlay({ kind: 'digest', article: a })} />;
  } else if (tab === 'report') {
    content = (
      <ReportTab
        settings={settings}
        onDeck={() => setOverlay({ kind: 'dict', mode: 'mine' })}
        onTest={() => setOverlay({ kind: 'test' })}
        onRoute={() => setOverlay({ kind: 'route' })}
      />
    );
  } else {
    content = <SettingsTab settings={settings} onPatch={patch} />;
  }

  return (
    <div class="app-col">
      <Updater />
      {content}
      <TabBar tab={overlay ? null : tab} onTab={goTab} />
    </div>
  );
}

/* --------------------------------------------------------------- TabBar --- */

function TabBar({ tab, onTab }: { tab: Tab | null; onTab: (t: Tab) => void }) {
  const items: { id: Tab; label: string; icon: ComponentChildren }[] = [
    { id: 'home', label: 'Home', icon: <IconHome /> },
    { id: 'challenges', label: 'Challenges', icon: <IconTarget /> },
    { id: 'report', label: 'Report', icon: <IconChart /> },
    { id: 'settings', label: 'Mehr', icon: <IconGear /> },
  ];
  return (
    <nav class="tabbar">
      {items.map((it) => (
        <button class={`tabbtn ${tab === it.id ? 'on' : ''}`} onClick={() => onTab(it.id)}>
          {it.icon}
          <span>{it.label}</span>
          {tab === it.id && <span class="dot" />}
        </button>
      ))}
    </nav>
  );
}

const svg = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' } as const;
const IconHome = () => (<svg {...svg}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" /></svg>);
const IconTarget = () => (<svg {...svg}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>);
const IconChart = () => (<svg {...svg}><path d="M3 3v18h18" /><rect x="7" y="12" width="3" height="6" /><rect x="12" y="8" width="3" height="10" /><rect x="17" y="5" width="3" height="13" /></svg>);
const IconGear = () => (<svg {...svg}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>);

// Tile / area icons (same line-icon language as the nav above).
const dot = { fill: 'currentColor', stroke: 'none' } as const;
const IconDice = () => (<svg {...svg}><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="8.5" cy="8.5" r="1.25" {...dot} /><circle cx="15.5" cy="8.5" r="1.25" {...dot} /><circle cx="12" cy="12" r="1.25" {...dot} /><circle cx="8.5" cy="15.5" r="1.25" {...dot} /><circle cx="15.5" cy="15.5" r="1.25" {...dot} /></svg>);
const IconPuzzle = () => (<svg {...svg}><path d="M19.44 7.85c-.05.32.06.65.29.88l1.57 1.57c.47.47.7 1.09.7 1.7s-.23 1.24-.7 1.71l-1.61 1.61a.98.98 0 0 1-.84.28c-.47-.07-.8-.48-.97-.93a2.5 2.5 0 1 0-3.21 3.22c.45.16.86.5.93.97a.98.98 0 0 1-.28.84l-1.61 1.6a2.4 2.4 0 0 1-1.7.71 2.4 2.4 0 0 1-1.71-.7l-1.57-1.57a1.03 1.03 0 0 0-.88-.29c-.49.07-.84.5-1.02.97a2.5 2.5 0 1 1-3.23-3.24c.46-.18.89-.52.96-1.02a1.03 1.03 0 0 0-.29-.88l-1.57-1.56A2.4 2.4 0 0 1 2 12c0-.62.24-1.24.71-1.7l1.52-1.53c.24-.24.58-.35.92-.3.51.07.87.48 1.11.94a2.5 2.5 0 1 0 3.31-3.3c-.46-.24-.87-.6-.95-1.12a1.02 1.02 0 0 1 .31-.91l1.52-1.53A2.4 2.4 0 0 1 12 2c.62 0 1.23.24 1.7.71l1.57 1.56c.23.23.56.34.88.29.49-.07.84-.5 1.02-.97a2.5 2.5 0 1 1 3.24 3.24c-.46.18-.9.53-.97 1.02z" /></svg>);
const IconBook = () => (<svg {...svg}><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /></svg>);
const IconWrench = () => (<svg {...svg}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>);
const IconBall = () => (<svg {...svg}><circle cx="12" cy="12" r="9" /><path d="M12 7.5l3.3 2.4-1.25 3.85h-4.1L8.7 9.9z" /><path d="M12 7.5V4M15.3 9.9l2.95-1.45M14.05 13.75l2.45 2.5M9.95 13.75l-2.45 2.5M8.7 9.9 5.75 8.45" /></svg>);
const IconLandmark = () => (<svg {...svg}><path d="M3 21h18M5 21V10M9.5 21V10M14.5 21V10M19 21V10M3 10l9-6 9 6M3.5 10h17" /></svg>);
const IconLeaf = () => (<svg {...svg}><path d="M4 20s1.5-7.5 8.5-9C18 9.7 20 5 20 5s1.6 8.4-4.5 12.5C11.7 20 6 20.5 4 20z" /><path d="M9 16c1.6-2.4 4-4 7-5" /></svg>);
const IconMusic = () => (<svg {...svg}><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></svg>);
const IconFlask = () => (<svg {...svg}><path d="M9 3h6M10 3v6l-5.2 9.2A2 2 0 0 0 6.6 21h10.8a2 2 0 0 0 1.7-2.8L14 9V3" /><path d="M7.5 15h9" /></svg>);
const IconSparkles = () => (<svg {...svg}><path d="M12 3l1.6 5.1a2 2 0 0 0 1.3 1.3L20 11l-5.1 1.6a2 2 0 0 0-1.3 1.3L12 19l-1.6-5.1a2 2 0 0 0-1.3-1.3L4 11l5.1-1.6a2 2 0 0 0 1.3-1.3z" /><path d="M19 4v3M20.5 5.5h-3" /></svg>);
const IconBulb = () => (<svg {...svg}><path d="M9 18h6M10 22h4" /><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z" /></svg>);
const IconStar = () => (<svg {...svg}><path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.2l5.9-.9z" /></svg>);
const IconRefresh = () => (<svg {...svg}><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /></svg>);
const IconArrowRight = () => (<svg {...svg}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
const IconRoute = () => (<svg {...svg}><circle cx="6" cy="19" r="3" /><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" /><circle cx="18" cy="5" r="3" /></svg>);
const IconBolt = () => (<svg {...svg}><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></svg>);
const IconNewspaper = () => (<svg {...svg}><path d="M4 5h13a1 1 0 0 1 1 1v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z" /><path d="M18 8h1.5a1.5 1.5 0 0 1 1.5 1.5V18a2 2 0 0 1-2 2" /><path d="M7 9h7M7 13h7M7 17h4" /></svg>);
const IconGap = () => (<svg {...svg}><path d="M3 12h4" /><rect x="9" y="9" width="6" height="6" rx="1.4" /><path d="M17 12h4" /></svg>);
const IconCards = () => (<svg {...svg}><rect x="3" y="8" width="13" height="11" rx="2" /><path d="M7 8V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-3" /></svg>);
const IconFlag = () => (<svg {...svg}><path d="M5 21V4" /><path d="M5 4h12l-2.5 4 2.5 4H5" /></svg>);
const IconSummit = () => (<svg {...svg}><path d="M3 20h18" /><path d="M5 20l5-12 3 6 2-3 4 9" /><path d="m10 8 1.6 2.2L13 8" /></svg>);
const IconChest = () => (<svg {...svg}><path d="M4 10 6 5h12l2 5" /><rect x="3.5" y="10" width="17" height="9" rx="1.5" /><path d="M3.5 13.5h17" /><rect x="10.5" y="12" width="3" height="3" rx="0.6" /></svg>);
const IconCheck = () => (<svg {...svg}><path d="M20 6 9 17l-5-5" /></svg>);
const IconLock = () => (<svg {...svg}><rect x="4.5" y="10.5" width="15" height="9.5" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></svg>);
const IconFlame = () => (<svg {...svg}><path d="M12 2c1 4 4 5 4 9a4 4 0 0 1-8 0c0-1 .3-1.8.8-2.5C8 10 7 11 7 13a5 5 0 0 0 10 0c0-5-5-7-5-11z" /></svg>);

type Pose = 'yay' | 'sad' | 'party' | 'think';
const Gurki = ({ pose = 'yay', size = 92 }: { pose?: Pose; size?: number }) => (
  <img class="gurki" src={`/gurki/${pose}.png`} alt="" width={size} style={{ height: 'auto' }} />
);

const HYPE = [
  "Bereit? Heute wird's gut!",
  'Schön, dass du da bist!',
  'Komm, wir lesen was Neues.',
  'Gurki glaubt an dich.',
  'Kleine Schritte, große Wirkung.',
  'Ein Häppchen Wissen gefällig?',
  'Heute schon schlauer als gestern.',
  'Lesen macht stark — wie eine Gurke.',
];

/* ------------------------------------------------------------ Onboarding --- */

function Onboarding({
  settings,
  onDone,
}: {
  settings: PwaSettings;
  onDone: (p: Partial<PwaSettings>) => void;
}) {
  const [step, setStep] = useState(0);
  const [learn, setLearn] = useState<Language>(settings.learn);
  const [level, setLevel] = useState<CefrLevel>(settings.level);

  const levelHint: Record<string, string> = {
    A1: 'Ganz neu — erste Wörter & Sätze',
    A2: 'Anfänger:in — einfache Sätze',
    B1: 'Mittelstufe — Alltagstexte',
    B2: 'Fortgeschritten — komplexere Texte',
    C1: 'Sehr gut — anspruchsvolle Texte',
  };

  return (
    <main class="lr-onb">
      <div class="lr-onb-logo" />
      {step === 0 ? (
        <>
          <h1 class="lr-onb-h">Willkommen bei Learny</h1>
          <p class="lr-onb-p">Lies jeden Tag echte Texte — vereinfacht auf dein Niveau. Welche Sprache möchtest du lernen?</p>
          <div class="lr-onb-grid">
            {LANGUAGES.filter((l) => l !== settings.native).map((l) => (
              <button
                class={`lr-onb-choice ${learn === l ? 'sel' : ''}`}
                onClick={() => setLearn(l)}
              >
                {LANG_LABELS[l]}
              </button>
            ))}
          </div>
          <button class="lr-onb-next" onClick={() => setStep(1)}>Weiter →</button>
        </>
      ) : (
        <>
          <h1 class="lr-onb-h">Wie gut bist du schon?</h1>
          <p class="lr-onb-p">Kein Stress — du kannst das Niveau jederzeit ändern.</p>
          <div class="lr-onb-levels">
            {(['A1', 'A2', 'B1', 'B2', 'C1'] as CefrLevel[]).map((l) => (
              <button
                class={`lr-onb-level ${level === l ? 'sel' : ''}`}
                onClick={() => setLevel(l)}
              >
                <span class="lr-onb-level-name">{l}</span>
                <span class="lr-onb-level-hint">{levelHint[l]}</span>
              </button>
            ))}
          </div>
          <button class="lr-onb-next" onClick={() => onDone({ learn, level })}>Los geht's</button>
          <button class="lr-onb-back" onClick={() => setStep(0)}>← zurück</button>
        </>
      )}
    </main>
  );
}

/* ----------------------------------------------------------- ArticleList --- */

function useDaily(learn: Language, level: CefrLevel, date?: string) {
  const [daily, setDaily] = useState<ServerDaily | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetchServerDaily(SERVER, learn, level, date).then((d) => {
      if (alive) { setDaily(d); setLoading(false); }
    });
    return () => { alive = false; };
  }, [learn, level, date]);
  return { daily, loading };
}

function ArticleList({ articles, next, allDone, onOpen }: {
  articles: ServerDaily['articles'];
  next?: ServerDaily['articles'][number];
  allDone: boolean;
  onOpen: (a: ArticleRef) => void;
}) {
  return (
    <ul class="lr-list">
      {articles.map((a) => {
        const done = isCompleted(a.url);
        const started = !done && !!getProgress(a.url);
        const isNext = !done && a.url === next?.url && !allDone;
        return (
          <li key={a.id}>
            <button class={`lr-item ${done ? 'done' : ''} ${isNext ? 'primary' : ''}`}
              onClick={() => onOpen({ id: a.id, title: a.title, url: a.url, thumb: a.thumbnail })}>
              {a.thumbnail ? (
                <img class="lr-thumb" src={a.thumbnail} alt="" loading="lazy" />
              ) : (
                <span class="lr-thumb lr-thumb-ph">{a.title.slice(0, 1)}</span>
              )}
              <span class="lr-item-body">
                <span class="lr-item-title">{a.title}</span>
                <span class="lr-item-sub">{a.summary || `${a.paragraphs} Absätze`}</span>
              </span>
              <span class={`lr-item-state ${done ? 'done' : ''}`}>
                {done ? '✓' : started ? 'weiter ›' : isNext ? 'Start ›' : 'lesen ›'}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------- Home tab --- */

function HomeTab({ settings, onPatch, onOpen, onTrainer, onDict, onSurprise, onCloze, onRoute, onTest }: {
  settings: PwaSettings;
  onPatch: (p: Partial<PwaSettings>) => void;
  onOpen: (a: ArticleRef, route?: boolean, readLevel?: CefrLevel) => void;
  onTrainer: () => void;
  onDict: () => void;
  onSurprise: () => void;
  onCloze: () => void;
  onRoute: () => void;
  onTest: () => void;
}) {
  const { daily, loading } = useDaily(settings.learn, settings.level);
  const [tick, setTick] = useState(0); // refresh progress after returning from a lesson
  useEffect(() => {
    const onVis = () => document.visibilityState === 'visible' && setTick((t) => t + 1);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const articles = daily?.articles ?? [];
  const next = articles.find((a) => !isCompleted(a.url)) ?? articles[0];

  const stats = getStats();
  const prog = getStageProgress(settings.level);
  const lvlL = prog.level;
  const lvlR = prog.nextLevel;
  // Weekly word goal: how many of this Etappe's next-level target words are cleared.
  const [batchCleared, setBatchCleared] = useState(0);
  useEffect(() => {
    let alive = true;
    if (prog.atAufstieg) { setBatchCleared(ETAPPE_GOAL); return; }
    void etappeBatch(settings, prog.etappe).then((b) => { if (alive) setBatchCleared(b.cleared); });
    return () => { alive = false; };
  }, [settings.learn, settings.native, settings.level, prog.etappe, tick]);
  const levelPct = Math.round((prog.etappe + (prog.atAufstieg ? 0 : Math.min(batchCleared / ETAPPE_GOAL, 1))) / ETAPPEN_PER_LEVEL * 100);
  const etappeReady = prog.atAufstieg || batchCleared >= ETAPPE_GOAL;
  const weeklyNext = !etappeReady ? 'vocab' : 'check'; // the next weekly step (pulses)

  // Today's quest: 2 tasks, stable for the day. "done" is read from the per-day
  // flags, so any way of finishing a task — guided or self-initiated — ticks it.
  interface QTask { task: QuestTask; label: string; icon: ComponentChildren; done: boolean; onClick: () => void; badge?: string }
  function questMeta(task: QuestTask): QTask {
    const open = (a: typeof next, lvl?: CefrLevel) => { if (a) onOpen({ id: a.id, title: a.title, url: a.url, thumb: a.thumbnail }, true, lvl); };
    switch (task) {
      case 'cloze': return { task, label: 'Mach einen Lückentext', icon: <IconGap />, done: dailyDone('cloze'), onClick: onCloze };
      case 'vocab': return { task, label: 'Mach einen Vokabeltest', icon: <IconCards />, done: dailyDone('vocab'), onClick: onTrainer };
      case 'rubrik': return { task, label: 'Lies einen Rubrik-Artikel', icon: <IconDice />, done: dailyDone('rubrik'), onClick: onSurprise };
      case 'article_plus1': {
        const nl = nextLevel(settings.level);
        const plus = articles.length > 1 ? articles[1] : undefined;
        const can = nl !== settings.level && !!plus; // a +1 read needs a higher level + a 2nd article
        return { task, label: can ? 'Lies einen +1-Artikel' : 'Lies einen Artikel', badge: can ? nl : undefined, icon: <IconNewspaper />,
          done: can ? dailyDone('article_plus1') : dailyDone('article'),
          onClick: () => open(plus ?? next, can ? nl : undefined) };
      }
      default: return { task, label: 'Lies einen Artikel', icon: <IconNewspaper />, done: dailyDone('article'),
        onClick: () => open(next, stretchReadLevel(articles, next?.url ?? '', settings.level)) };
    }
  }
  const quest = getTodayQuest();
  const questTasks = quest.tasks.map(questMeta);
  const questDone = questTasks.filter((t) => t.done).length;
  const questComplete = articles.length > 0 && questDone >= questTasks.length;
  // Celebrate finishing the whole quest — once per day.
  useEffect(() => {
    if (!questComplete) return;
    try {
      if (localStorage.getItem('sl_pwa_quest_cel') !== dayStamp()) {
        localStorage.setItem('sl_pwa_quest_cel', dayStamp());
        celebrate();
      }
    } catch { /* ignore */ }
  }, [questComplete]);

  const [hype] = useState(() => HYPE[Math.floor(Math.random() * HYPE.length)]);
  const pose: Pose = questComplete ? 'party' : 'yay';
  const bubble = questComplete
    ? 'Tagesquest geschafft — Gurki ist stolz!'
    : questDone > 0 ? 'Stark — noch eine Aufgabe!' : hype;

  return (
    <main class="sl-main with-nav h2" key={tick}>
      <header class="h2-bar">
        <div class="h2-pick">
          <select value={settings.learn} onChange={(e) => onPatch({ learn: e.currentTarget.value as Language })}>
            {LANGUAGES.filter((l) => l !== settings.native).map((l) => (<option value={l}>{LANG_LABELS[l]}</option>))}
          </select>
          <select value={settings.level} onChange={(e) => onPatch({ level: e.currentTarget.value as CefrLevel })}>
            {CEFR_LEVELS.map((l) => (<option value={l}>{l}</option>))}
          </select>
        </div>
        <div class="h2-stats">
          <span class="h2-stat streak"><IconFlame />{stats.streak}</span>
          <span class="h2-stat xp"><IconBolt />{stats.totalXp}</span>
        </div>
      </header>

      <section class="h2-hero">
        <span class="h2-blob b1" /><span class="h2-blob b2" />
        <div class="h2-ring" style={{ background: `conic-gradient(var(--ll-ring, var(--ll-accent)) ${levelPct}%, var(--ll-border) 0)` }}>
          <div class="h2-ring-in"><Gurki pose={pose} size={92} /></div>
        </div>
        <b class="h2-title">{stats.streak > 0 ? `Tag ${stats.streak} — stark!` : 'Willkommen zurück!'}</b>
        <div class="h2-lvlbar">
          <span class="h2-lvl-end">{lvlL}</span>
          <div class="h2-lvl-track"><i style={{ width: `${levelPct}%` }} /></div>
          <span class="h2-lvl-end next">{lvlR}</span>
        </div>
        <span class="h2-sub">{prog.atAufstieg ? `Aufstiegstest bereit · Level ${prog.level}` : `${prog.level}.${prog.etappeDisplay} · ${Math.min(batchCleared, ETAPPE_GOAL)}/${ETAPPE_GOAL} neue Wörter`}{articles.length > 0 ? ` · Tagesquest ${questDone}/${questTasks.length}` : ''}</span>
        <div class="h2-bubble">{bubble}</div>
      </section>

      {loading ? (
        <Dots />
      ) : articles.length === 0 ? (
        <div class="h2-card empty">Heute noch keine Lektion für {LANG_LABELS[settings.learn]}. Schau später wieder vorbei.</div>
      ) : (
        <>
          <div class={`quest-card ${questComplete ? 'done' : ''}`}>
            <div class="quest-head">
              <span class="quest-title"><IconTarget />{questComplete ? 'Tagesquest geschafft!' : 'Tagesquest'}</span>
              <span class="quest-count">{questDone}/{questTasks.length}{questComplete ? ' ✓' : ''}</span>
            </div>
            <div class="quest-tasks">
              {questTasks.map((t) => (
                <button class={`quest-task ${t.done ? 'done' : ''}`} onClick={t.onClick} key={t.task}>
                  <span class="qt-ico">{t.done ? <IconCheck /> : t.icon}</span>
                  <span class="qt-label">{t.label}{t.badge ? <span class="qt-badge">{t.badge}</span> : null}</span>
                  <span class="qt-go">{t.done ? '✓' : '›'}</span>
                </button>
              ))}
            </div>
          </div>
          <p class="lr-credit-line">Aus den meistgelesenen Wikipedia-Artikeln des Tages · CC BY-SA</p>
        </>
      )}

      <div class="lr-tiles four">
        <button class="lr-tile" onClick={onSurprise}><span class="lr-tile-ico t-zufall"><IconDice /></span><span class="lr-tile-t">Artikelrubriken</span></button>
        <button class="lr-tile" onClick={onCloze}><span class="lr-tile-ico t-luecke"><IconGap /></span><span class="lr-tile-t">Lückentext</span></button>
        <button class="lr-tile" onClick={onTrainer}><span class="lr-tile-ico t-vokab"><IconCards /></span><span class="lr-tile-t">Vokabeltest</span></button>
        <button class="lr-tile" onClick={onDict}><span class="lr-tile-ico t-dict"><IconBook /></span><span class="lr-tile-t">Wörterbuch</span></button>
      </div>

      <button class="mini-head" onClick={onRoute}>
        <span class="mini-head-t">Dein Lernpfad</span>
        <span class="mini-head-s">{prog.label}</span>
      </button>
      <div class="route mini">
        <div class={`rn l ${etappeReady && !prog.atAufstieg ? 'done' : 'current'} ${weeklyNext === 'vocab' ? 'pulse' : ''}`}>
          <div class="rn-rail"><span class="rn-dot">{etappeReady && !prog.atAufstieg ? <IconCheck /> : <IconCards />}</span></div>
          <button class="rn-card" onClick={onTrainer}>
            <span class="rn-title">Lerne neue Wörter</span>
            <span class="rn-sub">{prog.atAufstieg ? 'Wortschatz wiederholen · tippen' : `${Math.min(batchCleared, ETAPPE_GOAL)}/${ETAPPE_GOAL} diese Woche · tippen`}</span>
          </button>
        </div>
        <div class={`rn r ${etappeReady ? 'current' : 'locked'} ${weeklyNext === 'check' ? 'pulse' : ''}`}>
          <div class="rn-rail"><span class="rn-dot" style={etappeReady ? undefined : CHEST_DOT}><IconChest /></span></div>
          <button class="rn-card" disabled={!etappeReady} onClick={() => etappeReady && onTest()}>
            <span class="rn-title">{prog.atAufstieg ? 'Aufstiegstest' : 'Etappen-Check'}</span>
            <span class="rn-sub">{etappeReady ? 'freigeschaltet · tippen' : `ab ${ETAPPE_GOAL} Wörtern`}</span>
          </button>
        </div>
      </div>
      <button class="mini-all" onClick={onRoute}><IconRoute />Ganzen Lernpfad ansehen →</button>
    </main>
  );
}

/* --------------------------------------------------------------- Trainer --- */

interface MCCard {
  word: string;
  translation: string; // correct meaning
  pos?: string;
  example?: string;
  exampleDe?: string;
  options: string[];
  correct: number;
  rich?: RichEntry | null; // full entry for the post-answer explanation
}

function TrainerView({ settings, onBack }: { settings: PwaSettings; onBack: () => void }) {
  // Multiple-choice vocab test: your saved words first, topped up with level-seed
  // words to a round count; distractors are other words' meanings from the pool.
  const [cards, setCards] = useState<MCCard[] | null>(null);
  const [pos, setPos] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const SESSION = 15;
      const prog = getStageProgress(settings.level);
      // Seed this Etappe's next-level target words into the SRS deck (idempotent).
      if (!prog.atAufstieg) await etappeBatch(settings, prog.etappe);
      const seed = await seedVocab(settings.learn, settings.native, settings.level, 80);
      const due = dueEntries(settings.learn, SESSION); // reviews + freshly-due new targets
      const pool = [...new Set([
        ...getDeck().filter((d) => d.lang === settings.learn).map((d) => d.translation),
        ...seed.map((s) => s.translation),
      ].filter(Boolean))];
      const cards: MCCard[] = [];
      for (const d of due) {
        const correct = d.translation;
        if (!correct) continue;
        const rich = await richLookup(d.word, settings.learn, settings.native);
        const s0 = rich?.s?.[0];
        const distractors = sampleN(pool.filter((t) => t.toLowerCase() !== correct.toLowerCase()), 3);
        const options = shuffleInPlace([correct, ...distractors]);
        if (options.length < 2) continue;
        cards.push({ word: d.word, translation: correct, pos: s0?.p, example: s0?.ex, exampleDe: s0?.exd, options, correct: options.indexOf(correct), rich });
      }
      if (alive) setCards(cards);
    })();
    return () => { alive = false; };
  }, [settings.learn, settings.native, settings.level]);

  const card = cards?.[pos];

  // Finishing a round counts as a daily "vocab" success (quest task + trail).
  const credited = useRef(false);
  useEffect(() => {
    if (done && !credited.current) {
      credited.current = true;
      markDailyDone('vocab');
      logActivity({ type: 'lesson', level: settings.level, title: 'Vokabeltest', detail: `${score}/${cards?.length ?? 0} richtig` });
    }
  }, [done]);

  function choose(idx: number, e: MouseEvent) {
    if (picked !== null || !card) return;
    setPicked(idx);
    const ok = idx === card.correct;
    srsGrade(settings.learn, card.word, ok); // update spaced-repetition box/due
    if (ok) {
      setScore((s) => s + 1);
      award(XP.correct);
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      pop(r.left + r.width / 2, r.top + r.height / 2);
    }
  }
  function dontKnow() {
    if (picked !== null || !card) return;
    setPicked(-1); // "weiß nicht" → reveal answer, counts as not known
    srsGrade(settings.learn, card.word, false);
  }
  function next() {
    if (!cards) return;
    if (pos + 1 >= cards.length) setDone(true);
    else { setPos((p) => p + 1); setPicked(null); }
  }

  return (
    <main class="sl-main with-nav">
      <header class="sl-lessonhead">
        <button class="sl-back" onClick={onBack} aria-label="Zurück">←</button>
        <span class="sl-lessontitle">Vokabeltest</span>
      </header>

      {cards === null ? (
        <Dots />
      ) : cards.length === 0 ? (
        <section class="sl-done">
          <span class="sl-done-ico"><IconCheck /></span>
          <h2>Alles wiederholt!</h2>
          <p class="sl-muted">Gerade sind keine Wörter fällig. Lies eine Lektion und komm später wieder — die Wiederholungen kommen über die Tage verteilt.</p>
          <button class="sl-read" onClick={onBack}>Zurück</button>
        </section>
      ) : done ? (
        <section class="sl-done">
          <span class="sl-done-ico"><IconSparkles /></span>
          <h2>Session fertig</h2>
          <p>{score} von {cards.length} richtig.</p>
          <button class="sl-read" onClick={onBack}>Zurück</button>
        </section>
      ) : card ? (
        <>
          <p class="sl-progress">Frage {pos + 1} / {cards.length}</p>
          <p class="mc-prompt">Was bedeutet <b>{card.word}</b>?{card.pos ? <span class="dict-pos"> · {card.pos}</span> : null}</p>
          <div class={`sl-quiz-opts mc-opts ${picked !== null ? 'answered' : ''}`}>
            {card.options.map((opt, i) => {
              const cls = picked === null ? '' : i === card.correct ? 'correct' : i === picked ? 'wrong' : 'dim';
              return (
                <button class={`sl-quiz-opt ${cls}`} disabled={picked !== null} onClick={(e) => choose(i, e)}>{opt}</button>
              );
            })}
          </div>
          {picked === null ? (
            <button class="sl-read ghost mc-btn" onClick={dontKnow}>Weiß nicht</button>
          ) : (
            <>
              {(() => {
                const ok = picked === card.correct;
                const dunno = picked === -1;
                const pose: Pose = ok ? 'party' : dunno ? 'think' : 'sad';
                const msg = ok ? 'Aaah — richtig!' : dunno ? 'Schau’s dir an — nächstes Mal sitzt’s!' : 'Ohh — leider nicht.';
                return (
                  <div class={`mc-result ${ok ? 'ok' : dunno ? 'dunno' : 'no'}`}>
                    <Gurki pose={pose} size={50} />
                    <span class="mc-result-txt">{msg}</span>
                  </div>
                );
              })()}
              <div class="mc-detail">
                {(card.rich?.s?.length ? card.rich.s : [{ t: card.translation, p: card.pos, ex: card.example, exd: card.exampleDe }]).map((s) => (
                  <div class="dict-sense">
                    <span class="dict-sense-t">{s.t}{s.p ? <span class="dict-pos"> · {s.p}</span> : null}</span>
                    {s.ex && <span class="dict-sense-ex">„{s.ex}"{s.exd ? <span class="dict-sense-exd"> — {s.exd}</span> : null}</span>}
                  </div>
                ))}
                {card.rich?.alt?.length ? <p class="mc-alt">auch: {card.rich.alt.join(', ')}</p> : null}
              </div>
              <button class="sl-read mc-btn" onClick={next}>{pos + 1 >= cards.length ? 'Fertig ✓' : 'Weiter'}</button>
            </>
          )}
        </>
      ) : null}
    </main>
  );
}

/* -------------------------------------------------------------- Surprise --- */

const AREAS: { id: string; label: string; icon: ComponentChildren; sub: string; color: string }[] = [
  { id: 'technik', label: 'Technik', icon: <IconWrench />, sub: 'Erfindungen, Computer …', color: 'a-technik' },
  { id: 'sport', label: 'Sport', icon: <IconBall />, sub: 'Fußball, Olympia …', color: 'a-sport' },
  { id: 'geschichte', label: 'Geschichte', icon: <IconLandmark />, sub: 'Antike, Mittelalter …', color: 'a-geschichte' },
  { id: 'gesellschaft', label: 'Stars & Gesellschaft', icon: <IconStar />, sub: 'Promis, Musik, TV …', color: 'a-gesellschaft' },
  { id: 'natur', label: 'Natur & Tiere', icon: <IconLeaf />, sub: 'Tiere, Pflanzen …', color: 'a-natur' },
  { id: 'kultur', label: 'Kultur', icon: <IconMusic />, sub: 'Musik, Film, Kunst …', color: 'a-kultur' },
  { id: 'wissenschaft', label: 'Wissenschaft', icon: <IconFlask />, sub: 'Weltraum, Physik …', color: 'a-wissenschaft' },
];

function SurpriseView({ settings, onOpen, onDigest, onBack }: {
  settings: PwaSettings;
  onOpen: (a: ArticleRef, route?: boolean) => void;
  onDigest: (a: ArticleRef) => void;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState(false);
  // From A2 the user can choose how to read a fetched article (full vs digest).
  const [choice, setChoice] = useState<ArticleRef | null>(null);

  async function pick(area: string) {
    setError(false);
    setLoading(area);
    const l = await fetchSurprise(SERVER, settings.learn, settings.level, area);
    if (l) {
      const a: ArticleRef = { id: l.id, title: l.title, url: l.url, thumb: l.thumbnail };
      if (settings.level === 'A1') onOpen(a, false); // digest mode is A2+; free read → no route
      else { setLoading(null); setChoice(a); }
    } else {
      setLoading(null);
      setError(true);
    }
  }

  return (
    <main class="sl-main with-nav">
      <header class="sl-lessonhead">
        <button class="sl-back" onClick={onBack} aria-label="Zurück">←</button>
        <span class="sl-lessontitle">Zufallsartikel</span>
      </header>

      {choice ? (
        <section class="dg-choose">
          <p class="lr-section" style={{ marginTop: '4px' }}>{choice.title}</p>
          <p class="sl-muted" style={{ margin: '2px 0 16px' }}>Wie möchtest du lesen?</p>
          <button class="dg-opt" onClick={() => onOpen(choice, false)}>
            <span class="dg-opt-ico full"><IconNewspaper /></span>
            <span class="dg-opt-body"><b>Ganzer Artikel</b><small>8 Absätze · mit Quiz pro Absatz</small></span>
          </button>
          <button class="dg-opt" onClick={() => onDigest(choice)}>
            <span class="dg-opt-ico digest"><IconBolt /></span>
            <span class="dg-opt-body"><b>Kurzfassung</b><small>kompakte Summary · 3 Fragen am Ende</small></span>
          </button>
          <button class="sl-read ghost" style={{ marginTop: '10px' }} onClick={() => setChoice(null)}>Anderen Bereich wählen</button>
        </section>
      ) : loading ? (
        <section class="sl-done">
          <Dots />
          <p class="sl-muted" style={{ marginTop: '12px' }}>
            Wir suchen einen {AREAS.find((a) => a.id === loading)?.label}-Artikel und
            vereinfachen ihn auf {settings.level} … einen Moment.
          </p>
        </section>
      ) : (
        <>
          <p class="lr-section" style={{ marginTop: '4px' }}>Wähle einen Bereich — wir suchen dir einen frischen Artikel.</p>
          {error && <p class="sl-muted">Das hat nicht geklappt. Bitte nochmal versuchen.</p>}
          <div class="lr-tiles" style={{ marginTop: '10px' }}>
            {AREAS.map((a) => (
              <button class="lr-tile" onClick={() => pick(a.id)}>
                <span class={`lr-tile-ico ${a.color}`}>{a.icon}</span>
                <span class="lr-tile-t">{a.label}</span>
                <span class="lr-tile-s">{a.sub}</span>
              </button>
            ))}
          </div>
          <p class="sl-muted" style={{ marginTop: '18px' }}>
            Frisch aus Wikipedia, auf dein Sprachniveau gebracht. Ist ein Bereich
            neu, dauert das erste Mal ein paar Sekunden — danach ist er sofort da.
          </p>
        </>
      )}
    </main>
  );
}

/* --------------------------------------------------------------- Digest --- */

// Short-read mode for area articles (A2+): read a compact summary, then answer
// 2-3 comprehension questions. Falls back to the full article if no digest.
/** Split a paragraph into sentences (keeps terminators). Good enough for the
 * sentence-by-sentence reader; the odd abbreviation may over-split. */
function splitSentences(text: string): string[] {
  return text.match(/[^.!?]+(?:[.!?]+|$)/g)?.map((s) => s.trim()).filter(Boolean) ?? [text.trim()];
}

/** Reading helper for beginners: step through one sentence at a time, each with a
 * (server-cached) sentence-translation button, then read the whole text. B1+ get
 * the full text right away; everyone can toggle. */
function SentenceReader({ text, settings, isHard, onWord, onFinish, finishLabel }: {
  text: string;
  settings: PwaSettings;
  isHard: (w: string) => boolean;
  onWord: (word: string, sentence: string, x: number, y: number) => void;
  onFinish: () => void;
  finishLabel: string;
}) {
  const sentences = splitSentences(text);
  const beginner = settings.level === 'A1' || settings.level === 'A2';
  const [mode, setMode] = useState<'step' | 'full'>(beginner && sentences.length > 1 ? 'step' : 'full');
  const [i, setI] = useState(0);
  const tap = (s: string) => <TapText text={s} isHard={isHard} onWord={(w, x, y) => onWord(w, s, x, y)} />;

  if (mode === 'full') {
    return (
      <>
        {sentences.length > 1 && (
          <div class="sr-bar">
            <span class="sr-progress">Ganzer Text</span>
            <button class="sr-skip" onClick={() => { setI(0); setMode('step'); }}>Satz für Satz →</button>
          </div>
        )}
        <div class="sl-para current"><p class="sl-text">{tap(text)}</p></div>
        <button class="sl-read mc-btn" onClick={onFinish}>{finishLabel}</button>
      </>
    );
  }

  const cur = sentences[i] ?? text;
  const last = i >= sentences.length - 1;
  return (
    <>
      <div class="sr-bar">
        <span class="sr-progress">Satz {i + 1} / {sentences.length}</span>
        <button class="sr-skip" onClick={() => setMode('full')}>Ganzer Text →</button>
      </div>
      <div class="sl-para current"><p class="sl-text sr-text">
        {sentences.slice(0, i).map((s, k) => <span key={k}>{tap(s)}{' '}</span>)}
        <span class="sr-cur">{tap(cur)}</span>
      </p></div>
      <div class="cloze-xlate"><TranslateReveal text={cur} settings={settings} /></div>
      <button class="sl-read mc-btn" onClick={() => { if (last) setMode('full'); else setI((n) => n + 1); }}>
        {last ? 'Ganzen Text lesen →' : 'Weiter →'}
      </button>
    </>
  );
}

function DigestView({ article, settings, onOpen, onBack, onHome }: {
  article: ArticleRef;
  settings: PwaSettings;
  onOpen: (a: ArticleRef, route?: boolean) => void;
  onBack: () => void;
  onHome: () => void;
}) {
  const [lesson, setLesson] = useState<ServerLesson | null>(null);
  const [error, setError] = useState(false);
  const [phase, setPhase] = useState<'read' | 'quiz' | 'done'>('read');
  const [qIdx, setQIdx] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const [score, setScore] = useState({ answered: 0, correct: 0 });
  const [ranks, setRanks] = useState<Record<string, number> | null>(null);
  const [names, setNames] = useState<Set<string>>(new Set());
  const [pop, setPop] = useState<{ word: string; sentence: string; x: number; y: number } | null>(null);
  // Lazily generated digest when the article doesn't have one cached yet.
  const [gen, setGen] = useState<{ digest: string; questions: { q: string; options: string[]; correct: number }[] } | null>(null);
  const [genState, setGenState] = useState<'idle' | 'loading' | 'done'>('idle');
  const credited = useRef(false);

  useEffect(() => {
    void loadRanks(settings.learn).then(setRanks);
    void loadNames().then(setNames);
  }, [settings.learn]);

  useEffect(() => {
    let alive = true;
    void fetchServerLesson(SERVER, article.id, settings.level).then((l) => {
      if (!alive) return;
      if (l) setLesson(l); else setError(true);
    });
    return () => { alive = false; };
  }, [article.id, settings.level]);

  // No cached digest → ask the server to generate one (A2+).
  useEffect(() => {
    if (!lesson || (lesson.digest && lesson.digest.trim()) || settings.level === 'A1') return;
    let alive = true;
    setGenState('loading');
    void fetchDigest(SERVER, article.id, settings.level).then((d) => {
      if (!alive) return;
      if (d && d.digest.trim()) setGen({ digest: d.digest, questions: d.digestQuestions });
      setGenState('done');
    });
    return () => { alive = false; };
  }, [lesson, article.id, settings.level]);

  const isHard = (w: string): boolean => {
    if (!ranks || w.length < 3 || names.has(w.toLowerCase())) return false;
    const r = rankOf(ranks, w);
    return r !== undefined && isAboveLevel(rankToBand(r), settings.level);
  };

  function creditOnce() {
    if (credited.current) return;
    credited.current = true;
    award(XP.lesson);
    logActivity({
      type: 'lesson', level: settings.level, title: article.title,
      detail: score.answered > 0 ? `Kurzfassung ${score.correct}/${score.answered}` : 'Kurzfassung',
    });
  }

  if (error) return <Frame title={article.title} onBack={onBack}><p class="sl-muted">Lektion nicht verfügbar.</p></Frame>;
  if (!lesson) return <Frame title={article.title} onBack={onBack}><Dots /></Frame>;

  const hasOwn = !!lesson.digest?.trim();
  const digest = hasOwn ? lesson.digest!.trim() : (gen?.digest?.trim() || '');
  const questions = hasOwn ? (lesson.digestQuestions ?? []) : (gen?.questions ?? []);

  if (!digest) {
    if (genState !== 'done') {
      return (
        <Frame title={article.title} onBack={onBack}>
          <p class="sl-qlabel">Kurzfassung</p>
          <section class="sl-done"><Dots /><p class="sl-muted" style={{ marginTop: '12px' }}>Wir erstellen die Kurzfassung … einen Moment.</p></section>
        </Frame>
      );
    }
    return (
      <Frame title={article.title} onBack={onBack}>
        <p class="sl-muted">Für diesen Artikel gibt es gerade keine Kurzfassung — lies ihn als ganzen Artikel.</p>
        <button class="sl-read" onClick={() => onOpen(article, false)}>Ganzen Artikel lesen</button>
      </Frame>
    );
  }

  return (
    <Frame title={article.title} onBack={onBack}>
      {phase === 'read' && (
        <>
          <p class="sl-qlabel">Kurzfassung</p>
          <p class="sl-hint"><span class="sl-hint-ico"><IconBulb /></span> Tippe ein <span class="sl-hint-mark">markiertes</span> Wort an — oder hol dir Satz für Satz die Übersetzung.</p>
          <SentenceReader
            text={digest}
            settings={settings}
            isHard={isHard}
            onWord={(word, sentence, x, y) => setPop({ word, sentence, x, y })}
            onFinish={() => { if (questions.length) setPhase('quiz'); else { creditOnce(); setPhase('done'); } }}
            finishLabel={questions.length ? 'Fragen starten' : 'Fertig ✓'}
          />
        </>
      )}

      {phase === 'quiz' && questions[qIdx] && (() => {
        const cur = questions[qIdx]!;
        return (
          <>
            <p class="sl-progress">Frage {qIdx + 1} / {questions.length}</p>
            <Quiz
              q={cur}
              answer={answer}
              isLast={qIdx === questions.length - 1}
              settings={settings}
              translate={cur.q}
              onAnswer={(idx) => {
                if (answer !== null) return;
                setAnswer(idx);
                const ok = idx === cur.correct;
                if (ok) award(XP.correct);
                setScore((s) => ({ answered: s.answered + 1, correct: s.correct + (ok ? 1 : 0) }));
              }}
              onNext={() => {
                if (qIdx + 1 >= questions.length) { creditOnce(); setPhase('done'); }
                else { setQIdx((i) => i + 1); setAnswer(null); }
              }}
            />
          </>
        );
      })()}

      {phase === 'done' && (
        <section class="sl-done">
          <span class="sl-done-ico"><IconSparkles /></span>
          <h2>Geschafft</h2>
          {score.answered > 0 && <p class="sl-done-score">{score.correct} / {score.answered} richtig</p>}
          <div class="sl-done-actions">
            <button class="sl-read" onClick={onHome}>Zur Übersicht</button>
          </div>
        </section>
      )}

      <footer class="sl-credit">
        Quelle: <a href={lesson.url} target="_blank" rel="noopener noreferrer">Wikipedia</a> · CC BY-SA
      </footer>

      {pop && <WordPopover pop={pop} settings={settings} onClose={() => setPop(null)} />}
    </Frame>
  );
}

/* ---------------------------------------------------------------- Cloze --- */

/** Render a cloze prompt with the underscore run shown as a clear styled blank. */
function renderCloze(prompt: string): ComponentChildren {
  return prompt.split(/(_{2,})/).map((p) => (/^_{2,}$/.test(p) ? <span class="cloze-blank" /> : p));
}

function ClozeView({ settings, onBack }: { settings: PwaSettings; onBack: () => void }) {
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [title, setTitle] = useState('');
  const [pos, setPos] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const clozeText = useRef('');

  useEffect(() => {
    let alive = true;
    void (async () => {
      const daily = await fetchServerDaily(SERVER, settings.learn, settings.level);
      const art = daily?.articles[0];
      if (!art) { if (alive) setQuestions([]); return; }
      const lesson = await fetchServerLesson(SERVER, art.id, settings.level);
      if (!alive) return;
      if (!lesson) { setQuestions([]); return; }
      const text = lesson.paragraphs.map((p) => p.simplified).join(' ');
      clozeText.current = text;
      const vocab = lesson.vocab.map((v) => v.word);
      const deckWords = getDeck().filter((d) => d.lang === settings.learn).map((d) => d.word);
      const pool = [...new Set([...vocab, ...deckWords])];
      // ~half consolidation (from the article), ~half i+1 drill of this Etappe's
      // next-level target words, blanked in their own (richdict) example sentences.
      const articleQs = buildClozeQuestions(text, vocab, pool, Math.random, 4);
      let iqs: QuizQuestion[] = [];
      const prog = getStageProgress(settings.level);
      if (!prog.atAufstieg) {
        const { batch } = await etappeBatch(settings, prog.etappe);
        if (!alive) return;
        const withEx = batch.filter((b) => b.example && b.example.trim());
        const exText = withEx.map((b) => b.example!.trim()).join(' ');
        const targetWords = withEx.map((b) => b.word);
        const iPool = [...new Set([...targetWords, ...vocab])];
        iqs = buildClozeQuestions(exText, targetWords, iPool, Math.random, 4);
        clozeText.current += ' ' + exText; // so the completion scan credits these targets
      }
      const qs = shuffleInPlace([...articleQs, ...iqs]).slice(0, 8);
      setTitle(lesson.title);
      setQuestions(qs.length ? qs : buildClozeQuestions(text, vocab, pool, Math.random, 8));
    })();
    return () => { alive = false; };
  }, [settings.learn, settings.level]);

  function choose(opt: string, e: MouseEvent) {
    if (picked !== null) return;
    setPicked(opt);
    if (questions && opt === questions[pos]!.answer) {
      setScore((s) => s + 1); award(XP.merken);
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      pop(r.left + r.width / 2, r.top + r.height / 2);
    }
  }
  function next() {
    setPicked(null);
    setPos((p) => p + 1);
  }

  const q = questions?.[pos];
  const done = questions !== null && questions.length > 0 && pos >= questions.length;

  // Completing a Lückentext-Runde advances a 'cloze' route node (once).
  const credited = useRef(false);
  useEffect(() => {
    if (done && !credited.current) {
      credited.current = true;
      completeActivity(settings.level, 'cloze');
      markDailyDone('cloze');
      logActivity({ type: 'lesson', level: settings.level, title: `Lückentext: ${title}`, detail: 'Lückentext' });
      void creditWordsFromText(settings, clozeText.current, `Lückentext: ${title}`);
    }
  }, [done]);

  return (
    <main class="sl-main with-nav">
      <header class="sl-lessonhead">
        <button class="sl-back" onClick={onBack} aria-label="Zurück">←</button>
        <span class="sl-lessontitle">Lückentext</span>
      </header>

      {questions === null ? (
        <Dots />
      ) : questions.length === 0 ? (
        <p class="sl-muted">Gerade kein Lückentext verfügbar — schau, dass es eine Tageslektion gibt, und versuch es nochmal.</p>
      ) : done ? (
        <section class="sl-done">
          <span class="sl-done-ico"><IconSparkles /></span>
          <h2>Geschafft</h2>
          <p>{score} von {questions.length} richtig.</p>
          <button class="sl-read" onClick={onBack}>Zurück</button>
        </section>
      ) : q ? (
        <>
          <p class="sl-progress">Lücke {pos + 1} / {questions.length} · {title}</p>
          {/* Three zones: sentence card · translate · options */}
          <div class="cloze-card">
            <p class="sl-quiz-q cloze-q">{renderCloze(q.prompt)}</p>
          </div>
          <div class="cloze-xlate">
            <TranslateReveal text={q.prompt} settings={settings} />
          </div>
          <div class={`cloze-opts ${picked !== null ? 'answered' : ''}`}>
            <p class="cloze-hint">{picked === null ? 'Tippe auf das fehlende Wort' : ' '}</p>
            <div class="sl-quiz-opts cloze-opts-list">
              {q.options.map((opt) => {
                let cls = '';
                if (picked !== null) cls = opt === q.answer ? 'correct' : opt === picked ? 'wrong' : 'dim';
                return (
                  <button class={`sl-quiz-opt ${cls}`} disabled={picked !== null} onClick={(e) => choose(opt, e)}>
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
          {picked !== null && (
            <div class={`cloze-result ${picked === q.answer ? 'ok' : 'no'}`}>
              <Gurki pose={picked === q.answer ? 'party' : 'sad'} size={48} />
              <span class="cloze-result-txt">
                {picked === q.answer ? 'Stark — richtig!' : `Schade — richtig wäre „${q.answer}".`}
              </span>
            </div>
          )}
          {picked !== null && (
            <button class="sl-read cloze-next" onClick={next}>
              {pos + 1 >= questions.length ? 'Fertig ✓' : 'Weiter →'}
            </button>
          )}
        </>
      ) : null}
    </main>
  );
}

/* ----------------------------------------------------------- Etappen-Test --- */

function shuffleInPlace<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function LevelTestView({ settings, onAdvance, onBack }: {
  settings: PwaSettings;
  onAdvance: (r: CompleteResult) => void;
  onBack: () => void;
}) {
  const [phase, setPhase] = useState<'vocab' | 'reading' | 'result'>('vocab');

  // --- vocab (Yes/No) phase ---
  const [items, setItems] = useState<{ word: string; real: boolean }[] | null>(null);
  const [known, setKnown] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [ranks, names, targets] = await Promise.all([
        loadRanks(settings.learn), loadNames(),
        nextLevelTargets(settings.learn, settings.native, settings.level, TARGETS_PER_LEVEL),
      ]);
      if (!alive) return;
      // The Aufstieg proves NEXT-level mastery: test the level's target words.
      // Fallback to the current band if richdict targets aren't available.
      let reals: string[];
      if (targets.length >= 14) {
        reals = targets.map((t) => t.word).filter((w) => w.length >= 3 && /^\p{L}+$/u.test(w) && !names.has(w.toLowerCase()));
      } else {
        const [lo, hi] = bandRankRange(settings.level);
        reals = Object.entries(ranks)
          .filter(([w, r]) => r >= lo && r <= hi && w.length >= 4 && /^\p{L}+$/u.test(w) && !names.has(w.toLowerCase()))
          .map(([w]) => w);
      }
      shuffleInPlace(reals);
      const pseudos = shuffleInPlace([...pseudoWordsFor(settings.learn)]);
      const list = [
        ...reals.slice(0, 14).map((word) => ({ word, real: true })),
        ...pseudos.slice(0, 6).map((word) => ({ word, real: false })),
      ];
      setItems(shuffleInPlace(list));
    })();
    return () => { alive = false; };
  }, [settings.learn, settings.level]);

  function toggle(w: string) {
    setKnown((prev) => {
      const n = new Set(prev);
      if (n.has(w)) n.delete(w); else n.add(w);
      return n;
    });
  }

  // --- reading phase ---
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [qpos, setQpos] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const correctRef = useRef(0);

  async function startReading() {
    setPhase('reading');
    const daily = await fetchServerDaily(SERVER, settings.learn, settings.level);
    const art = daily?.articles[0];
    let qs: QuizQuestion[] = [];
    if (art) {
      const lesson = await fetchServerLesson(SERVER, art.id, settings.level);
      if (lesson) {
        lesson.paragraphs.forEach((p) => {
          if (p.question) qs.push({ prompt: p.question.q, options: p.question.options, answer: p.question.options[p.question.correct]! });
        });
        const text = lesson.paragraphs.map((p) => p.simplified).join(' ');
        const vocab = lesson.vocab.map((v) => v.word);
        qs = [...qs, ...buildClozeQuestions(text, vocab, vocab, Math.random, 3)];
      }
    }
    setQuestions(shuffleInPlace(qs).slice(0, 4));
  }

  // --- result ---
  const [result, setResult] = useState<{ passed: boolean; adv: CompleteResult | null } | null>(null);

  function conclude() {
    const reals = items?.filter((i) => i.real) ?? [];
    const pseudos = items?.filter((i) => !i.real) ?? [];
    const vocabRatio = reals.length ? reals.filter((i) => known.has(i.word)).length / reals.length : 1;
    const falseAlarm = pseudos.length ? pseudos.filter((i) => known.has(i.word)).length / pseudos.length : 0;
    const vocabPass = vocabRatio >= 0.7 && falseAlarm <= 0.25;
    const rt = questions?.length ?? 0;
    const readingPass = rt ? correctRef.current / rt >= 0.6 : true;
    const passed = vocabPass && readingPass;
    let adv: CompleteResult | null = null;
    if (passed) { adv = completeActivity(settings.level, 'aufstieg'); onAdvance(adv); celebrate(); }
    logActivity({ type: 'test', level: settings.level, ok: passed, detail: passed ? 'bestanden' : 'nicht bestanden' });
    if (adv?.levelUp) logActivity({ type: 'levelup', level: adv.level, detail: adv.level });
    setResult({ passed, adv });
    setPhase('result');
  }

  function answerReading(opt: string) {
    if (picked !== null || !questions) return;
    setPicked(opt);
    if (opt === questions[qpos]!.answer) correctRef.current += 1;
  }
  function nextReading() {
    if (!questions) return;
    if (qpos + 1 >= questions.length) conclude();
    else { setQpos(qpos + 1); setPicked(null); }
  }

  return (
    <main class="sl-main with-nav">
      <header class="sl-lessonhead">
        <button class="sl-back" onClick={onBack} aria-label="Zurück">←</button>
        <span class="sl-lessontitle">Etappen-Test</span>
      </header>

      {phase === 'vocab' && (
        items === null ? <Dots /> : (
          <>
            <p class="lr-section" style={{ marginTop: 0 }}>Teil 1 · Wortschatz</p>
            <p class="sl-hint">Tippe alle Wörter an, die du <b>kennst</b>. Manche sind erfunden — die lässt du aus.</p>
            <div class="tst-grid">
              {items.map((it) => (
                <button class={`tst-word ${known.has(it.word) ? 'on' : ''}`} onClick={() => toggle(it.word)}>
                  {it.word}
                </button>
              ))}
            </div>
            <button class="sl-read" onClick={startReading}>Weiter → Teil 2</button>
          </>
        )
      )}

      {phase === 'reading' && (
        questions === null ? <Dots /> : questions.length === 0 ? (
          <>
            <p class="sl-muted">Gerade kein Lesetext verfügbar — wir werten Teil 1 aus.</p>
            <button class="sl-read" onClick={conclude}>Test abschließen</button>
          </>
        ) : (
          <>
            <p class="lr-section" style={{ marginTop: 0 }}>Teil 2 · Leseverständnis</p>
            <p class="sl-progress">Frage {qpos + 1} / {questions.length}</p>
            <div class="sl-quiz">
              <p class="sl-quiz-q">{questions[qpos]!.prompt}</p>
              <TranslateReveal text={questions[qpos]!.prompt} settings={settings} />
              <div class="sl-quiz-opts">
                {questions[qpos]!.options.map((opt) => {
                  let cls = '';
                  if (picked !== null) cls = opt === questions[qpos]!.answer ? 'correct' : opt === picked ? 'wrong' : 'dim';
                  return (
                    <button class={`sl-quiz-opt ${cls}`} disabled={picked !== null} onClick={() => answerReading(opt)}>
                      {opt}
                    </button>
                  );
                })}
              </div>
              {picked !== null && (
                <button class="sl-read" onClick={nextReading}>
                  {qpos + 1 >= questions.length ? 'Auswerten ✓' : 'Weiter →'}
                </button>
              )}
            </div>
          </>
        )
      )}

      {phase === 'result' && result && (
        <section class="sl-done">
          {result.passed ? (
            <>
              <span class="sl-done-ico"><IconSparkles /></span>
              <h2>Bestanden!</h2>
              {result.adv?.levelUp ? (
                <p>Glückwunsch — du steigst auf <b>{result.adv.level}</b> auf. Deine Texte werden ab jetzt auf diesem Niveau angepasst.</p>
              ) : (
                <p>Nächste Etappe freigeschaltet: <b>{getStageProgress(settings.level).label}</b>.</p>
              )}
            </>
          ) : (
            <>
              <span class="sl-done-ico muted"><IconRefresh /></span>
              <h2>Noch nicht ganz</h2>
              <p>Kein Problem — lies und übe noch etwas weiter und versuch's dann nochmal.</p>
            </>
          )}
          <button class="sl-read" onClick={onBack}>Zurück</button>
        </section>
      )}
    </main>
  );
}

/* ------------------------------------------------------ Etappenabschlusstest --- */

function EtappenTest({ settings, onBack }: { settings: PwaSettings; onBack: () => void }) {
  const [questions, setQuestions] = useState<LessonQuestion[] | null>(null);
  const [qpos, setQpos] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const correct = useRef(0);
  const [result, setResult] = useState<{ passed: boolean } | null>(null);
  const [locked, setLocked] = useState(false);
  const optsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const prog = getStageProgress(settings.level);
      const { batch, targets, cleared } = await etappeBatch(settings, prog.etappe);
      if (!alive) return;
      if (cleared < ETAPPE_GOAL && batch.length > 0) { setLocked(true); setQuestions([]); return; }
      // Mostly the Etappe's just-learned target words, plus a couple article questions.
      const pool = [...new Set(targets.map((t) => t.translation).filter(Boolean))];
      const vq: LessonQuestion[] = sampleN(batch, 3).map((t) => {
        const c = t.translation;
        const distractors = sampleN(pool.filter((x) => x.toLowerCase() !== c.toLowerCase()), 3);
        const options = shuffleInPlace([c, ...distractors]);
        return { kind: 'vocab' as const, q: `Was bedeutet «${t.word}»?`, options, correct: options.indexOf(c) };
      }).filter((q) => q.options.length >= 2);
      let articleQs: LessonQuestion[] = [];
      const daily = await fetchServerDaily(SERVER, settings.learn, settings.level);
      const art = daily?.articles[0];
      if (art) {
        const lesson = await fetchServerLesson(SERVER, art.id, settings.level);
        if (lesson) articleQs = (await buildLessonQuestions(lesson, settings)).filter(Boolean) as LessonQuestion[];
      }
      if (!alive) return;
      const qs = shuffleInPlace([...vq, ...sampleN(articleQs, 2)]).slice(0, 5);
      setQuestions(qs.length ? qs : shuffleInPlace(articleQs).slice(0, 5));
    })();
    return () => { alive = false; };
  }, [settings.learn, settings.level]);

  function answer(i: number) {
    if (picked !== null || !questions) return;
    setPicked(i);
    if (i === questions[qpos]!.correct) {
      correct.current += 1;
      const el = optsRef.current?.querySelector('.sl-quiz-opt.correct');
      if (el) { const r = el.getBoundingClientRect(); pop(r.left + r.width / 2, r.top + r.height / 2); }
    }
  }
  function nextQ() {
    if (!questions) return;
    if (qpos + 1 >= questions.length) {
      const total = questions.length;
      const passed = total > 0 && correct.current / total >= 0.8; // ≥4/5
      if (passed) {
        const eIdx = getStageProgress(settings.level).etappe; // the Etappe being completed
        const since = lastMilestoneTs(settings.level);
        const articles = getActivity().filter((a) => a.type === 'lesson' && a.level === settings.level && a.ts > since).length;
        completeActivity(settings.level, 'etappentest');
        recordMilestone({ level: settings.level, etappe: eIdx, sublevel: `${settings.level}.${eIdx + 1}`, words: ETAPPE_GOAL, articles, ts: Date.now() });
        celebrate();
      }
      logActivity({ type: 'test', level: settings.level, ok: passed, detail: passed ? 'Etappe geschafft' : 'Etappentest' });
      setResult({ passed });
    } else { setQpos(qpos + 1); setPicked(null); }
  }

  const q = questions?.[qpos];
  return (
    <main class="sl-main with-nav">
      <header class="sl-lessonhead">
        <button class="sl-back" onClick={onBack} aria-label="Zurück">←</button>
        <span class="sl-lessontitle">Etappentest</span>
      </header>

      {result ? (
        <section class="sl-done">
          {result.passed ? (
            <><span class="sl-done-ico"><IconSparkles /></span><h2>Etappe geschafft!</h2>
              <p>Nächste Etappe: <b>{getStageProgress(settings.level).label}</b>.</p></>
          ) : (
            <><span class="sl-done-ico muted"><IconRefresh /></span><h2>Fast!</h2>
              <p>Du brauchst 4 von 5 richtig. Lies/üb noch etwas und versuch's nochmal.</p></>
          )}
          <button class="sl-read" onClick={onBack}>Zurück</button>
        </section>
      ) : questions === null ? (
        <Dots />
      ) : locked ? (
        <>
          <p class="sl-muted">Der Etappentest schaltet frei, wenn du das Wochenziel von {ETAPPE_GOAL} neuen Wörtern geschafft hast. Üb noch im Vokabeltest.</p>
          <button class="sl-read" onClick={onBack}>Zurück</button>
        </>
      ) : questions.length === 0 ? (
        <>
          <p class="sl-muted">Gerade keine Fragen verfügbar — lies erst eine Tageslektion.</p>
          <button class="sl-read" onClick={onBack}>Zurück</button>
        </>
      ) : q ? (
        <>
          <p class="lr-section" style={{ marginTop: 0 }}>Kurzer Check · {Q_LABEL[q.kind]}</p>
          <p class="sl-progress">Frage {qpos + 1} / {questions.length}</p>
          <div class="sl-quiz">
            <p class="sl-quiz-q">{q.q}</p>
            {q.kind !== 'vocab' && <TranslateReveal text={q.q} settings={settings} />}
            <div class="sl-quiz-opts" ref={optsRef}>
              {q.options.map((opt, i) => {
                let cls = '';
                if (picked !== null) cls = i === q.correct ? 'correct' : i === picked ? 'wrong' : 'dim';
                return (
                  <button class={`sl-quiz-opt ${cls}`} disabled={picked !== null} onClick={() => answer(i)}>{opt}</button>
                );
              })}
            </div>
            {picked !== null && (
              <button class="sl-read" onClick={nextQ}>{qpos + 1 >= questions.length ? 'Auswerten ✓' : 'Weiter →'}</button>
            )}
          </div>
        </>
      ) : null}
    </main>
  );
}

/* -------------------------------------------------------------- Lernroute --- */

function timeAgo(ts: number): string {
  const d = Math.floor((Date.now() - ts) / 86400000);
  if (d <= 0) return 'heute';
  if (d === 1) return 'gestern';
  if (d < 7) return `vor ${d} Tagen`;
  if (d < 14) return 'letzte Woche';
  return `vor ${Math.floor(d / 7)} Wochen`;
}

function RouteView({ settings, onTrainer, onTest, onBack }: {
  settings: PwaSettings;
  onTrainer: () => void;
  onTest: () => void;
  onBack: () => void;
}) {
  const prog = getStageProgress(settings.level);
  const level = prog.level;
  const [cleared, setCleared] = useState(0);
  const curRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    if (prog.atAufstieg) setCleared(ETAPPE_GOAL);
    else void etappeBatch(settings, prog.etappe).then((b) => { if (alive) setCleared(b.cleared); });
    return () => { alive = false; };
  }, [settings.learn, settings.native, settings.level, prog.etappe]);
  useEffect(() => { curRef.current?.scrollIntoView({ block: 'center' }); }, [cleared]);

  const ready = prog.atAufstieg || cleared >= ETAPPE_GOAL;
  const levelIdx = STAGE_LEVELS.indexOf(level);
  const rows: ComponentChildren[] = [];
  let idx = 0;
  const side = () => (idx++ % 2 === 0 ? 'l' : 'r'); // alternate card side along the rail
  for (let e = 0; e < ETAPPEN_PER_LEVEL; e++) {
    const done = e < prog.etappe;
    const isCur = e === prog.etappe && !prog.atAufstieg;
    if (done) {
      const m = getMilestone(level, e);
      rows.push(
        <div class={`rn done ${side()}`} key={`e${e}`}>
          <div class="rn-rail"><span class="rn-dot"><IconCheck /></span></div>
          <span class="rn-card">
            <span class="rn-title">Sprachniveau {level}.{e + 1}</span>
            <span class="rn-sub">{m ? `${m.words} Wörter · ${m.articles} Artikel · Check ✓` : 'geschafft'}</span>
          </span>
        </div>,
      );
    } else if (isCur) {
      rows.push(
        <div class={`rn head ${side()}`} key={`h${e}`}>
          <div class="rn-rail"><span class="rn-dot" ref={curRef}><IconRoute /></span></div>
          <span class="rn-card flat"><span class="rn-title">Sprachniveau {level}.{e + 1} — diese Woche</span></span>
        </div>,
        <div class={`rn ${ready ? 'done' : 'current'} ${!ready ? 'pulse' : ''} ${side()}`} key={`e${e}`}>
          <div class="rn-rail"><span class="rn-dot">{ready ? <IconCheck /> : <IconCards />}</span></div>
          <button class="rn-card" onClick={onTrainer}>
            <span class="rn-title">Lerne neue Wörter</span>
            <span class="rn-sub">{Math.min(cleared, ETAPPE_GOAL)}/{ETAPPE_GOAL} diese Woche · tippen</span>
          </button>
        </div>,
        <div class={`rn ${ready ? 'current' : 'locked'} ${ready ? 'pulse' : ''} ${side()}`} key={`t${e}`}>
          <div class="rn-rail"><span class="rn-dot" style={ready ? undefined : CHEST_DOT}><IconChest /></span></div>
          <button class="rn-card" disabled={!ready} onClick={() => ready && onTest()}>
            <span class="rn-title">Etappen-Check</span>
            <span class="rn-sub">{ready ? 'kurzer Test über die neuen Wörter · tippen' : `ab ${ETAPPE_GOAL} Wörtern`}</span>
          </button>
        </div>,
      );
    } else {
      const n = e + 1;
      const milestone = n % 5 === 0; // every 5th etappe is a treasure milestone
      rows.push(
        <div class={`rn locked ${side()}`} key={`e${e}`}>
          <div class="rn-rail"><span class="rn-dot" style={milestone ? CHEST_DOT : pastelDot(e)}>{milestone ? <IconChest /> : n}</span></div>
          <span class="rn-card"><span class="rn-title">Etappe {n}</span><span class="rn-sub">{milestone ? `Meilenstein · ${ETAPPE_GOAL} Wörter` : `${ETAPPE_GOAL} Wörter + Check`}</span></span>
        </div>,
      );
    }
  }
  rows.push(
    <div class={`rn ${prog.atAufstieg ? 'current' : 'locked'} ${prog.atAufstieg ? 'pulse' : ''} ${side()}`} key="auf">
      <div class="rn-rail"><span class="rn-dot" ref={prog.atAufstieg ? curRef : undefined} style={prog.atAufstieg ? undefined : CHEST_DOT}><IconChest /></span></div>
      <button class="rn-card" disabled={!prog.atAufstieg} onClick={() => prog.atAufstieg && onTest()}>
        <span class="rn-title">Aufstiegstest → {prog.nextLevel}</span>
        <span class="rn-sub">{prog.atAufstieg ? `alle Wörter für ${prog.nextLevel} · tippen` : 'nach Etappe 10'}</span>
      </button>
    </div>,
  );

  return (
    <main class="sl-main with-nav">
      <header class="sl-lessonhead">
        <button class="sl-back" onClick={onBack} aria-label="Zurück">←</button>
        <span class="sl-lessontitle">Lernpfad</span>
      </header>
      <div class="rt-head">
        <b>{level}</b><span>Etappe {prog.etappeDisplay}/{ETAPPEN_PER_LEVEL} → {prog.nextLevel}</span>
        {levelIdx > 0 && <span class="rt-prev">{STAGE_LEVELS.slice(0, levelIdx).join(' ✓ ')} ✓</span>}
      </div>
      <div class="route">{rows}</div>
    </main>
  );
}

/* ----------------------------------------------------------- Challenges --- */

const CAL_WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const CAL_MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

/** Month calendar that only enables days present in `available` (the sparse
 * archive). Scales to months/years far better than a flat dropdown list. */
function DayCalendar({ available, sel, today, onPick }: {
  available: Set<string>; sel: string | undefined; today: string; onPick: (d: string) => void;
}) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const minYM = ([...available].sort()[0] ?? today).slice(0, 7);
  const maxYM = today.slice(0, 7);
  const [ym, setYM] = useState(() => (sel ?? today).slice(0, 7));
  const [y, m] = ym.split('-').map(Number) as [number, number]; // m: 1–12
  const firstWd = (new Date(y, m - 1, 1).getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells: (number | null)[] = [...Array(firstWd).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const canPrev = ym > minYM;
  const canNext = ym < maxYM;
  const shift = (d: number) => {
    const nm = m - 1 + d;
    setYM(`${y + Math.floor(nm / 12)}-${pad(((nm % 12) + 12) % 12 + 1)}`);
  };
  return (
    <div class="cal">
      <div class="cal-head">
        <button class="cal-nav" disabled={!canPrev} onClick={() => canPrev && shift(-1)} aria-label="Früher">‹</button>
        <span class="cal-title">{CAL_MONTHS[m - 1]} {y}</span>
        <button class="cal-nav" disabled={!canNext} onClick={() => canNext && shift(1)} aria-label="Später">›</button>
      </div>
      <div class="cal-grid cal-wd">{CAL_WD.map((w) => <span class="cal-wdl">{w}</span>)}</div>
      <div class="cal-grid">
        {cells.map((d, i) => {
          if (d === null) return <span class="cal-cell empty" key={`e${i}`} />;
          const str = `${y}-${pad(m)}-${pad(d)}`;
          const has = available.has(str);
          return (
            <button key={str} disabled={!has} onClick={() => has && onPick(str)}
              class={`cal-cell ${has ? 'has' : 'none'} ${str === (sel ?? today) ? 'sel' : ''} ${str === today ? 'today' : ''}`}>
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChallengesTab({ settings, onOpen, onDigest }: {
  settings: PwaSettings;
  onOpen: (a: ArticleRef, route?: boolean) => void;
  onDigest: (a: ArticleRef) => void;
}) {
  const [dates, setDates] = useState<string[] | null>(null);
  const [sel, setSel] = useState<string | undefined>(undefined); // undefined = today
  const [area, setArea] = useState<AreaArticle[] | null>(null);
  const [choice, setChoice] = useState<AreaArticle | null>(null);
  const [openAreas, setOpenAreas] = useState<Set<string>>(new Set()); // expanded rubriken
  const [olderOpen, setOlderOpen] = useState(false); // "Älter" date dropdown
  const toggleArea = (id: string) => setOpenAreas((prev) => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  useEffect(() => {
    let alive = true;
    void fetchServerArchive(SERVER, settings.learn).then((d) => alive && setDates(d));
    return () => { alive = false; };
  }, [settings.learn]);

  const { daily, loading } = useDaily(settings.learn, settings.level, sel);
  const articles = daily?.articles ?? [];
  const goal = daily?.goal ?? 2;
  const doneCount = articles.filter((a) => isCompleted(a.url)).length;
  const next = articles.find((a) => !isCompleted(a.url)) ?? articles[0];

  // Rubrik library for the same day as the shown lessons (server's date for "Heute").
  const dateForArea = sel ?? daily?.date;
  useEffect(() => {
    if (!dateForArea) return;
    let alive = true;
    setArea(null);
    void fetchAreaList(SERVER, settings.learn, settings.level, dateForArea).then((a) => alive && setArea(a));
    return () => { alive = false; };
  }, [settings.learn, settings.level, dateForArea]);

  // The server archive includes today; drop it so it isn't shown twice (next to
  // the dedicated "Heute" pill). Show ~a week as pills, the rest behind "Älter ▾".
  const days = (dates ?? []).filter((d) => d !== dayStamp());
  const recent = days.slice(0, 6);
  const older = days.slice(6);
  const selOlder = !!sel && older.includes(sel);

  const toRef = (a: AreaArticle): ArticleRef => ({ id: a.id, title: a.title, url: a.url, thumb: a.thumbnail });
  const pickArea = (a: AreaArticle) => { if (settings.level === 'A1') onOpen(toRef(a), false); else setChoice(a); };
  const groups = AREAS
    .map((m) => ({ meta: m, items: (area ?? []).filter((x) => x.area === m.id) }))
    .filter((g) => g.items.length > 0);

  if (choice) {
    return (
      <main class="sl-main with-nav">
        <header class="sl-lessonhead">
          <button class="sl-back" onClick={() => setChoice(null)} aria-label="Zurück">←</button>
          <span class="sl-lessontitle">Lesen</span>
        </header>
        <section class="dg-choose">
          <p class="lr-section" style={{ marginTop: '4px' }}>{choice.title}</p>
          <p class="sl-muted" style={{ margin: '2px 0 16px' }}>Wie möchtest du lesen?</p>
          <button class="dg-opt" onClick={() => { onOpen(toRef(choice), false); setChoice(null); }}>
            <span class="dg-opt-ico full"><IconNewspaper /></span>
            <span class="dg-opt-body"><b>Ganzer Artikel</b><small>8 Absätze · mit Quiz pro Absatz</small></span>
          </button>
          <button class="dg-opt" onClick={() => { onDigest(toRef(choice)); setChoice(null); }}>
            <span class="dg-opt-ico digest"><IconBolt /></span>
            <span class="dg-opt-body"><b>Kurzfassung</b><small>kompakte Summary · 3 Fragen am Ende</small></span>
          </button>
          <button class="sl-read ghost" style={{ marginTop: '10px' }} onClick={() => setChoice(null)}>Zurück</button>
        </section>
      </main>
    );
  }

  return (
    <main class="sl-main with-nav">
      <h1 class="tab-screen-title">Challenges</h1>
      <p class="lr-section">Heutige & frühere Tageslektionen</p>
      {days.length > 0 && (
        <div class="lr-pick day-pick" style={{ flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
          <button class={`pill-day ${!sel ? 'on' : ''}`} onClick={() => { setSel(undefined); setOlderOpen(false); }}>Heute</button>
          {recent.map((d) => (
            <button class={`pill-day ${sel === d ? 'on' : ''}`} onClick={() => { setSel(d); setOlderOpen(false); }}>
              {d.slice(5)}
            </button>
          ))}
          {older.length > 0 && (
            <div class="day-older">
              <button class={`pill-day older ${selOlder ? 'on' : ''}`} onClick={() => setOlderOpen((o) => !o)} aria-expanded={olderOpen}>
                {selOlder ? `${sel!.slice(5)} ▾` : 'Kalender ▾'}
              </button>
              {olderOpen && (
                <DayCalendar
                  available={new Set(dates ?? [])}
                  sel={sel}
                  today={dayStamp()}
                  onPick={(d) => { setSel(d === dayStamp() ? undefined : d); setOlderOpen(false); }}
                />
              )}
            </div>
          )}
        </div>
      )}
      {daily && articles.length > 0 && (
        <p class="lr-section" style={{ marginTop: 0 }}>{doneCount}/{goal} gelesen</p>
      )}
      {loading ? (
        <Dots />
      ) : articles.length === 0 ? (
        <p class="sl-muted">Keine Lektionen für diesen Tag.</p>
      ) : (
        <ArticleList articles={articles} next={next} allDone={doneCount >= goal} onOpen={onOpen} />
      )}

      {groups.length > 0 && (
        <>
          <p class="lr-section" style={{ marginTop: '22px' }}>Aus den Rubriken</p>
          {groups.map((g) => {
            const open = openAreas.has(g.meta.id);
            const seen = g.items.filter((a) => isCompleted(a.url)).length;
            return (
              <div class="ch-rubrik" key={g.meta.id}>
                <button class={`ch-rubrik-head ${open ? 'open' : ''}`} onClick={() => toggleArea(g.meta.id)} aria-expanded={open}>
                  <span class={`lr-tile-ico ${g.meta.color}`}>{g.meta.icon}</span>
                  <span class="ch-rubrik-label">{g.meta.label}</span>
                  <span class="ch-rubrik-count">{seen > 0 ? `${seen}/${g.items.length}` : g.items.length}</span>
                  <span class="ch-rubrik-chev">›</span>
                </button>
                {open && (
                  <ul class="lr-list">
                    {g.items.map((a) => {
                      const done = isCompleted(a.url);
                      return (
                        <li key={a.id}>
                          <button class={`lr-item ${done ? 'done' : ''}`} onClick={() => pickArea(a)}>
                            {a.thumbnail
                              ? <img class="lr-thumb" src={a.thumbnail} alt="" loading="lazy" />
                              : <span class="lr-thumb lr-thumb-ph">{a.title.slice(0, 1)}</span>}
                            <span class="lr-item-body"><span class="lr-item-title">{a.title}</span></span>
                            <span class={`lr-item-state ${done ? 'done' : ''}`}>{done ? '✓' : 'lesen ›'}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </>
      )}
    </main>
  );
}

/* --------------------------------------------------------------- Report --- */

function ReportTab({ settings, onDeck, onTest, onRoute }: {
  settings: PwaSettings;
  onDeck: () => void;
  onTest: () => void;
  onRoute: () => void;
}) {
  const s = getStats();
  const deck = getDeck().length;
  const maxDay = Math.max(1, ...s.last7.map((d) => d.xp));
  const acc = s.streak; // streak kept here (not as a home flame)
  const prog = getStageProgress(settings.level);
  const [cleared, setCleared] = useState(0);
  useEffect(() => {
    let alive = true;
    if (prog.atAufstieg) setCleared(ETAPPE_GOAL);
    else void etappeBatch(settings, prog.etappe).then((b) => { if (alive) setCleared(b.cleared); });
    return () => { alive = false; };
  }, [settings.learn, settings.native, settings.level, prog.etappe]);
  const ready = prog.atAufstieg || cleared >= ETAPPE_GOAL;
  const pct = Math.round((prog.etappe + (prog.atAufstieg ? 0 : Math.min(cleared / ETAPPE_GOAL, 1))) / ETAPPEN_PER_LEVEL * 100);
  return (
    <main class="sl-main with-nav">
      <h1 class="tab-screen-title">Report</h1>

      <div class={`rep-stage ${ready ? 'ready' : ''}`}>
        <div class="rep-stage-top">
          <span class="rep-stage-label">{prog.label} → {prog.nextLevel}</span>
          <span class="rep-stage-pct">{pct}%</span>
        </div>
        <div class="rep-stage-bar"><i style={{ width: `${pct}%` }} /></div>
        {ready ? (
          <button class="rep-stage-test" onClick={onTest}><span class="rep-test-ico"><IconTarget /></span>{prog.atAufstieg ? 'Aufstiegstest starten' : 'Etappentest starten'}</button>
        ) : (
          <p class="rep-stage-hint">{prog.atAufstieg ? '' : `Lerne diese Woche ${ETAPPE_GOAL} neue Wörter — dann öffnet der Etappentest (${Math.min(cleared, ETAPPE_GOAL)}/${ETAPPE_GOAL}).`}</p>
        )}
      </div>

      <div class="rep-kpis">
        <div class="rep-kpi"><b>{s.level}</b><span>Level</span></div>
        <div class="rep-kpi"><b>{s.totalXp}</b><span>XP gesamt</span></div>
        <div class="rep-kpi"><b>{deck}</b><span>Vokabeln</span></div>
        <div class="rep-kpi"><b>{acc}</b><span>Tage-Streak</span></div>
      </div>

      <div class="rep-card">
        <h3>XP · letzte 7 Tage</h3>
        <div class="rep-week">
          {s.last7.map((d) => (
            <div class="rep-day">
              <div class="rep-bar" style={{ height: `${Math.round((d.xp / maxDay) * 92)}%` }} />
              <span class="rep-day-l">{['Mo','Di','Mi','Do','Fr','Sa','So'][new Date(d.key).getDay() === 0 ? 6 : new Date(d.key).getDay() - 1]}</span>
            </div>
          ))}
        </div>
      </div>

      <div class="rep-card">
        <h3>Heute</h3>
        <div class="rep-row"><span>XP heute</span><b>{s.todayXp} / {s.goal}</b></div>
        <div class="rep-row"><span>Level-Fortschritt</span><b>{s.intoLevel} / {s.levelSpan} XP</b></div>
      </div>

      <button class="lr-vocab" onClick={onRoute}>Lernroute ansehen →</button>
      <button class="lr-vocab" onClick={onDeck}>Meine Vokabeln · {deck} →</button>
    </main>
  );
}

/* -------------------------------------------------------------- Settings --- */

function SettingsTab({ settings, onPatch }: {
  settings: PwaSettings;
  onPatch: (p: Partial<PwaSettings>) => void;
}) {
  function doExport() {
    const blob = new Blob([exportData()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `learny-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  async function doImport(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const ok = importData(await file.text());
    if (ok) { alert('Importiert ✓ — die App wird neu geladen.'); location.reload(); }
    else alert('Import fehlgeschlagen — ist das eine Learny-Sicherung (.json)?');
  }
  return (
    <main class="sl-main with-nav">
      <h1 class="tab-screen-title">Einstellungen</h1>

      <div class="set-group">
        <p class="set-label">Sprache lernen</p>
        <div class="set-grid">
          {LANGUAGES.filter((l) => l !== settings.native).map((l) => (
            <button class={`set-choice ${settings.learn === l ? 'sel' : ''}`} onClick={() => onPatch({ learn: l })}>
              {LANG_LABELS[l]}
            </button>
          ))}
        </div>
      </div>

      <div class="set-group">
        <p class="set-label">Niveau</p>
        <div class="set-grid">
          {LEVELS.map((l) => (
            <button class={`set-choice ${settings.level === l ? 'sel' : ''}`} onClick={() => onPatch({ level: l })}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div class="set-group">
        <p class="set-label">Theme</p>
        <div class="theme-grid">
          {THEMES.map((t) => (
            <button class={`theme-card ${settings.theme === t.id ? 'sel' : ''}`} onClick={() => onPatch({ theme: t.id })}>
              <span class="theme-prev" style={{ background: t.bg }} />
              <span class="theme-dots"><i style={{ background: t.dots[0] }} /><i style={{ background: t.dots[1] }} /></span>
              <span class="theme-name">{t.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div class="set-group">
        <p class="set-label">Daten · Sicherung</p>
        <p class="sl-muted" style={{ margin: '0 0 10px' }}>
          Dein Fortschritt (Streak, Route, Vokabeln) liegt nur auf diesem Gerät. Exportiere ihn vor
          App-Löschen oder Handywechsel — und importiere ihn am neuen Gerät.
        </p>
        <div class="set-grid">
          <button class="set-choice" onClick={doExport}>⤓ Exportieren</button>
          <label class="set-choice" style={{ textAlign: 'center', cursor: 'pointer' }}>
            ⤒ Importieren
            <input type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={doImport} />
          </label>
        </div>
      </div>

      <div class="set-group">
        <p class="set-label">App</p>
        <div class="set-version">
          <span>Version <b>{__APP_VERSION__}</b></span>
          <UpdateCheck />
        </div>
      </div>

      <p class="sl-muted">Learny · Teil der Sidelearn-Familie · Texte: Wikipedia (CC BY-SA)</p>
    </main>
  );
}

function UpdateCheck() {
  const [state, setState] = useState<'idle' | 'checking' | 'current'>('idle');
  // The Updater banner appears (sl-need-refresh) if a new version is found.
  useEffect(() => {
    const h = () => setState('idle');
    window.addEventListener('sl-need-refresh', h);
    return () => window.removeEventListener('sl-need-refresh', h);
  }, []);
  async function check() {
    setState('checking');
    const c = (window as unknown as { __slCheckUpdate?: () => Promise<boolean> }).__slCheckUpdate;
    let found = false;
    try { found = (await c?.()) ?? false; } catch { /* ignore */ }
    // If a new version was detected the banner fires (sl-need-refresh → 'idle');
    // give the SW a moment to install, then settle on "up to date" if nothing came.
    setTimeout(() => setState((s) => (s === 'checking' ? 'current' : s)), found ? 2500 : 1200);
  }
  return (
    <button class="set-update" onClick={check} disabled={state === 'checking'}>
      {state === 'checking' ? 'Suche …' : state === 'current' ? 'Aktuell ✓' : 'Auf Updates prüfen'}
    </button>
  );
}

/* ------------------------------------------------------ Wörterbuch (dict) --- */

interface DRow { word: string; b?: string; senses: RichSense[] }

function DictView({ settings, initialMode, onBack }: {
  settings: PwaSettings;
  initialMode: 'all' | 'mine';
  onBack: () => void;
}) {
  const [mode, setMode] = useState<'all' | 'mine'>(initialMode);
  const [q, setQ] = useState('');
  const [rich, setRich] = useState<Record<string, RichEntry> | null>(null);
  const [open, setOpen] = useState<string | null>(null); // expanded word
  const [, force] = useState(0); // bump to re-render after a deck change
  // Search miss → look the word up in the full bundled dictionary (inflection-aware).
  const [fb, setFb] = useState<DRow | null | 'loading'>(null);

  useEffect(() => {
    let alive = true;
    loadRichDict(settings.learn, settings.native).then((m) => { if (alive) setRich(m); });
    return () => { alive = false; };
  }, [settings.learn, settings.native]);

  const toggleSave = (word: string, translation: string) => {
    if (inDeck(settings.learn, word)) removeFromDeck(settings.learn, word);
    else addToDeck({ word, translation, lang: settings.learn, ts: Date.now() });
    force((n) => n + 1);
  };

  const ql = q.trim().toLowerCase();
  let rows: DRow[] = [];
  if (mode === 'mine') {
    rows = getDeck().filter((d) => d.lang === settings.learn).map((d) => ({ word: d.word, senses: [{ t: d.translation || '—' }] }));
    if (ql) rows = rows.filter((r) => r.word.toLowerCase().includes(ql) || r.senses.some((s) => s.t.toLowerCase().includes(ql)));
  } else if (rich) {
    const matched = Object.entries(rich).filter(([w, e]) =>
      ql ? w.includes(ql) || e.s.some((s) => s.t.toLowerCase().includes(ql))
         : !e.b || !isAboveLevel(e.b as CefrLevel, settings.level), // browse: up to level
    );
    rows = matched.slice(0, ql ? 60 : 150).map(([w, e]) => ({ word: w, b: e.b, senses: e.s }));
  }

  useEffect(() => {
    let alive = true;
    if (mode !== 'all' || ql.length < 2 || rows.length > 0) { setFb(null); return; }
    setFb('loading');
    void (async () => {
      const r = await richLookup(ql, settings.learn, settings.native);
      if (!alive) return;
      if (r?.s?.length) { setFb({ word: ql, b: r.b, senses: r.s }); return; }
      const senses = await lookup(ql, settings.learn, settings.native);
      if (!alive) return;
      const tr = senses[0]?.translations?.slice(0, 3).join(', ');
      setFb(tr ? { word: ql, senses: [{ t: tr }] } : null);
    })();
    return () => { alive = false; };
  }, [ql, mode, rows.length, settings.learn, settings.native]);

  const displayed: DRow[] = rows.length ? rows : (fb && fb !== 'loading' ? [fb] : []);

  return (
    <main class="sl-main">
      <header class="sl-lessonhead">
        <button class="sl-back" onClick={onBack} aria-label="Zurück">←</button>
        <span class="sl-lessontitle">Wörterbuch</span>
      </header>

      <div class="dict-tools">
        <div class="dict-seg">
          <button class={mode === 'all' ? 'on' : ''} onClick={() => setMode('all')}>Alle</button>
          <button class={mode === 'mine' ? 'on' : ''} onClick={() => setMode('mine')}>Meine</button>
        </div>
        <input class="dict-search" placeholder="Suchen …" value={q} onInput={(e) => setQ(e.currentTarget.value)} />
      </div>

      {(mode === 'all' && rich === null) || (rows.length === 0 && fb === 'loading') ? (
        <Dots />
      ) : displayed.length === 0 ? (
        <p class="sl-muted">
          {mode === 'mine'
            ? 'Noch keine Merkwörter. Tippe beim Lesen ein Wort an und drücke „★ merken".'
            : ql
              ? 'Nichts gefunden.'
              : `Für ${LANG_LABELS[settings.learn]} gibt es noch kein Wörterbuch.`}
        </p>
      ) : (
        <ul class="sl-deck">
          {displayed.map((r) => {
            const saved = inDeck(settings.learn, r.word);
            const expanded = open === r.word;
            const s0 = r.senses[0];
            return (
              <li class="dict-row" key={r.word}>
                <div class="dict-row-head">
                  <button class="dict-row-main" onClick={() => setOpen(expanded ? null : r.word)}>
                    <span class="sl-deck-word">{r.word}</span>
                    <span class="sl-deck-trans">{s0?.t}{s0?.p ? <span class="dict-pos"> · {s0.p}</span> : null}</span>
                    {r.b ? <span class="sl-deck-band">{r.b}</span> : null}
                  </button>
                  <button
                    class={`dict-add${saved ? ' on' : ''}`}
                    aria-label={saved ? 'entfernen' : 'merken'}
                    onClick={() => toggleSave(r.word, s0?.t ?? '')}
                  >
                    {saved ? '★' : '☆'}
                  </button>
                </div>
                {expanded && (
                  <div class="dict-detail">
                    {r.senses.map((s, i) => (
                      <div class="dict-sense" key={i}>
                        <span class="dict-sense-t">{s.t}{s.p ? <span class="dict-pos"> · {s.p}</span> : null}</span>
                        {s.ex && <span class="dict-sense-ex">„{s.ex}"{s.exd ? <span class="dict-sense-exd"> — {s.exd}</span> : null}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

/* --------------------------------------------------- per-paragraph questions --- */

type QKind = 'quiz' | 'vocab' | 'cloze';
interface LessonQuestion { kind: QKind; q: string; options: string[]; correct: number }

const Q_LABEL: Record<QKind, string> = { quiz: 'Verständnis', vocab: 'Vokabel', cloze: 'Lückentext' };

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function sampleN<T>(arr: T[], n: number): T[] {
  return shuffleInPlace([...arr]).slice(0, n);
}

/**
 * One question per paragraph, type chosen at random (comprehension quiz from the
 * prep, a vocab-meaning MC, or a cloze MC) with no two same types in a row. All
 * client-side — vocab translations come from the bundled dictionary.
 */
async function buildLessonQuestions(lesson: ServerLesson, settings: PwaSettings): Promise<(LessonQuestion | null)[]> {
  const vocabWords = lesson.vocab.map((v) => v.word).filter(Boolean);
  const pairs = await Promise.all(
    vocabWords.map(async (w) => {
      try {
        const i = await resolveWord(w, settings.learn, settings.native, settings.level);
        return [w, (i.senses[0]?.translations[0] ?? '').trim()] as const;
      } catch {
        return [w, ''] as const;
      }
    }),
  );
  const trans = new Map(pairs.filter(([, t]) => t));
  const transValues = [...new Set(trans.values())];

  const out: (LessonQuestion | null)[] = [];
  let prev: QKind | '' = '';
  for (const p of lesson.paragraphs) {
    const text = p.simplified;
    const quiz: LessonQuestion | null = p.question?.options?.length
      ? { kind: 'quiz', q: p.question.q, options: p.question.options, correct: p.question.correct }
      : null;

    const cands: QKind[] = [];
    if (quiz) cands.push('quiz');
    const here = vocabWords.filter(
      (w) => trans.has(w) && new RegExp(`(^|[^\\p{L}])${escapeRe(w)}([^\\p{L}]|$)`, 'iu').test(text),
    );
    if (here.length && transValues.length >= 4) cands.push('vocab');
    const cz = buildClozeQuestions(text, vocabWords, vocabWords, Math.random, 1)[0];
    if (cz && cz.options.length >= 2) cands.push('cloze');

    if (!cands.length) { out.push(quiz); continue; }
    let pickFrom = cands.filter((c) => c !== prev);
    if (!pickFrom.length) pickFrom = cands;
    const type = pickFrom[Math.floor(Math.random() * pickFrom.length)]!;
    prev = type;

    if (type === 'quiz') {
      out.push(quiz);
    } else if (type === 'vocab') {
      const word = here[Math.floor(Math.random() * here.length)]!;
      const correct = trans.get(word)!;
      const options = shuffleInPlace([correct, ...sampleN(transValues.filter((t) => t !== correct), 3)]);
      out.push({ kind: 'vocab', q: `Was bedeutet „${word}"?`, options, correct: options.indexOf(correct) });
    } else {
      out.push({ kind: 'cloze', q: cz!.prompt, options: cz!.options, correct: cz!.options.indexOf(cz!.answer) });
    }
  }
  return out;
}

/* -------------------------------------------------------------- Lesson --- */

function Lesson({
  article,
  route,
  readLevel,
  settings,
  onLevel,
  onBack,
  onOpen,
  onHome,
}: {
  article: { id: string; title: string; url: string; thumb?: string };
  route: boolean;
  readLevel?: CefrLevel; // when set, read this article one step above the user's level (i+1 stretch)
  settings: PwaSettings;
  onLevel: (l: CefrLevel) => void;
  onBack: () => void;
  onOpen: (a: ArticleRef, route?: boolean, readLevel?: CefrLevel) => void;
  onHome: () => void;
}) {
  const { daily } = useDaily(settings.learn, settings.level);
  const [lesson, setLesson] = useState<ServerLesson | null>(null);
  const [error, setError] = useState(false);
  const saved = getProgress(article.url);
  const [visible, setVisible] = useState(saved?.progress ?? 1);
  const [completed, setCompleted] = useState(saved?.completed ?? false);
  const [score, setScore] = useState({ answered: saved?.answered ?? 0, correct: saved?.correct ?? 0 });
  const [quizIdx, setQuizIdx] = useState<number | null>(null);
  const [answer, setAnswer] = useState<number | null>(null);
  const [questions, setQuestions] = useState<(LessonQuestion | null)[] | null>(null);
  const [pop, setPop] = useState<{ word: string; sentence: string; x: number; y: number } | null>(null);
  const [ranks, setRanks] = useState<Record<string, number> | null>(null);
  const [names, setNames] = useState<Set<string>>(new Set());
  // Award XP only for a lesson not yet credited (no farming by re-reading).
  const creditable = useRef(!isLessonCredited(article.url));
  const lessonCredited = useRef(isLessonCredited(article.url));
  const challengeDone = useRef(false);
  const [showChallenge, setShowChallenge] = useState(false);
  // Confetti the daily goal only when finished in-session (not on revisit).
  const freshDone = useRef(false);
  const [celebrated, setCelebrated] = useState(false);
  const [wordsLearned, setWordsLearned] = useState(0); // next-level target words met in this article

  // Load frequency ranks + names so we can mark words above the user's level
  // (visible reading aid, like the live pages).
  useEffect(() => {
    void loadRanks(settings.learn).then(setRanks);
    void loadNames().then(setNames);
  }, [settings.learn]);

  const lvl = readLevel ?? settings.level; // level this article is read at (+1 for a stretch read)

  const isHard = (w: string): boolean => {
    if (!ranks || w.length < 3 || names.has(w.toLowerCase())) return false;
    const r = rankOf(ranks, w);
    return r !== undefined && isAboveLevel(rankToBand(r), settings.level);
  };

  useEffect(() => {
    let alive = true;
    void fetchServerLesson(SERVER, article.id, lvl).then((l) => {
      if (!alive) return;
      if (l) setLesson(l);
      else setError(true);
    });
    return () => {
      alive = false;
    };
  }, [article.id, lvl]);

  // Build one question per paragraph (random type, no LLM). See buildLessonQuestions.
  useEffect(() => {
    if (!lesson) return;
    let alive = true;
    void buildLessonQuestions(lesson, settings).then((q) => { if (alive) setQuestions(q); });
    return () => { alive = false; };
  }, [lesson, settings.learn, settings.level]);

  useEffect(() => {
    if (!lesson) return;
    saveProgress(article.url, { progress: visible, completed, answered: score.answered, correct: score.correct });
  }, [visible, completed, score, lesson]);

  // Confetti when the just-finished lesson completes the daily goal.
  useEffect(() => {
    if (!completed || !freshDone.current || celebrated || !daily) return;
    const arts = daily.articles ?? [];
    const goal = daily.goal ?? 2;
    const done = arts.filter((a) => isCompleted(a.url)).length;
    if (arts.some((a) => a.url === article.url) && done >= goal) { celebrate(); setCelebrated(true); }
  }, [completed, daily]);

  if (error) return <Frame title={article.title} onBack={onBack}><p class="sl-muted">Lektion nicht verfügbar.</p></Frame>;
  if (!lesson) return <Frame title={article.title} onBack={onBack}><Dots /></Frame>;

  const total = lesson.paragraphs.length;
  const lastIdx = visible - 1;
  const CHALLENGE = 5; // mandatory paragraphs; the rest are optional bonus

  // Credit the lesson once (daily-challenge counts as done): lesson XP + streak
  // route node + activity log. Persistent, so re-reads don't re-credit.
  function creditLessonOnce() {
    if (lessonCredited.current) return;
    if (creditable.current) award(XP.lesson);
    creditLesson(article.url);
    logActivity({
      type: 'lesson',
      level: settings.level,
      title: article.title,
      detail: score.answered > 0 ? `Quiz ${score.correct}/${score.answered}` : undefined,
    });
    if (route) {
      completeActivity(settings.level, 'lesson'); // daily read advances the route
      markDailyDone('article');
      if (readLevel) markDailyDone('article_plus1'); // the +1 stretch read
    } else {
      markDailyDone('rubrik'); // self-initiated read (Artikelrubriken / free): bonus, no route advance
    }
    // Passive learning: credit next-level target words that appear in this article.
    if (lesson) {
      void creditWordsFromText(settings, lesson.paragraphs.map((p) => p.simplified).join(' '), article.title)
        .then((n) => { if (n > 0) { setWordsLearned(n); award(XP.merken * n); } });
    }
    lessonCredited.current = true;
    freshDone.current = true;
  }

  function advance() {
    // Challenge fulfilled after CHALLENGE paragraphs (in longer articles): credit
    // now, then offer bonus / next article / overview.
    if (!challengeDone.current && visible >= CHALLENGE && visible < total) {
      challengeDone.current = true;
      creditLessonOnce();
      setShowChallenge(true);
      return;
    }
    if (visible < total) {
      if (creditable.current) award(XP.paragraph);
      setVisible((v) => v + 1);
    } else {
      creditLessonOnce();
      setCompleted(true);
    }
  }
  function onRead() {
    const q = questions?.[lastIdx];
    if (q && answer === null) setQuizIdx(lastIdx);
    else advance();
  }

  return (
    <Frame
      title={article.title}
      onBack={onBack}
      level={
        readLevel ? (
          <span class="sl-stretch" title="Eine Stufe über deinem Level — für neue Wörter">+1 · {lvl}</span>
        ) : (
          <div class="sl-levels">
            {LEVELS.map((l) => (
              <button class={`sl-lvlbtn ${l === settings.level ? 'on' : ''}`} onClick={() => onLevel(l)}>
                {l}
              </button>
            ))}
          </div>
        )
      }
    >
      <p class="sl-progress">
        Absatz {Math.min(visible, total)} / {total}
        {total >= 8 ? ' · Auszug' : ''}
        {readLevel ? ` · +1 (${lvl})` : ''}
      </p>
      <p class="sl-hint"><span class="sl-hint-ico"><IconBulb /></span> Tippe ein <span class="sl-hint-mark">markiertes</span> Wort für die Übersetzung.</p>

      {lesson.paragraphs.slice(0, visible).map((p, i) => (
        <div key={i} class={`sl-para ${i === lastIdx && !completed ? 'current' : 'past'}`}>
          <p class="sl-text">
            <TapText
              text={p.simplified}
              isHard={isHard}
              onWord={(word, x, y) => setPop({ word, sentence: p.simplified, x, y })}
            />
          </p>
          {i === lastIdx && !completed && !showChallenge && quizIdx === null && (
            <button class="sl-read" onClick={onRead}>
              {i === total - 1 ? 'Fertig ✓' : 'Gelesen ✓'}
            </button>
          )}
        </div>
      ))}

      {showChallenge && !completed && (() => {
        const arts = daily?.articles ?? [];
        const next = arts.find((a) => !isCompleted(a.url) && a.url !== article.url);
        return (
          <section class="sl-done">
            <span class="sl-done-ico"><IconSparkles /></span>
            <h2>Challenge erfüllt!</h2>
            {wordsLearned > 0 && <p class="sl-done-words">+{wordsLearned} neue Wörter aus diesem Artikel gelernt</p>}
            <p class="sl-done-daily">{CHALLENGE} Absätze geschafft — stark! Lies {total - CHALLENGE} weitere für Bonus-XP, oder mach beim nächsten Artikel weiter.</p>
            <div class="sl-done-actions">
              <button class="sl-read primary" onClick={() => { setShowChallenge(false); setVisible((v) => v + 1); }}>
                Weiterlesen · Bonus +
              </button>
              {next && (
                <button class="sl-read ghost" onClick={() => onOpen({ id: next.id, title: next.title, url: next.url, thumb: next.thumbnail }, true, stretchReadLevel(daily?.articles ?? [], next.url, settings.level))}>
                  Nächster Artikel <span class="sl-btn-ico"><IconArrowRight /></span>
                </button>
              )}
              <button class="sl-read ghost" onClick={onHome}>Zur Übersicht</button>
            </div>
          </section>
        );
      })()}

      {quizIdx !== null && questions?.[quizIdx] && (
        <>
          <p class="sl-qlabel">{Q_LABEL[questions[quizIdx]!.kind]}</p>
          <Quiz
            q={{ q: questions[quizIdx]!.q, options: questions[quizIdx]!.options, correct: questions[quizIdx]!.correct }}
            answer={answer}
            isLast={quizIdx === total - 1}
            settings={settings}
            translate={questions[quizIdx]!.kind === 'vocab' ? undefined : questions[quizIdx]!.q}
            onAnswer={(idx) => {
              if (answer !== null) return;
              setAnswer(idx);
              const ok = idx === questions[quizIdx]!.correct;
              if (ok && creditable.current) award(XP.correct);
              setScore((s) => ({ answered: s.answered + 1, correct: s.correct + (ok ? 1 : 0) }));
            }}
            onNext={() => {
              setQuizIdx(null);
              setAnswer(null);
              advance();
            }}
          />
        </>
      )}

      {completed && (() => {
        const arts = daily?.articles ?? [];
        const inDaily = arts.some((a) => a.url === article.url);
        const goal = daily?.goal ?? 2;
        const doneCount = arts.filter((a) => isCompleted(a.url)).length;
        const allDone = inDaily && doneCount >= goal;
        const next = arts.find((a) => !isCompleted(a.url) && a.url !== article.url);
        return (
          <section class="sl-done">
            <span class="sl-done-ico"><IconSparkles /></span>
            <h2>{allDone ? 'Tagesziel erreicht!' : 'Geschafft'}</h2>
            {wordsLearned > 0 && <p class="sl-done-words">+{wordsLearned} neue Wörter aus diesem Artikel gelernt</p>}
            {score.answered > 0 && <p class="sl-done-score">Quiz: {score.correct} / {score.answered} richtig</p>}
            {inDaily && (
              <p class="sl-done-daily">
                {allDone
                  ? `${doneCount} von ${goal} der Tageslektion gelesen.`
                  : `${doneCount} von ${goal} der Tageslektion geschafft${next ? ' — noch einer fehlt.' : '.'}`}
              </p>
            )}
            <div class="sl-done-actions">
              {inDaily && !allDone && next && (
                <button class="sl-read primary" onClick={() => onOpen({ id: next.id, title: next.title, url: next.url, thumb: next.thumbnail }, true, stretchReadLevel(daily?.articles ?? [], next.url, settings.level))}>
                  Nächster Artikel <span class="sl-btn-ico"><IconArrowRight /></span>
                </button>
              )}
              <button class={`sl-read ${inDaily && !allDone && next ? 'ghost' : ''}`} onClick={onHome}>Zur Übersicht</button>
            </div>
          </section>
        );
      })()}

      <footer class="sl-credit">
        Quelle: <a href={lesson.url} target="_blank" rel="noopener noreferrer">Wikipedia</a> · CC BY-SA
      </footer>

      {pop && (
        <WordPopover pop={pop} settings={settings} onClose={() => setPop(null)} />
      )}
    </Frame>
  );
}

function Frame({
  title,
  level,
  onBack,
  children,
}: {
  title: string;
  level?: ComponentChildren;
  onBack: () => void;
  children: ComponentChildren;
}) {
  return (
    <main class="sl-main">
      <header class="sl-lessonhead">
        <button class="sl-back" onClick={onBack} aria-label="Zurück">←</button>
        <span class="sl-lessontitle">{title}</span>
      </header>
      {level}
      {children}
    </main>
  );
}

/* ------------------------------------------------------ tappable words --- */

function TapText({
  text,
  isHard,
  onWord,
}: {
  text: string;
  isHard: (w: string) => boolean;
  onWord: (w: string, x: number, y: number) => void;
}) {
  const tokens = text.split(/(\p{L}[\p{L}\-']*)/u);
  return (
    <>
      {tokens.map((tok, i) =>
        i % 2 === 1 ? (
          <span
            class={`sl-word ${isHard(tok) ? 'mark' : ''}`}
            onClick={(e) => {
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              onWord(tok, r.left, r.bottom);
            }}
          >
            {tok}
          </span>
        ) : (
          tok
        ),
      )}
    </>
  );
}

function WordPopover({
  pop,
  settings,
  onClose,
}: {
  pop: { word: string; sentence: string; x: number; y: number };
  settings: PwaSettings;
  onClose: () => void;
}) {
  const [band, setBand] = useState<string | null>(null);
  const [translation, setTranslation] = useState<string | null>(null);
  const [alts, setAlts] = useState<string[]>([]);
  const [example, setExample] = useState('');
  const [exampleDe, setExampleDe] = useState('');
  const [pos, setPos] = useState('');
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(inDeck(settings.learn, pop.word));

  useEffect(() => {
    let alive = true;
    setLoading(true);
    // Band from the local frequency data (instant); translation from the server
    // WITH sentence context (correct sense + alternatives), dict as fallback.
    void resolveWord(pop.word, settings.learn, settings.native, settings.level).then((i) => {
      if (alive) setBand(i.band);
    });
    void (async () => {
      // 1) Rich offline dictionary (instant, no network) — the primary path.
      const rich = await richLookup(pop.word, settings.learn, settings.native);
      if (!alive) return;
      const s0 = rich?.s[0];
      if (s0) {
        setTranslation(s0.t);
        setAlts([...new Set([...(rich?.s ?? []).slice(1).map((s) => s.t), ...(rich?.alt ?? [])])].slice(0, 4));
        setPos(s0.p ?? '');
        setExample(s0.ex ?? '');
        setExampleDe(s0.exd ?? '');
        if (rich?.b) setBand(rich.b);
        setLoading(false);
        return;
      }
      // 2) Server /translate WITH sentence context, then 3) offline dict fallback.
      const sv = await fetchWordTranslation(SERVER, settings.learn, settings.native, pop.word, pop.sentence);
      if (!alive) return;
      if (sv) {
        setTranslation(sv.translation);
        setAlts(sv.alternatives);
        setExample(sv.example);
        setPos(sv.pos);
      } else {
        // offline / over budget → context-free dictionary fallback
        const i = await resolveWord(pop.word, settings.learn, settings.native, settings.level);
        if (!alive) return;
        const senses = i.senses[0]?.translations.slice(0, 4) ?? [];
        setTranslation(senses[0] ?? '');
        setAlts(senses.slice(1));
      }
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [pop.word, pop.sentence]);

  function merken() {
    if (saved || !translation) return;
    if (addToDeck({ word: pop.word, translation, lang: settings.learn, context: pop.sentence, ts: Date.now() })) {
      award(XP.merken);
    }
    setSaved(true);
  }

  return (
    <>
      <div class="sl-pop-backdrop" onClick={onClose} />
      <div class="sl-pop" style={{ top: `${pop.y + 8}px`, left: `${Math.min(pop.x, window.innerWidth - 240)}px` }}>
        <div class="sl-pop-head">
          <b>{pop.word}</b>
          {band && <span class="sl-pop-band" data-band={band[0]}>{band}</span>}
        </div>
        {loading ? (
          <Dots />
        ) : translation ? (
          <>
            <p class="sl-pop-trans">
              {translation}
              {pos && <span class="sl-pop-pos"> · {pos}</span>}
            </p>
            {alts.length > 0 && <p class="sl-pop-alts">auch: {alts.join(', ')}</p>}
            {example && <p class="sl-pop-ex">„{example}"{exampleDe && <span class="sl-pop-exd"> — {exampleDe}</span>}</p>}
          </>
        ) : (
          <p class="sl-muted">keine Übersetzung gefunden</p>
        )}
        <button class={`sl-merken ${saved ? 'saved' : ''}`} disabled={saved || !translation} onClick={merken}>
          <span class="sl-merken-ico"><IconStar /></span>{saved ? 'gemerkt' : 'merken'}
        </button>
      </div>
    </>
  );
}

/* ------------------------------------------------------ translate reveal --- */

function TranslateReveal({ text, settings }: { text: string; settings: PwaSettings }) {
  const [t, setT] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Reset when the sentence changes (next gap/question) — otherwise the previous
  // gap's translation lingers and is shown against the new, unrelated sentence.
  useEffect(() => { setT(null); setLoading(false); }, [text]);
  if (!text || settings.learn === settings.native) return null;
  async function go() {
    if (t !== null || loading) return;
    setLoading(true);
    const r = await fetchSentenceTranslation(SERVER, settings.learn, settings.native, text);
    setT(r ?? '—');
    setLoading(false);
  }
  return (
    <div class="sl-xlate">
      {t !== null ? (
        <p class="sl-xlate-txt">{t}</p>
      ) : (
        <button class="sl-xlate-btn" disabled={loading} onClick={go}>
          {loading ? 'Übersetze …' : '🌐 Übersetzung'}
        </button>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- quiz --- */

function Quiz({
  q,
  answer,
  isLast,
  onAnswer,
  onNext,
  settings,
  translate,
}: {
  q: { q: string; options: string[]; correct: number };
  answer: number | null;
  isLast: boolean;
  onAnswer: (i: number) => void;
  onNext: () => void;
  settings: PwaSettings;
  translate?: string;
}) {
  const optsRef = useRef<HTMLDivElement>(null);
  // Small confetti pop on a correct answer, anchored at the correct option.
  useEffect(() => {
    if (answer === null || answer !== q.correct) return;
    const el = optsRef.current?.querySelector('.sl-quiz-opt.correct');
    if (el) { const r = el.getBoundingClientRect(); pop(r.left + r.width / 2, r.top + r.height / 2); }
  }, [answer]);
  return (
    <div class="sl-quiz">
      <p class="sl-quiz-q">{q.q}</p>
      {translate && <TranslateReveal text={translate} settings={settings} />}
      <div class="sl-quiz-opts" ref={optsRef}>
        {q.options.map((opt, i) => {
          let cls = '';
          if (answer !== null) cls = i === q.correct ? 'correct' : i === answer ? 'wrong' : 'dim';
          return (
            <button class={`sl-quiz-opt ${cls}`} disabled={answer !== null} onClick={() => onAnswer(i)}>
              {opt}
            </button>
          );
        })}
      </div>
      {answer !== null && (
        <button class="sl-read" onClick={onNext}>{isLast ? 'Fertig ✓' : 'Weiter →'}</button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- update --- */

function Updater() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const h = () => setShow(true);
    window.addEventListener('sl-need-refresh', h);
    return () => window.removeEventListener('sl-need-refresh', h);
  }, []);
  if (!show) return null;
  const apply = () => {
    const u = (window as unknown as { __slUpdate?: (r?: boolean) => Promise<void> }).__slUpdate;
    if (u) void u(true);
    else location.reload();
  };
  return (
    <div class="sl-update" onClick={apply}>
      Neue Version verfügbar — tippen zum Aktualisieren.
    </div>
  );
}

function Dots() {
  return (
    <span class="sl-dots"><i /><i /><i /></span>
  );
}
