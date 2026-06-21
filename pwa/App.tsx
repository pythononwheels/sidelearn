/**
 * Sidelearn Learn — mobile PWA. Server-powered (no local LLM): the daily
 * challenge and lessons come pre-baked from the content server; word lookups use
 * the bundled dictionary. Personal progress stays on-device.
 */

import { type ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { LANGUAGES, LANG_LABELS, type Language } from '@/core/config';
import { CEFR_LEVELS, type CefrLevel } from '@/core/difficulty/banding';
import { resolveWord } from '@/core/wordinfo';
import type { WordInfo } from '@/core/types';
import {
  fetchServerDaily,
  fetchServerLesson,
  type ServerDaily,
  type ServerLesson,
} from '@/core/serverapi';
import { getSettings, saveSettings, getProgress, isCompleted, saveProgress, type PwaSettings } from './store';

const SERVER = 'https://api.sidelearn.pyrates.io';
const LEVELS: CefrLevel[] = ['A2', 'B1', 'B2', 'C1'];

export function App() {
  const [settings, setSettings] = useState<PwaSettings>(getSettings());
  const [view, setView] = useState<{ id: string; title: string; url: string; thumb?: string } | null>(null);

  const patch = (p: Partial<PwaSettings>) => {
    const next = { ...settings, ...p };
    setSettings(next);
    saveSettings(next);
  };

  return (
    <div class="sl-shell">
      <Updater />
      {view ? (
        <Lesson
          key={view.id + settings.level}
          article={view}
          settings={settings}
          onLevel={(level) => patch({ level })}
          onBack={() => setView(null)}
        />
      ) : (
        <Home settings={settings} onPatch={patch} onOpen={setView} />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- Home --- */

function Home({
  settings,
  onPatch,
  onOpen,
}: {
  settings: PwaSettings;
  onPatch: (p: Partial<PwaSettings>) => void;
  onOpen: (a: { id: string; title: string; url: string; thumb?: string }) => void;
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

  return (
    <main class="sl-main">
      <header class="sl-head">
        <span class="sl-brand"><span class="sl-logo" /> Sidelearn</span>
        <div class="sl-pick">
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

      <section class="sl-daily" key={tick}>
        <div class="sl-daily-top">
          <span class="sl-eyebrow">Tägliche Challenge</span>
          <span class="sl-count">{Math.min(doneCount, goal)}/{goal}</span>
        </div>
        <p class="sl-intro">
          Lies <b>{goal}</b> von {articles.length} Artikeln auf deinem Sprachniveau{' '}
          <span class="sl-lvl">{settings.level}</span>.
        </p>

        {loading ? (
          <Dots />
        ) : articles.length === 0 ? (
          <p class="sl-muted">Heute noch keine Lektionen für {LANG_LABELS[settings.learn]}.</p>
        ) : (
          <ul class="sl-list">
            {articles.map((a) => {
              const done = isCompleted(a.url);
              const started = !done && !!getProgress(a.url);
              return (
                <li key={a.id}>
                  <button
                    class={`sl-item ${done ? 'done' : ''}`}
                    onClick={() => onOpen({ id: a.id, title: a.title, url: a.url, thumb: a.thumbnail })}
                  >
                    {a.thumbnail ? (
                      <img class="sl-thumb" src={a.thumbnail} alt="" />
                    ) : (
                      <span class="sl-thumb sl-thumb-ph" />
                    )}
                    <span class="sl-item-body">
                      <span class="sl-item-title">{a.title}</span>
                      <span class="sl-item-sub">{a.summary || `${a.paragraphs} Absätze`}</span>
                    </span>
                    <span class="sl-item-state">{done ? '✓' : started ? 'weiter' : 'lesen'}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
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
  const [pop, setPop] = useState<{ word: string; x: number; y: number } | null>(null);

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
    if (visible < total) setVisible((v) => v + 1);
    else setCompleted(true);
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

      {lesson.paragraphs.slice(0, visible).map((p, i) => (
        <div key={i} class={`sl-para ${i === lastIdx && !completed ? 'current' : 'past'}`}>
          <p class="sl-text">
            <TapText text={p.simplified} onWord={(word, x, y) => setPop({ word, x, y })} />
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

function TapText({ text, onWord }: { text: string; onWord: (w: string, x: number, y: number) => void }) {
  const tokens = text.split(/(\p{L}[\p{L}\-']*)/u);
  return (
    <>
      {tokens.map((tok, i) =>
        i % 2 === 1 ? (
          <span
            class="sl-word"
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
  pop: { word: string; x: number; y: number };
  settings: PwaSettings;
  onClose: () => void;
}) {
  const [info, setInfo] = useState<WordInfo | null>(null);
  useEffect(() => {
    let alive = true;
    void resolveWord(pop.word, settings.learn, settings.native, settings.level).then(
      (i) => alive && setInfo(i),
    );
    return () => {
      alive = false;
    };
  }, [pop.word]);

  return (
    <>
      <div class="sl-pop-backdrop" onClick={onClose} />
      <div class="sl-pop" style={{ top: `${pop.y + 8}px`, left: `${Math.min(pop.x, window.innerWidth - 240)}px` }}>
        <div class="sl-pop-head">
          <b>{pop.word}</b>
          {info && <span class="sl-pop-band" data-band={info.band[0]}>{info.band}</span>}
        </div>
        {info === null ? (
          <Dots />
        ) : info.senses.length ? (
          <p class="sl-pop-trans">{info.senses[0]!.translations.slice(0, 4).join(', ')}</p>
        ) : (
          <p class="sl-muted">keine Wörterbuch-Übersetzung</p>
        )}
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
  return <Banner />;
}

function Banner() {
  const [show, setShow] = useState(false);
  const reg = useRef(false);
  useEffect(() => {
    if (reg.current) return;
    reg.current = true;
    // vite-plugin-pwa autoUpdate refreshes silently; we surface a hint when a
    // new SW takes control so the user knows content refreshed.
    navigator.serviceWorker?.addEventListener?.('controllerchange', () => setShow(true));
  }, []);
  if (!show) return null;
  return (
    <div class="sl-update" onClick={() => location.reload()}>
      Neue Version geladen — tippen zum Aktualisieren.
    </div>
  );
}

function Dots() {
  return (
    <span class="sl-dots"><i /><i /><i /></span>
  );
}
