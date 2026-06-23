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
import { loadRanks, rankOf } from '@/core/difficulty/frequency';
import { loadNames } from '@/core/names';
import { resolveWord } from '@/core/wordinfo';
import {
  fetchServerArchive,
  fetchServerDaily,
  fetchSentenceTranslation,
  fetchServerLesson,
  fetchSurprise,
  fetchWordTranslation,
  type ServerDaily,
  type ServerLesson,
} from '@/core/serverapi';
import { buildClozeQuestions } from '@/core/cloze';
import { type QuizQuestion } from '@/core/quiz';
import { getSettings, saveSettings, getProgress, isCompleted, saveProgress, exportData, importData, type PwaSettings } from './store';
import { award, creditLesson, isLessonCredited, getStats, XP } from './gamify';
import { addToDeck, getDeck, inDeck, removeFromDeck, type DeckEntry } from './deck';
import { THEMES, applyTheme } from './theme';
import {
  bandRankRange,
  completeActivity,
  getRouteProgress as getStageProgress,
  nodeType,
  nextLevel,
  ETAPPEN_PER_LEVEL,
  NODES_PER_ETAPPE,
  NODES_PER_LEVEL,
  STAGE_LEVELS,
  type CompleteResult,
  type NodeType,
} from './route';
import { pseudoWordsFor } from './pseudowords';
import { getActivity, logActivity, type Activity } from './activity';
import { pop, celebrate } from './confetti';

type Tab = 'home' | 'challenges' | 'report' | 'settings';
type ArticleRef = { id: string; title: string; url: string; thumb?: string };

declare const __APP_VERSION__: string;

const SERVER = 'https://api.sidelearn.pyrates.io';
const LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

