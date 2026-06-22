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
  fetchServerDaily,
  fetchServerLesson,
  fetchWordTranslation,
  type ServerDaily,
  type ServerLesson,
} from '@/core/serverapi';
import { getSettings, saveSettings, getProgress, isCompleted, saveProgress, type PwaSettings } from './store';
import { award, creditLesson, isLessonCredited, getStats, XP } from './gamify';
import { addToDeck, getDeck, inDeck, removeFromDeck, type DeckEntry } from './deck';

const SERVER = 'https://api.sidelearn.pyrates.io';
const LEVELS: CefrLevel[] = ['A2', 'B1', 'B2', 'C1'];

export function App() {
  const [settings, setSettings] = useState<PwaSettings>(getSettings());
  const [view, setView] = useState<{ id: string; title: string; url: string; thumb?: string } | null>(null);
  const [deckOpen, setDeckOpen] = useState(false);

  const patch = (p: Partial<PwaSettings>) => {
    const next = { ...settings, ...p };
    setSettings(next);
    saveSettings(next);
  };

  return (
    <div class="sl-shell">
      <Updater />
      {!settings.onboarded ? (
        <Onboarding settings={settings} onDone={(p) => patch({ ...p, onboarded: true })} />
      ) : view ? (
        <Lesson
          key={view.id + settings.level}
          article={view}
          settings={settings}
          onLevel={(level) => patch({ level })}
          onBack={() => setView(null)}
        />
      ) : deckOpen ? (
        <DeckView onBack={() => setDeckOpen(false)} />
      ) : (
        <Home settings={settings} onPatch={patch} onOpen={setView} onDeck={() => setDeckOpen(true)} />
      )}
    </div>
  );
}

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

/* ---------------------------------------------------------------- Home --- */

function Home({
  settings,
  onPatch,
  onOpen,
  onDeck,
}: {
  settings: PwaSettings;
  onPatch: (p: Partial<PwaSettings>) => void;
  onOpen: (a: { id: string; title: string; url: string; thumb?: string }) => void;
  onDeck: () => void;
}) {
  const [daily, setDaily] = useState<ServerDaily | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0); // re-render after returning from a lesson

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetchServerDaily(SERVER, settings.learn, settings.level).then((d) => {
      if (alive) {
        setDaily(d);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [settings.learn, settings.level]);

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

  const open = (a: typeof articles[number]) =>
    onOpen({ id: a.id, title: a.title, url: a.url, thumb: a.thumbnail });

  return (
    <main class="sl-main" key={tick}>
      <header class="lr-head">
        <span class="lr-brand"><span class="lr-logo" /> Learny</span>
        <div class="lr-pick">
          <select value={settings.learn} onChange={(e) => onPatch({ learn: e.currentTarget.value as Language })}>
            {LANGUAGES.filter((l) => l !== settings.native).map((l) => (
              <option value={l}>{LANG_LABELS[l]}</option>
            ))}
          </select>
          <select value={settings.level} onChange={(e) => onPatch({ level: e.currentTarget.value as CefrLevel })}>
            {CEFR_LEVELS.map((l) => (
              <option value={l}>{l}</option>
            ))}
          </select>
        </div>
      </header>

      {/* Hero: today's lesson — a calm summary, no competing button */}
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

      {/* Article list = the actual challenge. Next-to-read is the primary one. */}
      {articles.length > 0 && (
        <ul class="lr-list">
          {articles.map((a) => {
            const done = isCompleted(a.url);
            const started = !done && !!getProgress(a.url);
            const isNext = !done && a.url === next?.url && !allDone;
            return (
              <li key={a.id}>
                <button class={`lr-item ${done ? 'done' : ''} ${isNext ? 'primary' : ''}`} onClick={() => open(a)}>
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
      )}

      {/* Subtle progress + vocab (no flame) */}
      <section class="lr-foot">
        <div class="lr-foot-prog">
          <div class="lr-foot-top">
            <span>Level {stats.level}</span>
            <span class="sl-muted">heute {stats.todayXp}/{stats.goal} XP</span>
          </div>
          <div class="lr-foot-bar"><span style={{ width: `${Math.min(100, (stats.todayXp / stats.goal) * 100)}%` }} /></div>
        </div>
        <button class="lr-vocab" onClick={onDeck}>Meine Vokabeln · {getDeck().length}</button>
      </section>
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
