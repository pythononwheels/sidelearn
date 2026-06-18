/**
 * Sidelearn "Lern-App-Modus" — a full-page reading lesson built from a Wikipedia
 * article. We own the layout (own, appier style), use Wikipedia only as the
 * source (with visible credit), and present the article paragraph by paragraph,
 * level-adapted: read one, the next is simplified in the background, press
 * "Gelesen" to advance. Progress + content are remembered in the lesson store.
 *
 * Phase A: read flow + background simplify + resume + persistence.
 * Phase B (later): per-paragraph vocab extraction + end-of-lesson quiz.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import { type Language } from '@/core/config';
import { levelIndex, rankToBand, type CefrLevel } from '@/core/difficulty/banding';
import { loadRanks, rankOf } from '@/core/difficulty/frequency';
import { getSettings } from '@/core/settings';
import { fetchArticleParagraphs } from '@/core/wikifeed';
import { explainWord, simplifyParagraph, translateParagraph } from '@/core/llm/prompts';
import { generateParagraphQuestion, type QuizQuestion } from '@/core/quiz';
import { resolveWord } from '@/core/wordinfo';
import { loadNames } from '@/core/names';
import { addVocab } from '@/core/vocab';
import { cacheKey, getCached, putCached } from '@/core/simplify';
import { dateKey } from '@/core/daily';
import { getLesson, saveLesson, type Lesson } from '@/core/lessons';
import type { WordExplanation, WordInfo } from '@/core/types';
import {
  estimateDifficulty,
  type DifficultyEstimate,
  type DifficultyTag,
} from '@/core/difficulty/estimate';

/** Short label for the *original* article's difficulty (level-independent). */
const ORIG_LABEL: Record<DifficultyTag, string> = {
  leicht: 'leicht',
  passt: 'mittel',
  fordernd: 'fordernd',
  schwer: 'anspruchsvoll',
};

type RankMap = Record<string, number>;

/** Active translation popover anchored to a clicked word or a text selection. */
type Pop =
  | { kind: 'word'; word: string; x: number; y: number }
  | { kind: 'text'; text: string; x: number; y: number };

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Only flag words clearly above the user's level (≥ 2 CEFR bands), so common
 *  near-level words (e.g. B1 cognates for an A2 reader) aren't underlined. */
function wellAbove(band: CefrLevel, level: CefrLevel): boolean {
  return levelIndex(band) - levelIndex(level) >= 2;
}

type Sim = string | 'error' | undefined;

interface Params {
  lang: Language;
  title: string;
  url: string;
  thumb?: string;
}

function readParams(): Params | null {
  const q = new URLSearchParams(location.search);
  const lang = q.get('lang') as Language | null;
  const title = q.get('title');
  const url = q.get('url');
  if (!lang || !title || !url) return null;
  return { lang, title, url, thumb: q.get('thumb') ?? undefined };
}