type Overlay =
  | { kind: 'lesson'; article: ArticleRef }
  | { kind: 'deck' }
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

  const openLesson = (article: ArticleRef) => setOverlay({ kind: 'lesson', article });
  const goTab = (t: Tab) => { setOverlay(null); setTab(t); };

  let content: ComponentChildren;
  if (overlay?.kind === 'lesson') {
    content = (
      <Lesson
        key={overlay.article.id + settings.level}
        article={overlay.article}
        settings={settings}
        onLevel={(level) => patch({ level })}
        onBack={() => setOverlay(null)}
        onOpen={openLesson}
        onHome={() => goTab('home')}
      />
    );
  } else if (overlay?.kind === 'deck') {
    content = <DeckView onBack={() => setOverlay(null)} />;
  } else if (overlay?.kind === 'trainer') {
    content = <TrainerView settings={settings} onBack={() => setOverlay(null)} />;
  } else if (overlay?.kind === 'surprise') {
    content = <SurpriseView settings={settings} onOpen={openLesson} onBack={() => setOverlay(null)} />;
  } else if (overlay?.kind === 'cloze') {
    content = <ClozeView settings={settings} onBack={() => setOverlay(null)} />;
  } else if (overlay?.kind === 'test') {
    content = getStageProgress(settings.level).nodeType === 'aufstieg' ? (
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
        onLesson={() => goTab('home')}
        onTrainer={() => setOverlay({ kind: 'trainer' })}
        onCloze={() => setOverlay({ kind: 'cloze' })}
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
        onDeck={() => setOverlay({ kind: 'deck' })}
        onSurprise={() => setOverlay({ kind: 'surprise' })}
        onCloze={() => setOverlay({ kind: 'cloze' })}
        onRoute={() => setOverlay({ kind: 'route' })}
        onTest={() => setOverlay({ kind: 'test' })}
      />
    );
  } else if (tab === 'challenges') {
    content = <ChallengesTab settings={settings} onOpen={openLesson} />;
  } else if (tab === 'report') {
    content = (
      <ReportTab
        settings={settings}
        onDeck={() => setOverlay({ kind: 'deck' })}
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

function HomeTab({ settings, onPatch, onOpen, onTrainer, onDeck, onSurprise, onCloze, onRoute, onTest }: {
  settings: PwaSettings;
  onPatch: (p: Partial<PwaSettings>) => void;
  onOpen: (a: ArticleRef) => void;
  onTrainer: () => void;
  onDeck: () => void;
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
  const goal = daily?.goal ?? 2;
  const doneCount = articles.filter((a) => isCompleted(a.url)).length;
  const allDone = articles.length > 0 && doneCount >= goal;
  const next = articles.find((a) => !isCompleted(a.url)) ?? articles[0];

  const stats = getStats();
  const prog = getStageProgress(settings.level);
  const level = prog.level;
  const levelPct = Math.round(Math.min(prog.node, NODES_PER_LEVEL) / NODES_PER_LEVEL * 100);
  const etappePct = Math.round(prog.ratio * 100);
  const lvlL = `${prog.level}.${prog.etappe}`;
  const lvlR = prog.etappe < ETAPPEN_PER_LEVEL ? `${prog.level}.${prog.etappe + 1}` : nextLevel(prog.level);
  const [hype] = useState(() => HYPE[Math.floor(Math.random() * HYPE.length)]);
  const pose: Pose = allDone ? 'party' : 'yay';
  const bubble = allDone
    ? 'Tagesziel erreicht — Gurki ist stolz.'
    : articles.length > 0 && doneCount > 0 && doneCount >= goal - 1
    ? 'Nur noch einer bis zum Ziel!'
    : hype;

  const launchNode = (t: NodeType) => {
    if (t === 'lesson') { if (next) onOpen({ id: next.id, title: next.title, url: next.url, thumb: next.thumbnail }); }
    else if (t === 'vocab') onTrainer();
    else if (t === 'cloze') onCloze();
    else onTest();
  };
  const cur = Math.min(prog.node, NODES_PER_LEVEL - 1);
  const miniIdx = [cur - 1, cur, cur + 1].filter((i) => i >= 0 && i < NODES_PER_LEVEL);

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
          <div class="h2-lvl-track"><i style={{ width: `${etappePct}%` }} /></div>
          <span class="h2-lvl-end next">{lvlR}</span>
        </div>
        <span class="h2-sub">Etappe {prog.etappe}/{ETAPPEN_PER_LEVEL} im Level {prog.level}{articles.length > 0 ? ` · Tagesziel ${Math.min(doneCount, goal)}/${goal}` : ''}</span>
        <div class="h2-bubble">{bubble}</div>
      </section>

      {loading ? (
        <Dots />
      ) : articles.length === 0 ? (
        <div class="h2-card empty">Heute noch keine Lektion für {LANG_LABELS[settings.learn]}. Schau später wieder vorbei.</div>
      ) : (
        <>
          <div class="h2-card">
            <span class="h2-card-ico"><IconNewspaper /></span>
            <span class="h2-card-body">
              <span class="h2-card-lbl">Tageslektion</span>
              <span class="h2-card-sub">{articles.length} Mini-Artikel · {Math.min(doneCount, goal)}/{goal} geschafft</span>
            </span>
            <button class="h2-go" onClick={() => next && onOpen({ id: next.id, title: next.title, url: next.url, thumb: next.thumbnail })}>
              {allDone ? 'Mehr' : doneCount > 0 ? 'Weiter' : 'Start'}
            </button>
          </div>
          <p class="lr-credit-line">Aus den meistgelesenen Wikipedia-Artikeln des Tages · CC BY-SA</p>
        </>
      )}

      <div class="lr-tiles three">
        <button class="lr-tile" onClick={onSurprise}><span class="lr-tile-ico t-zufall"><IconDice /></span><span class="lr-tile-t">Zufall</span></button>
        <button class="lr-tile" onClick={onCloze}><span class="lr-tile-ico t-luecke"><IconGap /></span><span class="lr-tile-t">Lückentext</span></button>
        <button class="lr-tile" onClick={onTrainer}><span class="lr-tile-ico t-vokab"><IconCards /></span><span class="lr-tile-t">Vokabeln</span></button>
      </div>

      <button class="mini-head" onClick={onRoute}>
        <span class="mini-head-t">Deine Lernroute</span>
        <span class="mini-head-s">{prog.label} · alle ansehen →</span>
      </button>
      <div class="route mini">
        {[-1, 0, 1].map((off) => {
          const i = cur + off;
          if (i < 0 || i >= NODES_PER_LEVEL) {
            const start = i < 0;
            return (
              <div class="rn cap" key={off}>
                <div class="rn-rail"><span class="rn-dot">{start ? <IconFlag /> : <IconCheck />}</span></div>
                <span class="rn-card">
                  <span class="rn-title">{start ? 'Los geht’s' : 'Level geschafft'}</span>
                  <span class="rn-sub">{start ? 'Start' : ''}</span>
                </span>
              </div>
            );
          }
          const t = nodeType(level, i);
          const state: 'done' | 'current' | 'locked' = i < prog.node ? 'done' : i === cur && prog.node < NODES_PER_LEVEL ? 'current' : 'locked';
          const M = NODE_META[t];
          return (
            <div class={`rn ${state}`} key={off}>
              <div class="rn-rail"><span class="rn-dot">{state === 'done' ? <IconCheck /> : state === 'locked' ? <IconLock /> : <M.Icon />}</span></div>
              <button class="rn-card" disabled={state !== 'current'} onClick={() => state === 'current' && launchNode(t)}>
                <span class="rn-title">{M.label}</span>
                <span class="rn-sub">{state === 'current' ? 'Jetzt dran · tippen' : state === 'done' ? 'erledigt' : 'gesperrt'}</span>
              </button>
              {state === 'current' && <img class="rn-gurki" src="/gurki/yay.png" alt="" width={56} />}
            </div>
          );
        })}
      </div>
    </main>
  );
}

/* --------------------------------------------------------------- Trainer --- */

function TrainerView({ settings, onBack }: { settings: PwaSettings; onBack: () => void }) {
  const all = getDeck().filter((d) => d.lang === settings.learn);
  const [order] = useState(() => all.map((_, i) => i).sort(() => Math.random() - 0.5));
  const [pos, setPos] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const card = all[order[pos] ?? -1];

  function answer(known: boolean, e?: MouseEvent) {
    if (known) {
      setScore((s) => s + 1);
      award(XP.merken);
      if (e) { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); pop(r.left + r.width / 2, r.top + r.height / 2); }
    }
    if (pos + 1 >= order.length) { setDone(true); completeActivity(settings.level, 'vocab'); }
    else { setPos((p) => p + 1); setRevealed(false); }
  }

  return (
    <main class="sl-main with-nav">
      <header class="sl-lessonhead">
        <button class="sl-back" onClick={onBack} aria-label="Zurück">←</button>
        <span class="sl-lessontitle">Vokabeltest</span>
      </header>

      {all.length === 0 ? (
        <p class="sl-muted">
          Noch keine Vokabeln zum Üben. Tippe beim Lesen ein Wort an und drücke „★ merken".
        </p>
      ) : done ? (
        <section class="sl-done">
          <span class="sl-done-ico"><IconSparkles /></span>
          <h2>Fertig</h2>
          <p>{score} von {all.length} gewusst.</p>
          <button class="sl-read" onClick={onBack}>Zurück</button>
        </section>
      ) : (
        <>
          <p class="sl-progress">Karte {pos + 1} / {all.length}</p>
          <div class="tr-card" onClick={() => setRevealed(true)}>
            <span class="tr-word">{card?.word}</span>
            {revealed ? (
              <span class="tr-trans">{card?.translation || '—'}</span>
            ) : (
              <span class="tr-tap">tippen zum Aufdecken</span>
            )}
          </div>
          {revealed && (
            <div class="tr-actions">
              <button class="tr-again" onClick={() => answer(false)}>Nochmal</button>
              <button class="tr-known" onClick={(e) => answer(true, e)}>Gewusst ✓</button>
            </div>
          )}
        </>
      )}
    </main>
  );
}

/* -------------------------------------------------------------- Surprise --- */

const AREAS: { id: string; label: string; icon: ComponentChildren; sub: string }[] = [
  { id: 'technik', label: 'Technik', icon: <IconWrench />, sub: 'Erfindungen, Computer …' },
  { id: 'sport', label: 'Sport', icon: <IconBall />, sub: 'Fußball, Olympia …' },
  { id: 'geschichte', label: 'Geschichte', icon: <IconLandmark />, sub: 'Antike, Mittelalter …' },
  { id: 'gesellschaft', label: 'Stars & Gesellschaft', icon: <IconStar />, sub: 'Promis, Musik, TV …' },
  { id: 'natur', label: 'Natur & Tiere', icon: <IconLeaf />, sub: 'Tiere, Pflanzen …' },
  { id: 'kultur', label: 'Kultur', icon: <IconMusic />, sub: 'Musik, Film, Kunst …' },
  { id: 'wissenschaft', label: 'Wissenschaft', icon: <IconFlask />, sub: 'Weltraum, Physik …' },
];

function SurpriseView({ settings, onOpen, onBack }: {
  settings: PwaSettings;
  onOpen: (a: ArticleRef) => void;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState(false);

  async function pick(area: string) {
    setError(false);
    setLoading(area);
    const l = await fetchSurprise(SERVER, settings.learn, settings.level, area);
    if (l) {
      onOpen({ id: l.id, title: l.title, url: l.url, thumb: l.thumbnail });
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

      {loading ? (
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
                <span class="lr-tile-ico">{a.icon}</span>
                <span class="lr-tile-t">{a.label}</span>
                <span class="lr-tile-s">{a.sub}</span>
              </button>
            ))}
          </div>
          <p class="sl-muted" style={{ marginTop: '18px' }}>
            Frisch aus Wikipedia, auf dein Niveau gebracht. Beim ersten Mal dauert
            es ein paar Sekunden.
          </p>
        </>
      )}
    </main>
  );
}

