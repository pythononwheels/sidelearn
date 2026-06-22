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
  fetchServerLesson,
  fetchWordTranslation,
  type ServerDaily,
  type ServerLesson,
} from '@/core/serverapi';
import { getSettings, saveSettings, getProgress, isCompleted, saveProgress, type PwaSettings } from './store';
import { award, creditLesson, isLessonCredited, getStats, XP } from './gamify';
import { addToDeck, getDeck, inDeck, removeFromDeck, type DeckEntry } from './deck';
import { THEMES, applyTheme } from './theme';

type Tab = 'home' | 'challenges' | 'report' | 'settings';
type ArticleRef = { id: string; title: string; url: string; thumb?: string };

const SERVER = 'https://api.sidelearn.pyrates.io';
const LEVELS: CefrLevel[] = ['A2', 'B1', 'B2', 'C1'];

export function App() {
  const [settings, setSettings] = useState<PwaSettings>(getSettings());
  const [view, setView] = useState<ArticleRef | null>(null);
  const [deckOpen, setDeckOpen] = useState(false);
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
      <div class="sl-shell">
        <Updater />
        <Onboarding settings={settings} onDone={(p) => patch({ ...p, onboarded: true })} />
      </div>
    );
  }

  // Focused full views (no tab bar).
  if (view) {
    return (
      <div class="sl-shell">
        <Updater />
        <Lesson
          key={view.id + settings.level}
          article={view}
          settings={settings}
          onLevel={(level) => patch({ level })}
          onBack={() => setView(null)}
        />
      </div>
    );
  }
  if (deckOpen) {
    return (
      <div class="sl-shell">
        <DeckView onBack={() => setDeckOpen(false)} />
      </div>
    );
  }

  return (
    <div class="sl-shell">
      <Updater />
      {tab === 'home' && <HomeTab settings={settings} onPatch={patch} onOpen={setView} />}
      {tab === 'challenges' && <ChallengesTab settings={settings} onOpen={setView} />}
      {tab === 'report' && <ReportTab onDeck={() => setDeckOpen(true)} />}
      {tab === 'settings' && <SettingsTab settings={settings} onPatch={patch} />}
      <TabBar tab={tab} onTab={setTab} />
    </div>
  );
}

/* --------------------------------------------------------------- TabBar --- */

function TabBar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
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
          <h1 class="lr-onb-h">Willkommen bei Learny 👋</h1>
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
            {(['A2', 'B1', 'B2', 'C1'] as CefrLevel[]).map((l) => (
              <button
                class={`lr-onb-level ${level === l ? 'sel' : ''}`}
                onClick={() => setLevel(l)}
              >
                <span class="lr-onb-level-name">{l}</span>
                <span class="lr-onb-level-hint">{levelHint[l]}</span>
              </button>
            ))}
          </div>
          <button class="lr-onb-next" onClick={() => onDone({ learn, level })}>Los geht's 🎉</button>
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