export function App() {
  const params = readParams();
  const [level, setLevel] = useState<CefrLevel | null>(null);
  const [native, setNative] = useState<Language>('de');
  const [model, setModel] = useState<string>('');
  const [paras, setParas] = useState<string[] | null>(null);
  const [sims, setSims] = useState<Sim[]>([]);
  const [visible, setVisible] = useState(1);
  const [completed, setCompleted] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [est, setEst] = useState<DifficultyEstimate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ranks, setRanks] = useState<RankMap | null>(null);
  const [names, setNames] = useState<Set<string>>(new Set());
  const [pop, setPop] = useState<Pop | null>(null);
  const [qs, setQs] = useState<(QuizQuestion | null | undefined)[]>([]);
  const [quizIdx, setQuizIdx] = useState<number | null>(null);
  const [answer, setAnswer] = useState<number | null>(null);
  const [score, setScore] = useState({ answered: 0, correct: 0 });
  const qInflight = useRef<Set<number>>(new Set());
  const extracted = useRef<Set<number>>(new Set());
  const openTimer = useRef<number>();
  const closeTimer = useRef<number>();

  const mounted = useRef(true);
  const inflight = useRef<Set<number>>(new Set());
  const startedTs = useRef(Date.now());

  useEffect(() => () => void (mounted.current = false), []);

  // For underlining borderline words + clicking them to translate.
  useEffect(() => {
    if (!params) return;
    void loadRanks(params.lang).then((r) => mounted.current && setRanks(r));
    void loadNames().then((n) => mounted.current && setNames(n));
  }, []);

  // Load settings + article (resume an existing lesson if present).
  useEffect(() => {
    if (!params) {
      setError('Fehlende Parameter.');
      return;
    }
    void (async () => {
      const s = await getSettings();
      setLevel(s.level);
      setNative(s.nativeLang);
      setModel(s.model);

      const existing = await getLesson(params.url);
      if (existing && existing.paragraphs.length) {
        startedTs.current = existing.startedTs;
        setParas(existing.paragraphs.map((p) => p.original));
        setSims(existing.paragraphs.map((p) => p.simplified));
        setQs(new Array(existing.paragraphs.length).fill(undefined));
        setVisible(Math.max(1, existing.progress));
        setCompleted(!!existing.completed);
        setScore({ answered: existing.quizAnswered ?? 0, correct: existing.quizCorrect ?? 0 });
      } else {
        const ps = await fetchArticleParagraphs(params.lang, params.title);
        if (!mounted.current) return;
        if (ps.length === 0) {
          setError('Artikeltext konnte nicht geladen werden.');
          return;
        }
        setParas(ps);
        setSims(new Array(ps.length).fill(undefined));
        setQs(new Array(ps.length).fill(undefined));
      }

      void estimateDifficulty(
        (existing?.paragraphs ?? []).map((p) => p.original).join(' ') || '',
        params.lang,
        s.level,
      ).then((e) => mounted.current && setEst(e));
    })();
  }, []);

  // Difficulty estimate once paragraphs are known (covers the fresh-fetch path).
  useEffect(() => {
    if (!paras || !level || est) return;
    void estimateDifficulty(paras.slice(0, 4).join(' '), params!.lang, level).then(
      (e) => mounted.current && setEst(e),
    );
  }, [paras, level]);

  // Background simplify: keep the visible paragraphs plus one look-ahead ready.
  // Sequential (one at a time) — the local model serves one request anyway.
  useEffect(() => {
    if (!paras || level === null) return;
    const target = Math.min(visible + 1, paras.length);
    let next = -1;
    for (let i = 0; i < target; i++) {
      if (sims[i] === undefined && !inflight.current.has(i)) {
        next = i;
        break;
      }
    }
    if (next < 0) return;
    inflight.current.add(next);
    void (async () => {
      const text = paras[next]!;
      const ck = cacheKey(params!.lang, level, text);
      let s: Sim = await getCached(params!.url, ck);
      if (s === undefined) {
        try {
          s = await simplifyParagraph(text, params!.lang, level, model);
          void putCached(params!.url, ck, s);
        } catch {
          s = 'error';
        }
      }
      inflight.current.delete(next);
      if (!mounted.current) return;
      setSims((prev) => {
        const n = prev.slice();
        n[next] = s ?? 'error';
        return n;
      });
    })();
  }, [paras, sims, visible, level, model]);

  // Generate the comprehension question for the current paragraph in the
  // background, so it's ready when the user presses "Gelesen".
  useEffect(() => {
    if (!paras || level === null) return;
    const i = visible - 1;
    if (i < 0 || qs[i] !== undefined || sims[i] === undefined) return;
    if (qInflight.current.has(i)) return;
    qInflight.current.add(i);
    const simText = typeof sims[i] === 'string' && sims[i] !== 'error' ? (sims[i] as string) : paras[i]!;
    void (async () => {
      let q: QuizQuestion | null = null;
      try {
        q = await generateParagraphQuestion(simText, params!.lang, level, model);
      } catch {
        q = null;
      }
      if (!mounted.current) return;
      setQs((prev) => {
        const n = prev.slice();
        n[i] = q;
        return n;
      });
    })();
  }, [paras, sims, qs, visible, level, model]);

  // Persist progress + simplified content as it changes.
  useEffect(() => {
    if (!paras || level === null) return;
    const lesson: Lesson = {
      url: params!.url,
      lang: params!.lang,
      level,
      title: params!.title,
      thumbnail: params!.thumb,
      dateKey: dateKey(new Date()),
      paragraphs: paras.map((original, i) => ({
        original,
        simplified: typeof sims[i] === 'string' && sims[i] !== 'error' ? (sims[i] as string) : undefined,
        read: completed || i < visible - 1,
      })),
      progress: visible,
      startedTs: startedTs.current,
      updatedTs: Date.now(),
      completed,
      quizAnswered: score.answered,
      quizCorrect: score.correct,
    };
    void saveLesson(lesson);
  }, [sims, visible, completed, paras, level, score]);

  function advance() {
    if (!paras) return;
    if (visible < paras.length) setVisible((v) => v + 1);
    else setCompleted(true);
  }

  // "Gelesen": collect a few new words, then show this paragraph's MC question
  // (if ready) before moving on.
  function onReadCurrent() {
    const i = visible - 1;
    if (!extracted.current.has(i)) {
      extracted.current.add(i);
      void extractVocab(i);
    }
    if (qs[i] && answer === null) setQuizIdx(i);
    else advance();
  }

  async function extractVocab(i: number) {
    if (!ranks || level === null || !paras) return;
    const original = paras[i]!;
    const skipCaps = params!.lang !== 'de';
    const seen = new Set<string>();
    const picks: Array<{ tok: string; rank: number }> = [];
    for (const tok of original.split(/[^\p{L}]+/u)) {
      if (tok.length < 4) continue;
      if (skipCaps && /^\p{Lu}/u.test(tok)) continue;
      const low = tok.toLowerCase();
      if (seen.has(low) || names.has(low)) continue;
      const rank = rankOf(ranks, tok);
      if (rank === undefined || !wellAbove(rankToBand(rank), level)) continue;
      seen.add(low);
      picks.push({ tok, rank });
    }
    picks.sort((a, b) => b.rank - a.rank); // rarest first
    for (const { tok } of picks.slice(0, 3)) {
      const info = await resolveWord(tok, params!.lang, native, level);
      if (!info.senses.length) continue; // only words we can actually translate
      void addVocab({
        id: newId(),
        text: info.word,
        learn: params!.lang,
        native,
        band: info.band,
        translation: info.senses[0]!.translations.slice(0, 3).join(', '),
        context: original.slice(0, 200),
        ts: Date.now(),
        seen: 1,
        reviews: 0,
      });
    }
  }

  function showWord(word: string, el: HTMLElement) {
    const r = el.getBoundingClientRect();
    setPop({ kind: 'word', word, x: r.left + window.scrollX, y: r.bottom + window.scrollY });
  }
  // Hover-to-translate (like marked words on live pages): open after a short
  // intent delay; keep open while the cursor is on the word or the popover.
  function wordEnter(word: string, el: HTMLElement) {
    window.clearTimeout(closeTimer.current);
    window.clearTimeout(openTimer.current);
    openTimer.current = window.setTimeout(() => showWord(word, el), 140);
  }
  function wordLeave() {
    window.clearTimeout(openTimer.current);
    scheduleClose();
  }
  function scheduleClose() {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setPop((p) => (p?.kind === 'word' ? null : p)), 260);
  }
  function onSelect() {
    const sel = window.getSelection();
    const t = sel?.toString().trim() ?? '';
    if (t.length < 2 || t.length > 200) return;
    const r = sel!.getRangeAt(0).getBoundingClientRect();
    setPop({ kind: 'text', text: t, x: r.left + window.scrollX, y: r.bottom + window.scrollY });
  }

  if (error) {
    return (
      <div class="lz-shell">
        <AppBar title={params?.title ?? 'Lektion'} />
        <main class="lz-main">
          <p class="lz-error">{error}</p>
        </main>
      </div>
    );
  }
  if (!paras || level === null) {
    return (
      <div class="lz-shell">
        <AppBar title={params?.title ?? 'Lektion'} />
        <main class="lz-main">
          <Dots />
        </main>
      </div>
    );
  }

  const total = paras.length;
  const lastIdx = visible - 1;

  return (
    <div class="lz-shell">
      <AppBar title={params!.title} />
      <main class="lz-main">
        <header class="lz-hero">
          {params!.thumb && <img class="lz-hero-img" src={params!.thumb} alt="" />}
          <div class="lz-hero-text">
            <h1 class="lz-title">{params!.title}</h1>
            <div class="lz-meta">
              {est && (
                <span
                  class="lz-rewrite"
                  title={`Original: ≈ ${Math.round(est.aboveShare * 100)} % der Wörter über ${level}`}
                >
                  Original <span class={`lz-tag t-${est.tag}`}>{ORIG_LABEL[est.tag]}</span>
                  <span class="lz-rewrite-arrow">→</span> vereinfacht{' '}
                  <span class="lz-tag lz-tag-target">{level}</span>
                </span>
              )}
              <span class="lz-progress">
                Absatz {Math.min(visible, total)} / {total}
              </span>
              <button
                type="button"
                class={`lz-orig-toggle ${showOriginal ? 'on' : ''}`}
                onClick={() => setShowOriginal((v) => !v)}
              >
                {showOriginal ? 'Original ausblenden' : 'Original zeigen'}
              </button>
            </div>
          </div>
        </header>

        <article class="lz-article" onMouseUp={onSelect}>
          {paras.slice(0, visible).map((original, i) => (
            <Para
              key={i}
              original={original}
              sim={sims[i]}
              showOriginal={showOriginal}
              current={i === lastIdx && !completed}
              readable={quizIdx === null}
              onRead={onReadCurrent}
              isLast={i === total - 1}
              lang={params!.lang}
              ranks={ranks}
              names={names}
              level={level}
              onEnter={wordEnter}
              onLeave={wordLeave}
              onClick={showWord}
            />
          ))}
          {quizIdx !== null && qs[quizIdx] && (
            <ParaQuiz
              q={qs[quizIdx]!}
              answer={answer}
              isLast={quizIdx === total - 1}
              onAnswer={(idx) => {
                if (answer !== null) return;
                setAnswer(idx);
                const ok = qs[quizIdx]!.options[idx] === qs[quizIdx]!.answer;
                setScore((s) => ({ answered: s.answered + 1, correct: s.correct + (ok ? 1 : 0) }));
              }}
              onNext={() => {
                setQuizIdx(null);
                setAnswer(null);
                advance();
              }}
            />
          )}
        </article>

        {completed && (
          <section class="lz-done">
            <h2>Geschafft! 🎉</h2>
            <p>Du hast alle {total} Absätze gelesen.</p>
            {score.answered > 0 && (
              <p class="lz-done-score">
                Quiz: {score.correct} / {score.answered} richtig
              </p>
            )}
            <p class="lz-soon">Neue Vokabeln aus dieser Lektion findest du im Lernen-Tab.</p>
          </section>
        )}

        <footer class="lz-credit">
          Quelle:{' '}
          <a href={params!.url} target="_blank" rel="noopener noreferrer">
            Wikipedia
          </a>{' '}
          · Text unter CC BY-SA. Vereinfachte Fassung von Sidelearn (lokales Modell).
        </footer>
      </main>

      {pop && (
        <>
          {pop.kind === 'text' && (
            <div class="lz-pop-backdrop" onClick={() => setPop(null)} />
          )}
          <WordPopover
            key={pop.kind === 'word' ? `w:${pop.word}` : `t:${pop.text}`}
            pop={pop}
            lang={params!.lang}
            native={native}
            level={level}
            model={model}
            onEnter={() => window.clearTimeout(closeTimer.current)}
            onLeave={() => pop.kind === 'word' && scheduleClose()}
          />
        </>
      )}
    </div>
  );
}