/* ---------------------------------------------------------------- Cloze --- */

function ClozeView({ settings, onBack }: { settings: PwaSettings; onBack: () => void }) {
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [title, setTitle] = useState('');
  const [pos, setPos] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);

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
      const vocab = lesson.vocab.map((v) => v.word);
      const deckWords = getDeck().filter((d) => d.lang === settings.learn).map((d) => d.word);
      const pool = [...new Set([...vocab, ...deckWords])];
      const qs = buildClozeQuestions(text, vocab, pool, Math.random, 8);
      setTitle(lesson.title);
      setQuestions(qs);
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
    if (done && !credited.current) { credited.current = true; completeActivity(settings.level, 'cloze'); }
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
          <div class="sl-quiz">
            <p class="sl-quiz-q">{q.prompt}</p>
            <TranslateReveal text={q.prompt} settings={settings} />
            <div class="sl-quiz-opts">
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
            {picked !== null && (
              <button class="sl-read" onClick={next}>
                {pos + 1 >= questions.length ? 'Fertig ✓' : 'Weiter →'}
              </button>
            )}
          </div>
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
      const [ranks, names] = await Promise.all([loadRanks(settings.learn), loadNames()]);
      if (!alive) return;
      const [lo, hi] = bandRankRange(settings.level);
      const reals = Object.entries(ranks)
        .filter(([w, r]) => r >= lo && r <= hi && w.length >= 4 && /^\p{L}+$/u.test(w) && !names.has(w.toLowerCase()))
        .map(([w]) => w);
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
  const optsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const daily = await fetchServerDaily(SERVER, settings.learn, settings.level);
      const art = daily?.articles[0];
      if (!art) { if (alive) setQuestions([]); return; }
      const lesson = await fetchServerLesson(SERVER, art.id, settings.level);
      if (!alive) return;
      if (!lesson) { setQuestions([]); return; }
      const qs = (await buildLessonQuestions(lesson, settings)).filter(Boolean) as LessonQuestion[];
      setQuestions(shuffleInPlace(qs).slice(0, 5));
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
      if (passed) { completeActivity(settings.level, 'etappentest'); celebrate(); }
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