function HomeTab({ settings, onPatch, onOpen }: {
  settings: PwaSettings;
  onPatch: (p: Partial<PwaSettings>) => void;
  onOpen: (a: ArticleRef) => void;
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

  return (
    <main class="sl-main with-nav" key={tick}>
      <header class="lr-head">
        <span class="lr-brand"><span class="lr-logo" /> Learny</span>
        <div class="lr-pick">
          <select value={settings.learn} onChange={(e) => onPatch({ learn: e.currentTarget.value as Language })}>
            {LANGUAGES.filter((l) => l !== settings.native).map((l) => (
              <option value={l}>{LANG_LABELS[l]}</option>
            ))}
          </select>
          <select value={settings.level} onChange={(e) => onPatch({ level: e.currentTarget.value as CefrLevel })}>
            {CEFR_LEVELS.map((l) => (<option value={l}>{l}</option>))}
          </select>
        </div>
      </header>

      <section class="lr-hero">
        <div class="lr-hero-top">
          <span class="lr-hero-eyebrow">Deine Tageslektion</span>
          {articles.length > 0 && <span class="lr-hero-count">{Math.min(doneCount, goal)}/{goal}</span>}
        </div>
        {loading ? (
          <Dots />
        ) : articles.length === 0 ? (
          <p class="lr-hero-text">Heute gibt es noch keine Lektion für {LANG_LABELS[settings.learn]}. Schau später nochmal vorbei.</p>
        ) : allDone ? (
          <p class="lr-hero-text">Heute geschafft! 🎉 Du kannst gern noch weiterlesen.</p>
        ) : (
          <p class="lr-hero-text">
            Lies <b>{goal}</b> von {articles.length} kurzen Artikeln — wir vereinfachen sie für dich auf {settings.level}.
          </p>
        )}
      </section>

      {articles.length > 0 && (
        <ArticleList articles={articles} next={next} allDone={allDone} onOpen={onOpen} />
      )}
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

function ReportTab({ onDeck }: { onDeck: () => void }) {
  const s = getStats();
  const deck = getDeck().length;
  const maxDay = Math.max(1, ...s.last7.map((d) => d.xp));
  const acc = s.streak; // streak kept here (not as a home flame)
  return (
    <main class="sl-main with-nav">
      <h1 class="tab-screen-title">Report</h1>
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

      <button class="lr-vocab" onClick={onDeck}>Meine Vokabeln · {deck} →</button>
    </main>
  );
}

/* -------------------------------------------------------------- Settings --- */

function SettingsTab({ settings, onPatch }: {
  settings: PwaSettings;
  onPatch: (p: Partial<PwaSettings>) => void;
}) {
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

      <p class="sl-muted">Learny · Teil der Sidelearn-Familie · Texte: Wikipedia (CC BY-SA)</p>
    </main>
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

/* -------------------------------------------------------------- Lesson --- */

function Lesson({
  article,
  settings,
  onLevel,
  onBack,
}: {
  article: { id: string; title: string; url: string; thumb?: string };
  settings: PwaSettings;
  onLevel: (l: CefrLevel) => void;
  onBack: () => void;
}) {
  const [lesson, setLesson] = useState<ServerLesson | null>(null);
  const [error, setError] = useState(false);
  const saved = getProgress(article.url);
  const [visible, setVisible] = useState(saved?.progress ?? 1);
  const [completed, setCompleted] = useState(saved?.completed ?? false);
  const [score, setScore] = useState({ answered: saved?.answered ?? 0, correct: saved?.correct ?? 0 });
  const [quizIdx, setQuizIdx] = useState<number | null>(null);
  const [answer, setAnswer] = useState<number | null>(null);
  const [pop, setPop] = useState<{ word: string; sentence: string; x: number; y: number } | null>(null);
  const [ranks, setRanks] = useState<Record<string, number> | null>(null);
  const [names, setNames] = useState<Set<string>>(new Set());
  // Award XP only for a lesson not yet credited (no farming by re-reading).
  const creditable = useRef(!isLessonCredited(article.url));

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

  useEffect(() => {
    if (!lesson) return;
    saveProgress(article.url, { progress: visible, completed, answered: score.answered, correct: score.correct });
  }, [visible, completed, score, lesson]);

  if (error) return <Frame title={article.title} onBack={onBack}><p class="sl-muted">Lektion nicht verfügbar.</p></Frame>;
  if (!lesson) return <Frame title={article.title} onBack={onBack}><Dots /></Frame>;

  const total = lesson.paragraphs.length;
  const lastIdx = visible - 1;

  function advance() {
    if (visible < total) {
      if (creditable.current) award(XP.paragraph);
      setVisible((v) => v + 1);
    } else {
      if (creditable.current) {
        award(XP.lesson);
        creditLesson(article.url);
        creditable.current = false;
      }
      setCompleted(true);
    }
  }
  function onRead() {
    const q = lesson!.paragraphs[lastIdx]?.question;
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
      <p class="sl-hint">💡 Tippe ein <span class="sl-hint-mark">markiertes</span> Wort für die Übersetzung.</p>

      {lesson.paragraphs.slice(0, visible).map((p, i) => (
        <div key={i} class={`sl-para ${i === lastIdx && !completed ? 'current' : 'past'}`}>
          <p class="sl-text">
            <TapText
              text={p.simplified}
              isHard={isHard}
              onWord={(word, x, y) => setPop({ word, sentence: p.simplified, x, y })}
            />
          </p>
          {i === lastIdx && !completed && quizIdx === null && (
            <button class="sl-read" onClick={onRead}>
              {i === total - 1 ? 'Fertig ✓' : 'Gelesen ✓'}
            </button>
          )}
        </div>
      ))}

      {quizIdx !== null && lesson.paragraphs[quizIdx]?.question && (
        <Quiz
          q={lesson.paragraphs[quizIdx]!.question!}
          answer={answer}
          isLast={quizIdx === total - 1}
          onAnswer={(idx) => {
            if (answer !== null) return;
            setAnswer(idx);
            const ok = idx === lesson.paragraphs[quizIdx]!.question!.correct;
            if (ok && creditable.current) award(XP.correct);
            setScore((s) => ({ answered: s.answered + 1, correct: s.correct + (ok ? 1 : 0) }));
          }}
          onNext={() => {
            setQuizIdx(null);
            setAnswer(null);
            advance();
          }}
        />
      )}

      {completed && (
        <section class="sl-done">
          <h2>Geschafft 🎉</h2>
          {score.answered > 0 && <p>Quiz: {score.correct} / {score.answered} richtig</p>}
        </section>
      )}

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
          {saved ? '✓ gemerkt' : '★ merken'}
        </button>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- quiz --- */

function Quiz({
  q,
  answer,
  isLast,
  onAnswer,
  onNext,
}: {
  q: { q: string; options: string[]; correct: number };
  answer: number | null;
  isLast: boolean;
  onAnswer: (i: number) => void;
  onNext: () => void;
}) {
  return (
    <div class="sl-quiz">
      <p class="sl-quiz-q">{q.q}</p>
      <div class="sl-quiz-opts">
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