/** Translation popover for a clicked word or a text selection. */
function WordPopover({
  pop,
  lang,
  native,
  level,
  model,
  onEnter,
  onLeave,
}: {
  pop: Pop;
  lang: Language;
  native: Language;
  level: CefrLevel;
  model: string;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const [info, setInfo] = useState<WordInfo | null>(null);
  const [trans, setTrans] = useState<string | null>(null);
  const [expl, setExpl] = useState<WordExplanation | null>(null);
  const [explLoading, setExplLoading] = useState(false);
  const [merked, setMerked] = useState(false);
  const alive = useRef(true);

  const text = pop.kind === 'word' ? pop.word : pop.text.trim();
  const isWord = !/\s/.test(text);

  useEffect(() => {
    alive.current = true;
    if (isWord) {
      void resolveWord(text, lang, native, level).then((i) => alive.current && setInfo(i));
    } else {
      void translateParagraph(text, lang, native, model).then(
        (r) => alive.current && setTrans(r.translation),
      );
    }
    return () => void (alive.current = false);
  }, []);

  function merk() {
    if (!info) return;
    void addVocab({
      id: newId(),
      text: info.word,
      learn: lang,
      native,
      band: info.band,
      translation: info.senses[0]?.translations.slice(0, 3).join(', '),
      ts: Date.now(),
      seen: 1,
      reviews: 0,
    });
    setMerked(true);
  }
  async function more() {
    if (!info) return;
    setExplLoading(true);
    try {
      const e = await explainWord(info.word, lang, native, model);
      if (alive.current) setExpl(e);
    } finally {
      if (alive.current) setExplLoading(false);
    }
  }

  return (
    <div
      class="lz-pop"
      style={{ top: `${pop.y + 6}px`, left: `${pop.x}px` }}
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {isWord ? (
        info === null ? (
          <Dots />
        ) : (
          <>
            <div class="lz-pop-head">
              <span class="lz-pop-word">{info.word}</span>
              <span class="lz-pop-band" data-band={info.band[0]}>
                {info.band}
              </span>
            </div>
            {info.senses.length ? (
              <p class="lz-pop-trans">{info.senses[0]!.translations.slice(0, 4).join(', ')}</p>
            ) : (
              <p class="lz-pop-empty">keine Wörterbuch-Übersetzung — „mehr" fragt das Modell.</p>
            )}
            {expl && (
              <div class="lz-pop-expl">
                <p>{expl.meaning}</p>
                {expl.examples[0] && <p class="lz-pop-ex">{expl.examples[0]}</p>}
              </div>
            )}
            <div class="lz-pop-actions">
              <button type="button" onClick={merk} disabled={merked}>
                {merked ? '✓ gemerkt' : '★ merken'}
              </button>
              {!expl && (
                <button type="button" onClick={() => void more()} disabled={explLoading}>
                  {explLoading ? <Dots /> : 'mehr'}
                </button>
              )}
            </div>
          </>
        )
      ) : trans === null ? (
        <Dots />
      ) : (
        <>
          <p class="lz-pop-src">{pop.kind === 'text' ? pop.text : ''}</p>
          <p class="lz-pop-trans">{trans}</p>
        </>
      )}
    </div>
  );
}

/** Render text with borderline words underlined + clickable to translate. */
function RichText({
  text,
  lang,
  ranks,
  names,
  level,
  onEnter,
  onLeave,
  onClick,
}: {
  text: string;
  lang: Language;
  ranks: RankMap | null;
  names: Set<string>;
  level: CefrLevel;
  onEnter: (word: string, el: HTMLElement) => void;
  onLeave: () => void;
  onClick: (word: string, el: HTMLElement) => void;
}) {
  if (!ranks) return <>{text}</>;
  // In languages that don't capitalise common nouns, a capitalised word is
  // almost always a proper noun — skip it (not so in German, where all nouns are).
  const skipCaps = lang !== 'de';
  const tokens = text.split(/(\p{L}[\p{L}\-']*)/u);
  return (
    <>
      {tokens.map((tok, i) => {
        if (i % 2 === 0 || tok.length < 3 || names.has(tok.toLowerCase())) return tok;
        if (skipCaps && /^\p{Lu}/u.test(tok)) return tok;
        const rank = rankOf(ranks, tok);
        if (rank === undefined) return tok;
        const band = rankToBand(rank);
        if (!wellAbove(band, level)) return tok;
        return (
          <button
            type="button"
            class="lz-word"
            data-band={band[0]}
            onMouseEnter={(e) => onEnter(tok, e.currentTarget)}
            onMouseLeave={onLeave}
            onClick={(e) => onClick(tok, e.currentTarget)}
          >
            {tok}
          </button>
        );
      })}
    </>
  );
}

function Para({
  original,
  sim,
  showOriginal,
  current,
  readable,
  onRead,
  isLast,
  lang,
  ranks,
  names,
  level,
  onEnter,
  onLeave,
  onClick,
}: {
  original: string;
  sim: Sim;
  showOriginal: boolean;
  current: boolean;
  readable: boolean;
  onRead: () => void;
  isLast: boolean;
  lang: Language;
  ranks: RankMap | null;
  names: Set<string>;
  level: CefrLevel;
  onEnter: (word: string, el: HTMLElement) => void;
  onLeave: () => void;
  onClick: (word: string, el: HTMLElement) => void;
}) {
  const text = sim === 'error' ? original : sim;
  return (
    <div class={`lz-para ${current ? 'current' : 'past'}`}>
      {text === undefined ? (
        <Dots />
      ) : (
        <p class="lz-simplified">
          <RichText
            text={text}
            lang={lang}
            ranks={ranks}
            names={names}
            level={level}
            onEnter={onEnter}
            onLeave={onLeave}
            onClick={onClick}
          />
        </p>
      )}
      {showOriginal && sim !== undefined && sim !== 'error' && (
        <p class="lz-original">{original}</p>
      )}
      {current && readable && text !== undefined && (
        <button type="button" class="lz-read-btn" onClick={onRead}>
          {isLast ? 'Fertig ✓' : 'Gelesen ✓'}
        </button>
      )}
    </div>
  );
}

/** A single multiple-choice question shown after a paragraph. */
function ParaQuiz({
  q,
  answer,
  isLast,
  onAnswer,
  onNext,
}: {
  q: QuizQuestion;
  answer: number | null;
  isLast: boolean;
  onAnswer: (idx: number) => void;
  onNext: () => void;
}) {
  return (
    <div class="lz-quiz">
      <p class="lz-quiz-q">{q.prompt}</p>
      <div class="lz-quiz-opts">
        {q.options.map((opt, i) => {
          let cls = '';
          if (answer !== null) {
            if (opt === q.answer) cls = 'correct';
            else if (answer === i) cls = 'wrong';
            else cls = 'dim';
          }
          return (
            <button
              key={i}
              type="button"
              class={`lz-quiz-opt ${cls}`}
              disabled={answer !== null}
              onClick={() => onAnswer(i)}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {answer !== null && (
        <button type="button" class="lz-quiz-next" onClick={onNext}>
          {isLast ? 'Fertig ✓' : 'Weiter →'}
        </button>
      )}
    </div>
  );
}

/** App bar: Sidelearn brand + "App-Modus" marker. */
function AppBar({ title }: { title: string }) {
  return (
    <div class="lz-appbar">
      <span class="lz-brand">
        <span class="lz-brand-dot" /> Sidelearn
      </span>
      <span class="lz-mode">Lern-Modus</span>
      <span class="lz-appbar-title">{title}</span>
    </div>
  );
}

function Dots() {
  return (
    <span class="lz-dots" aria-label="lädt">
      <i />
      <i />
      <i />
    </span>
  );
}