const NODE_META: Record<NodeType, { label: string; Icon: () => ComponentChildren }> = {
  lesson: { label: 'Artikel lesen', Icon: IconNewspaper },
  vocab: { label: 'Vokabeltest', Icon: IconCards },
  cloze: { label: 'Lückentext', Icon: IconGap },
  etappentest: { label: 'Etappentest', Icon: IconFlag },
  aufstieg: { label: 'Aufstiegstest', Icon: IconSummit },
};

type NodeState = 'done' | 'current' | 'locked';

function RouteView({ settings, onLesson, onTrainer, onCloze, onTest, onBack }: {
  settings: PwaSettings;
  onLesson: () => void;
  onTrainer: () => void;
  onCloze: () => void;
  onTest: () => void;
  onBack: () => void;
}) {
  const prog = getStageProgress(settings.level);
  const level = prog.level;
  const current = Math.min(prog.node, NODES_PER_LEVEL - 1);
  const curRef = useRef<HTMLDivElement>(null);

  // Center the current node on open.
  useEffect(() => {
    curRef.current?.scrollIntoView({ block: 'center' });
  }, []);

  const launch = (t: NodeType) => {
    if (t === 'lesson') onLesson();
    else if (t === 'vocab') onTrainer();
    else if (t === 'cloze') onCloze();
    else onTest();
  };

  const levelIdx = STAGE_LEVELS.indexOf(level);
  const rows: ComponentChildren[] = [];
  for (let e = 0; e < ETAPPEN_PER_LEVEL; e++) {
    const etappeDone = prog.node >= (e + 1) * NODES_PER_ETAPPE;
    rows.push(
      <div class="rt-etappe" key={`e${e}`}>
        <span class="rt-etappe-n">Etappe {e + 1}</span>
        <span class={`rt-chest ${etappeDone ? 'done' : ''}`}><IconChest /></span>
      </div>,
    );
    for (let p = 0; p < NODES_PER_ETAPPE; p++) {
      const i = e * NODES_PER_ETAPPE + p;
      const t = nodeType(level, i);
      const state: NodeState = i < prog.node ? 'done' : i === current && prog.node < NODES_PER_LEVEL ? 'current' : 'locked';
      const M = NODE_META[t];
      rows.push(
        <div class={`rn ${state}`} key={i}>
          <div class="rn-rail">
            <span class="rn-dot" ref={state === 'current' ? curRef : undefined}>
              {state === 'done' ? <IconCheck /> : state === 'locked' ? <IconLock /> : <M.Icon />}
            </span>
          </div>
          <button class="rn-card" disabled={state !== 'current'} onClick={() => state === 'current' && launch(t)}>
            <span class="rn-title">{M.label}</span>
            <span class="rn-sub">{state === 'current' ? 'Jetzt dran · tippen' : state === 'done' ? 'erledigt' : 'gesperrt'}</span>
          </button>
          {state === 'current' && <img class="rn-gurki" src="/gurki/yay.png" alt="" width={62} />}
        </div>,
      );
    }
  }

  return (
    <main class="sl-main with-nav">
      <header class="sl-lessonhead">
        <button class="sl-back" onClick={onBack} aria-label="Zurück">←</button>
        <span class="sl-lessontitle">Lernroute</span>
      </header>
      <div class="rt-head">
        <b>{level}</b><span>Etappe {prog.etappe}/{ETAPPEN_PER_LEVEL}</span>
        {levelIdx > 0 && <span class="rt-prev">{STAGE_LEVELS.slice(0, levelIdx).join(' ✓ ')} ✓</span>}
      </div>
      <div class="route">{rows}</div>
    </main>
  );
}

