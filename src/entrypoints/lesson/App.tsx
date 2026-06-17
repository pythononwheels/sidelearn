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
import { type CefrLevel } from '@/core/difficulty/banding';
import { getSettings } from '@/core/settings';
import { fetchArticleParagraphs } from '@/core/wikifeed';
import { simplifyParagraph } from '@/core/llm/prompts';
import { cacheKey, getCached, putCached } from '@/core/simplify';
import { dateKey } from '@/core/daily';
import { getLesson, saveLesson, type Lesson } from '@/core/lessons';
import {
  difficultyLabel,
  estimateDifficulty,
  type DifficultyEstimate,
} from '@/core/difficulty/estimate';

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
  const [model, setModel] = useState<string>('');
  const [paras, setParas] = useState<string[] | null>(null);
  const [sims, setSims] = useState<Sim[]>([]);
  const [visible, setVisible] = useState(1);
  const [completed, setCompleted] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [est, setEst] = useState<DifficultyEstimate | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mounted = useRef(true);
  const inflight = useRef<Set<number>>(new Set());
  const startedTs = useRef(Date.now());

  useEffect(() => () => void (mounted.current = false), []);

  // Load settings + article (resume an existing lesson if present).
  useEffect(() => {
    if (!params) {
      setError('Fehlende Parameter.');
      return;
    }
    void (async () => {
      const s = await getSettings();
      setLevel(s.level);
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

        <article class="lz-article">
          {paras.slice(0, visible).map((original, i) => (
            <Para
              key={i}
              original={original}
              sim={sims[i]}
              showOriginal={showOriginal}
              current={i === lastIdx && !completed}
              onRead={advance}
              isLast={i === total - 1}
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
    </div>
  );
}

function Para({
  original,
  sim,
  showOriginal,
  current,
  onRead,
  isLast,
}: {
  original: string;
  sim: Sim;
  showOriginal: boolean;
  current: boolean;
  onRead: () => void;
  isLast: boolean;
}) {
  const text = sim === 'error' ? original : sim;
  return (
    <div class={`lz-para ${current ? 'current' : 'past'}`}>
      {text === undefined ? (
        <Dots />
      ) : (
        <p class="lz-simplified">{text}</p>
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
