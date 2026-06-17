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
import { isAboveLevel, rankToBand, type CefrLevel } from '@/core/difficulty/banding';
import { loadRanks, rankOf } from '@/core/difficulty/frequency';
import { getSettings } from '@/core/settings';
import { fetchArticleParagraphs } from '@/core/wikifeed';
import { explainWord, simplifyParagraph, translateParagraph } from '@/core/llm/prompts';
import { resolveWord } from '@/core/wordinfo';
import { loadNames } from '@/core/names';
import { addVocab } from '@/core/vocab';
import { cacheKey, getCached, putCached } from '@/core/simplify';
import { dateKey } from '@/core/daily';
import { getLesson, saveLesson, type Lesson } from '@/core/lessons';
import type { WordExplanation, WordInfo } from '@/core/types';
import {
  difficultyLabel,
  estimateDifficulty,
  type DifficultyEstimate,
} from '@/core/difficulty/estimate';

type RankMap = Record<string, number>;

/** Active translation popover anchored to a clicked word or a text selection. */
type Pop =
  | { kind: 'word'; word: string; x: number; y: number }
  | { kind: 'text'; text: string; x: number; y: number };

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
        setVisible(Math.max(1, existing.progress));
        setCompleted(!!existing.completed);
      } else {
        const ps = await fetchArticleParagraphs(params.lang, params.title);
        if (!mounted.current) return;
        if (ps.length === 0) {
          setError('Artikeltext konnte nicht geladen werden.');
          return;
        }
        setParas(ps);
        setSims(new Array(ps.length).fill(undefined));
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
    };
    void saveLesson(lesson);
  }, [sims, visible, completed, paras, level]);

  function advance() {
    if (!paras) return;
    if (visible < paras.length) setVisible((v) => v + 1);
    else setCompleted(true);
  }

  function openWord(word: string, el: HTMLElement) {
    const r = el.getBoundingClientRect();
    setPop({ kind: 'word', word, x: r.left + window.scrollX, y: r.bottom + window.scrollY });
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
                  class={`lz-tag t-${est.tag}`}
                  title={`≈ ${Math.round(est.aboveShare * 100)} % der bekannten Wörter über ${level}`}
                >
                  {difficultyLabel(est.tag, level)}
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
              onRead={advance}
              isLast={i === total - 1}
              ranks={ranks}
              names={names}
              level={level}
              onWord={openWord}
            />
          ))}
        </article>

        {completed && (
          <section class="lz-done">
            <h2>Geschafft! 🎉</h2>
            <p>Du hast alle {total} Absätze gelesen.</p>
            <p class="lz-soon">Quiz &amp; Vokabeln zu dieser Lektion kommen als Nächstes.</p>
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
          <div class="lz-pop-backdrop" onClick={() => setPop(null)} />
          <WordPopover
            pop={pop}
            lang={params!.lang}
            native={native}
            level={level}
            model={model}
            onClose={() => setPop(null)}
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
  onClose,
}: {
  pop: Pop;
  lang: Language;
  native: Language;
  level: CefrLevel;
  model: string;
  onClose: () => void;
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
  ranks,
  names,
  level,
  onWord,
}: {
  text: string;
  ranks: RankMap | null;
  names: Set<string>;
  level: CefrLevel;
  onWord: (word: string, el: HTMLElement) => void;
}) {
  if (!ranks) return <>{text}</>;
  const tokens = text.split(/(\p{L}[\p{L}\-']*)/u);
  return (
    <>
      {tokens.map((tok, i) => {
        if (i % 2 === 0 || tok.length < 3 || names.has(tok.toLowerCase())) return tok;
        const rank = rankOf(ranks, tok);
        if (rank === undefined) return tok;
        const band = rankToBand(rank);
        if (!isAboveLevel(band, level)) return tok;
        return (
          <button
            type="button"
            class="lz-word"
            data-band={band[0]}
            onClick={(e) => onWord(tok, e.currentTarget)}
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
  onRead,
  isLast,
  ranks,
  names,
  level,
  onWord,
}: {
  original: string;
  sim: Sim;
  showOriginal: boolean;
  current: boolean;
  onRead: () => void;
  isLast: boolean;
  ranks: RankMap | null;
  names: Set<string>;
  level: CefrLevel;
  onWord: (word: string, el: HTMLElement) => void;
}) {
  const text = sim === 'error' ? original : sim;
  return (
    <div class={`lz-para ${current ? 'current' : 'past'}`}>
      {text === undefined ? (
        <Dots />
      ) : (
        <p class="lz-simplified">
          <RichText text={text} ranks={ranks} names={names} level={level} onWord={onWord} />
        </p>
      )}
      {showOriginal && sim !== undefined && sim !== 'error' && (
        <p class="lz-original">{original}</p>
      )}
      {current && text !== undefined && (
        <button type="button" class="lz-read-btn" onClick={onRead}>
          {isLast ? 'Fertig ✓' : 'Gelesen ✓'}
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