/* ----------------------------------------------------------- Challenges --- */

function ChallengesTab({ settings, onOpen }: {
  settings: PwaSettings;
  onOpen: (a: ArticleRef) => void;
}) {
  const [dates, setDates] = useState<string[] | null>(null);
  const [sel, setSel] = useState<string | undefined>(undefined); // undefined = today
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

  const days = dates ?? [];
  return (
    <main class="sl-main with-nav">
      <h1 class="tab-screen-title">Challenges</h1>
      <p class="lr-section">Heutige & frühere Tageslektionen</p>
      {days.length > 0 && (
        <div class="lr-pick" style={{ flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
          <button class={`pill-day ${!sel ? 'on' : ''}`} onClick={() => setSel(undefined)}>Heute</button>
          {days.map((d) => (
            <button class={`pill-day ${sel === d ? 'on' : ''}`} onClick={() => setSel(d)}>
              {d.slice(5)}
            </button>
          ))}
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
  return (
    <main class="sl-main with-nav">
      <h1 class="tab-screen-title">Report</h1>

      <div class={`rep-stage ${prog.ready ? 'ready' : ''}`}>
        <div class="rep-stage-top">
          <span class="rep-stage-label">{prog.label}</span>
          <span class="rep-stage-pct">{Math.round(prog.ratio * 100)}%</span>
        </div>
        <div class="rep-stage-bar"><i style={{ width: `${Math.round(prog.ratio * 100)}%` }} /></div>
        {prog.ready ? (
          <button class="rep-stage-test" onClick={onTest}><span class="rep-test-ico"><IconTarget /></span>Etappen-Test starten</button>
        ) : (
          <p class="rep-stage-hint">Lies & übe weiter — bei 100 % schaltet der Etappen-Test frei.</p>
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
    const u = (window as unknown as { __slUpdate?: (r?: boolean) => Promise<void> }).__slUpdate;
    try { await u?.(); } catch { /* ignore */ }
    // If an update was waiting, the banner fires; otherwise we're up to date.
    setTimeout(() => setState((s) => (s === 'checking' ? 'current' : s)), 1200);
  }
  return (
    <button class="set-update" onClick={check} disabled={state === 'checking'}>
      {state === 'checking' ? 'Suche …' : state === 'current' ? 'Aktuell ✓' : 'Auf Updates prüfen'}
    </button>
  );
}

/* ------------------------------------------------------------- Deck view --- */

function DeckView({ onBack }: { onBack: () => void }) {
  const [deck, setDeck] = useState<DeckEntry[]>(getDeck());
  return (
    <main class="sl-main">
      <header class="sl-lessonhead">
        <button class="sl-back" onClick={onBack} aria-label="Zurück">←</button>
        <span class="sl-lessontitle">Meine Vokabeln</span>
      </header>
      {deck.length === 0 ? (
        <p class="sl-muted">
          Noch keine Vokabeln. Tippe beim Lesen ein Wort an und drücke „★ merken".
        </p>
      ) : (
        <ul class="sl-deck">
          {deck.map((e) => (
            <li class="sl-deck-item" key={e.lang + e.word}>
              <span class="sl-deck-word">{e.word}</span>
              <span class="sl-deck-trans">{e.translation || '—'}</span>
              <button
                class="sl-deck-x"
                aria-label="entfernen"
                onClick={() => {
                  removeFromDeck(e.lang, e.word);
                  setDeck(getDeck());
                }}
              >
                ×
              </button>
            </li>
          ))}
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
  settings,
  onLevel,
  onBack,
  onOpen,
  onHome,
}: {
  article: { id: string; title: string; url: string; thumb?: string };
  settings: PwaSettings;
  onLevel: (l: CefrLevel) => void;
  onBack: () => void;
  onOpen: (a: ArticleRef) => void;
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

  // Load frequency ranks + names so we can mark words above the user's level
  // (visible reading aid, like the live pages).
  useEffect(() => {
    void loadRanks(settings.learn).then(setRanks);
    void loadNames().then(setNames);
  }, [settings.learn]);

  const isHard = (w: string): boolean => {
    if (!ranks || w.length < 3 || names.has(w.toLowerCase())) return false;
    const r = rankOf(ranks, w);
    return r !== undefined && isAboveLevel(rankToBand(r), settings.level);
  };

  useEffect(() => {
    let alive = true;
    void fetchServerLesson(SERVER, article.id, settings.level).then((l) => {
      if (!alive) return;
      if (l) setLesson(l);
      else setError(true);
    });
    return () => {
      alive = false;
    };
  }, [article.id, settings.level]);

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
    completeActivity(settings.level, 'lesson');
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
        <div class="sl-levels">
          {LEVELS.map((l) => (
            <button class={`sl-lvlbtn ${l === settings.level ? 'on' : ''}`} onClick={() => onLevel(l)}>
              {l}
            </button>
          ))}
        </div>
      }
    >
      <p class="sl-progress">
        Absatz {Math.min(visible, total)} / {total}
        {total >= 8 ? ' · Auszug' : ''}
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
            <p class="sl-done-daily">{CHALLENGE} Absätze geschafft — stark! Lies {total - CHALLENGE} weitere für Bonus-XP, oder mach beim nächsten Artikel weiter.</p>
            <div class="sl-done-actions">
              <button class="sl-read primary" onClick={() => { setShowChallenge(false); setVisible((v) => v + 1); }}>
                Weiterlesen · Bonus +
              </button>
              {next && (
                <button class="sl-read ghost" onClick={() => onOpen({ id: next.id, title: next.title, url: next.url, thumb: next.thumbnail })}>
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
                <button class="sl-read primary" onClick={() => onOpen({ id: next.id, title: next.title, url: next.url, thumb: next.thumbnail })}>
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
            {example && <p class="sl-pop-ex">„{example}"</p>}
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
