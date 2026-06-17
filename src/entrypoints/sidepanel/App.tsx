import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { CEFR_LEVELS, type CefrLevel } from '@/core/difficulty/banding';
import { LANG_LABELS, LANGUAGES, MARKER_COLORS, type Language, type Settings } from '@/core/config';
import { getSettings, setSettings } from '@/core/settings';
import { isReachable } from '@/core/llm/lmstudio';
import { listModels, type ModelInfo } from '@/core/llm/models';
import { sendMessage } from '@/core/messaging';
import {
  clearResults,
  getResultsFor,
  pageKey,
  removeResult,
  watchAllResults,
  watchFocus,
  type PanelResult,
} from '@/core/result';
import {
  addVocab,
  clearVocab,
  getVocab,
  recordReview,
  removeVocab,
  watchVocab,
  type VocabEntry,
} from '@/core/vocab';
import { buildSession, canReview, selectForReview } from '@/core/review';
import { buildClozeQuestions } from '@/core/cloze';
import { generatePageQuiz, type QuizQuestion } from '@/core/quiz';
import {
  addBookmark,
  getBookmarks,
  removeBookmark,
  watchBookmarks,
  type Bookmark,
} from '@/core/bookmarks';
import {
  activeStreak,
  ensureToday,
  isDoneToday,
  markDoneToday,
  watchDaily,
  type DailyState,
} from '@/core/daily';
import { computeStats, type LearnStats } from '@/core/stats';
import { estimateDifficulty, difficultyLabel, type DifficultyTag } from '@/core/difficulty/estimate';
import { askAboutPage, type ChatTurn } from '@/core/chat';
import { getChat, setChat } from '@/core/chatstore';
import { translateParagraph } from '@/core/llm/prompts';
import { renderMarkdown } from '@/core/markdown';
import { pickStudyWords, type Candidate } from '@/core/collect';
import { resolveWord } from '@/core/wordinfo';
import { normalize } from '@/core/difficulty/frequency';

/**
 * Side panel — the stable backbone.
 *
 * First run shows onboarding. Afterwards the panel is quiet: a result area that
 * reflects the last translation/explanation (driven by right-click or hover
 * "more"), settings tucked behind the gear, and a collapsible manual translator.
 */
export function App() {
  const [settings, setLocal] = useState<Settings | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [results, setResults] = useState<PanelResult[]>([]);
  const [currentKey, setCurrentKey] = useState('');
  const [vocab, setVocab] = useState<VocabEntry[]>([]);
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [colorOpen, setColorOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [reviewChooser, setReviewChooser] = useState(false);
  const [resultsExpanded, setResultsExpanded] = useState(false);
  const [activeResultId, setActiveResultId] = useState<string | null>(null);
  const autoOpenRef = useRef(false);
  const [collectBusy, setCollectBusy] = useState(false);
  const [collectMsg, setCollectMsg] = useState<string | null>(null);
  const [daily, setDaily] = useState<DailyState | null>(null);
  const [dailyTag, setDailyTag] = useState<DifficultyTag | null>(null);
  const [stats, setStats] = useState<LearnStats | null>(null);
  const prevResultLen = useRef(0);
  const resultsReady = useRef(false);
  // Latest results/key for the focus watcher (subscribed once, reads fresh refs).
  const resultsRef = useRef<PanelResult[]>([]);
  const keyRef = useRef('');
  resultsRef.current = results;
  keyRef.current = currentKey;

  useEffect(() => {
    void getSettings().then(setLocal);
    void isReachable().then(setOnline);
    void listModels().then(setModels);
    void getVocab().then(setVocab);
    void getBookmarks().then(setBookmarks);
    const offVocab = watchVocab(setVocab);
    const offBookmarks = watchBookmarks(setBookmarks);
    // Signal "panel open for THIS window" to the background via a port named
    // panel:<windowId>; auto-disconnects on close, reconnects if the SW restarts.
    let closing = false;
    let port: ReturnType<typeof browser.runtime.connect> | null = null;
    void (async () => {
      const win = await browser.windows.getCurrent().catch(() => null);
      const wid = win?.id ?? -1;
      const connect = () => {
        port = browser.runtime.connect({ name: `panel:${wid}` });
        port.onDisconnect.addListener(() => {
          if (!closing) connect();
        });
      };
      connect();
    })();

    // Show the active page's results; follow tab switches and navigation.
    let key = '';
    async function refreshKey() {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      key = tab?.url ? pageKey(tab.url) : '';
      setCurrentKey(key);
      setResults(await getResultsFor(key));
    }
    void refreshKey();
    const onActivated = () => void refreshKey();
    const onUpdated = (_id: number, info: { url?: string }, tab: { active?: boolean }) => {
      if (tab.active && info.url) void refreshKey();
    };
    browser.tabs.onActivated.addListener(onActivated);
    browser.tabs.onUpdated.addListener(onUpdated);
    const offResults = watchAllResults((all) => setResults(all[key] ?? []));

    // Hover "✓ zeigen" → jump to an existing card, collapsing the rest.
    const offFocus = watchFocus((f) => {
      if (!f || f.key !== keyRef.current) return;
      const hit = resultsRef.current.find(
        (r) => r.kind === 'explanation' && r.title === f.title && r.status !== 'error',
      );
      if (!hit) return;
      autoOpenRef.current = true;
      setChatOpen(false);
      setReviewChooser(false);
      setQuiz(null);
      setResultsExpanded(true);
      setActiveResultId(hit.id);
    });

    return () => {
      closing = true;
      offVocab();
      offBookmarks();
      offResults();
      offFocus();
      port?.disconnect();
      browser.tabs.onActivated.removeListener(onActivated);
      browser.tabs.onUpdated.removeListener(onUpdated);
    };
  }, []);

  // When a new result is created, open the Ergebnisse view to show it.
  useEffect(() => {
    if (!resultsReady.current) {
      resultsReady.current = true;
      prevResultLen.current = results.length;
      return;
    }
    if (results.length > prevResultLen.current) {
      // Exit any full view, expand Übersetzungen, focus the new card (others collapse).
      autoOpenRef.current = true;
      setChatOpen(false);
      setReviewChooser(false);
      setQuiz(null);
      setResultsExpanded(true);
      setActiveResultId(results[0]?.id ?? null);
    }
    prevResultLen.current = results.length;
  }, [results]);

  // Start-card stats are derived from the vocab store — recompute on change.
  useEffect(() => {
    setStats(computeStats(vocab, Date.now()));
  }, [vocab]);

  // Daily challenge: fetch today's article (cached per day), tag its difficulty,
  // and keep streak/done in sync. Off → no network call, no card.
  useEffect(() => {
    if (!settings?.dailyChallenge) {
      setDaily(null);
      setDailyTag(null);
      return;
    }
    let cancelled = false;
    const { learnLang, level } = settings;
    void (async () => {
      const state = await ensureToday(learnLang, new Date());
      if (cancelled) return;
      setDaily(state);
      if (state.article?.extract) {
        const est = await estimateDifficulty(state.article.extract, learnLang, level);
        if (!cancelled) setDailyTag(est.tag);
      } else {
        setDailyTag(null);
      }
    })();
    const off = watchDaily((s) => {
      if (!cancelled) setDaily(s);
    });
    return () => {
      cancelled = true;
      off();
    };
  }, [settings?.dailyChallenge, settings?.learnLang, settings?.level]);

  if (!settings) return null;

  function openDaily() {
    if (daily?.article?.url) void browser.tabs.create({ url: daily.article.url });
  }
  async function completeDaily() {
    const next = await markDoneToday(new Date());
    if (next) setDaily(next);
  }

  /** Open exactly one full-view (others close). */
  const showOnly = (v: 'chat' | 'chooser' | 'none') => {
    setChatOpen(v === 'chat');
    setReviewChooser(v === 'chooser');
    setQuiz(null);
  };
  const fullscreen = chatOpen || quiz !== null || reviewChooser;

  async function patch(p: Partial<Settings>) {
    setLocal(await setSettings(p));
  }

  const isBookmarked = bookmarks.some((b) => b.url === currentKey);

  async function toggleBookmark() {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return;
    const key = pageKey(tab.url);
    if (bookmarks.some((b) => b.url === key)) {
      await removeBookmark(key);
      return;
    }
    let color: string | undefined;
    if (tab.id != null) {
      try {
        const [res] = await browser.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const meta = document.querySelector('meta[name="theme-color"]');
            return meta?.getAttribute('content') || getComputedStyle(document.body).backgroundColor || '';
          },
        });
        color = (res?.result as string) || undefined;
      } catch {
        // Scripting may be blocked on some pages — bookmark without a colour.
      }
    }
    await addBookmark({
      url: key,
      title: tab.title ?? key,
      favIconUrl: tab.favIconUrl,
      color,
      ts: Date.now(),
    });
  }

  // Pull a level-appropriate mix of words from the page into the vocab list.
  async function collectFromPage() {
    if (!settings || collectBusy) return;
    setCollectMsg(null);
    setCollectBusy(true);
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      let words: string[] = [];
      if (tab?.id != null) {
        try {
          const [res] = await browser.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              const el = document.querySelector('article, main') ?? document.body;
              const text = (el as HTMLElement).innerText.toLowerCase();
              const set = new Set<string>();
              for (const w of text.match(/\p{L}[\p{L}'-]{2,}/gu) ?? []) {
                set.add(w);
                if (set.size >= 500) break;
              }
              return [...set];
            },
          });
          words = (res?.result as string[]) ?? [];
        } catch {
          setCollectMsg('Seite nicht lesbar.');
          return;
        }
      }
      const have = new Set(vocab.map((v) => `${v.learn}:${normalize(v.text)}`));
      const cands: Candidate[] = [];
      for (const w of shuffle(words)) {
        if (have.has(`${settings.learnLang}:${normalize(w)}`)) continue;
        const info = await resolveWord(w, settings.learnLang, settings.nativeLang, settings.level);
        const translation = info.senses[0]?.translations.slice(0, 3).join(', ');
        if (translation) cands.push({ word: w, band: info.band, translation });
      }
      const picked = pickStudyWords(cands, settings.level);
      for (const c of picked) {
        await addVocab({
          id: `${Date.now()}-${Math.random()}`,
          text: c.word,
          learn: settings.learnLang,
          native: settings.nativeLang,
          band: c.band,
          translation: c.translation,
          ts: Date.now(),
          seen: 1,
          reviews: 0,
        });
      }
      setCollectMsg(picked.length ? `${picked.length} Wörter gesammelt` : 'Nichts Passendes gefunden.');
    } finally {
      setCollectBusy(false);
    }
  }

  // Click a saved word → show its explanation in Übersetzungen (reuse if present,
  // otherwise ask the LLM). Focuses that card; never stacks duplicate requests.
  function explainVocab(word: string, context?: string) {
    setChatOpen(false);
    setReviewChooser(false);
    setQuiz(null);
    setResultsExpanded(true);
    const existing = results.find(
      (r) => r.kind === 'explanation' && r.title === word && r.status !== 'error',
    );
    if (existing) {
      autoOpenRef.current = true;
      setActiveResultId(existing.id);
    } else {
      void sendMessage({ type: 'explainToPanel', word, context });
    }
  }

  async function startReview(mode: Settings['reviewMode']) {
    setReviewChooser(false);
    setChatOpen(false);
    if (!settings) return;
    void patch({ reviewMode: mode });

    type Item = { q: QuizQuestion; id: string | undefined };
    const wordItems: Item[] = buildSession(vocab, 10).map((q) => ({
      q: { prompt: q.word, options: q.options, answer: q.answer },
      id: q.entryId,
    }));

    let clozeItems: Item[] = [];
    if (mode !== 'words') {
      const text = await getPageText();
      const ordered = selectForReview(vocab, 20).map((e) => e.text);
      clozeItems = buildClozeQuestions(text, ordered, vocab.map((e) => e.text)).map((q) => ({
        q,
        id: vocab.find((e) => normalize(e.text) === normalize(q.answer))?.id,
      }));
    }

    const items =
      mode === 'words'
        ? wordItems
        : mode === 'sentences'
          ? clozeItems.length
            ? clozeItems
            : wordItems
          : interleave(wordItems, clozeItems);

    if (!items.length) return;
    setQuiz({
      title: mode === 'words' ? 'Vokabeln' : mode === 'sentences' ? 'Sätze' : 'Mix',
      questions: items.map((i) => i.q),
      onAnswer: (idx, correct) => {
        const id = items[idx]?.id;
        if (id) void recordReview(id, correct);
      },
    });
  }

  // Pull the active page's main text and translate it into the panel.
  async function translatePage() {
    const text = await getPageText();
    if (text) {
      void sendMessage({
        type: 'translateToPanel',
        text,
        title: 'Seitenübersetzung',
        hideSource: true,
        pageKey: currentKey,
      });
    }
  }

  async function startPageQuiz() {
    if (!settings) return;
    setQuizError(null);
    setQuizLoading(true);
    try {
      const text = await getPageText();
      if (!text) throw new Error('Kein Seitentext gefunden.');
      const questions = await generatePageQuiz(
        text,
        settings.learnLang,
        settings.nativeLang,
        settings.level,
        settings.model,
      );
      if (!questions.length) throw new Error('Das Modell lieferte kein verwertbares Quiz.');
      setQuiz({ title: 'Seiten-Quiz', questions });
    } catch (err) {
      setQuizError(String(err instanceof Error ? err.message : err));
    } finally {
      setQuizLoading(false);
    }
  }

  if (!settings.onboarded) return <Onboarding initial={settings} onDone={patch} />;

  return (
    <main class={`ll-panel ${fullscreen ? 'll-full' : ''}`}>
      <header class="ll-panel-head">
        <div class="ll-head-left">
          <span class="ll-badge">
            {settings.learnLang.toUpperCase()} → {settings.nativeLang.toUpperCase()}
          </span>
          <span class="ll-badge">{settings.level}</span>
        </div>
        <div class="ll-head-right">
          <span class={`ll-status ${online ? 'on' : 'off'}`} title="LM Studio">
            {online === null ? '…' : online ? '● LM Studio' : '○ LM Studio'}
          </span>
          <button
            type="button"
            class={`ll-gear ${settingsOpen ? 'active' : ''}`}
            title="Einstellungen"
            onClick={() => setSettingsOpen((v) => !v)}
          >
            ⚙
          </button>
        </div>
      </header>

      {!fullscreen && (
      <>
      <div class="ll-mark-row">
        <button
          type="button"
          class={`ll-marktoggle ${settings.inlineEnabled ? 'on' : 'off'}`}
          onClick={() => patch({ inlineEnabled: !settings.inlineEnabled })}
        >
          {settings.inlineEnabled ? '◉ Markierung an' : '○ Markierung aus'}
        </button>
        <button
          type="button"
          class="ll-colorbtn"
          title="Markierungsfarbe"
          onClick={() => setColorOpen((v) => !v)}
        >
          {settings.markerColor === 'auto' ? (
            <span class="ll-color-auto">A</span>
          ) : (
            <span class="ll-color-dot" style={{ background: settings.markerColor }} />
          )}
        </button>
      </div>
      {colorOpen && (
        <div class="ll-palette">
          {MARKER_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              class={`ll-swatch ${settings.markerColor === c.value ? 'sel' : ''}`}
              title={c.label}
              onClick={() => {
                void patch({ markerColor: c.value });
                setColorOpen(false);
              }}
            >
              {c.value === 'auto' ? (
                <span class="ll-color-auto">A</span>
              ) : (
                <span class="ll-color-dot" style={{ background: c.value }} />
              )}
              {c.label}
            </button>
          ))}
        </div>
      )}

      <nav class="ll-nav">
        <button
          type="button"
          class={`ll-star ${isBookmarked ? 'on' : ''}`}
          title={isBookmarked ? 'Seite gemerkt — entfernen' : 'Seite merken'}
          onClick={() => void toggleBookmark()}
        >
          {isBookmarked ? '★' : '☆'}
        </button>
        <button
          type="button"
          class="ll-navbtn"
          disabled={!canReview(vocab)}
          title="Üben: Wörter, Sätze (Lückentext) oder Mix (ab 4 Wörtern)."
          onClick={() => showOnly('chooser')}
        >
          Vokabeln üben
        </button>
        <button
          type="button"
          class="ll-navbtn"
          disabled={!online}
          title={online ? undefined : 'LM Studio offline'}
          onClick={translatePage}
        >
          Seite übersetzen
        </button>
        <button
          type="button"
          class="ll-navbtn"
          disabled={!online || quizLoading}
          title={online ? undefined : 'LM Studio offline'}
          onClick={startPageQuiz}
        >
          {quizLoading ? <Dots /> : 'Seiten-Quiz'}
        </button>
        <button
          type="button"
          class="ll-navbtn"
          disabled={!online}
          title={online ? undefined : 'LM Studio offline'}
          onClick={() => showOnly('chat')}
        >
          Chat
        </button>
      </nav>
      {quizError && <p class="ll-error ll-nav-error">{quizError}</p>}

      {settings.dailyChallenge && daily?.article && (
        <DailyCard
          article={daily.article}
          tag={dailyTag}
          level={settings.level}
          done={isDoneToday(daily, new Date())}
          streak={activeStreak(daily, new Date())}
          onOpen={openDaily}
          onDone={() => void completeDaily()}
        />
      )}
      {stats && (stats.vocab.all > 0 || stats.review.answered > 0) && <StatsCard stats={stats} />}
      </>
      )}

      {settingsOpen && (
        <section class="ll-settings">
          <LanguagePicker native={settings.nativeLang} learn={settings.learnLang} onChange={patch} />
          <label>
            Mein Niveau
            <select
              value={settings.level}
              onChange={(e) => patch({ level: e.currentTarget.value as CefrLevel })}
            >
              {CEFR_LEVELS.map((l) => (
                <option value={l}>{l}</option>
              ))}
            </select>
          </label>
          <label>
            Modell
            <select value={settings.model} onChange={(e) => patch({ model: e.currentTarget.value })}>
              {models.length === 0 && <option value={settings.model}>{settings.model}</option>}
              {models.map((m) => (
                <option value={m.id}>{modelLabel(m)}</option>
              ))}
            </select>
          </label>
          <label class="ll-toggle">
            <input
              type="checkbox"
              checked={settings.markOnlyWithDict}
              onChange={(e) => patch({ markOnlyWithDict: e.currentTarget.checked })}
            />
            Nur Wörter mit Wörterbuch-Eintrag markieren
          </label>
          <label class="ll-toggle">
            <input
              type="checkbox"
              checked={settings.keepResults}
              onChange={(e) => patch({ keepResults: e.currentTarget.checked })}
            />
            Ergebnisse sammeln (sonst nur das letzte)
          </label>
          <label class="ll-toggle">
            <input
              type="checkbox"
              checked={settings.dailyChallenge}
              onChange={(e) => patch({ dailyChallenge: e.currentTarget.checked })}
            />
            Tägliche Challenge (lädt einen Artikel von Wikipedia)
          </label>
        </section>
      )}

      {reviewChooser ? (
        <ReviewChooser
          current={settings.reviewMode}
          onPick={(m) => void startReview(m)}
          onCancel={() => setReviewChooser(false)}
        />
      ) : chatOpen ? (
        <Chat
          key={currentKey}
          pageKey={currentKey}
          learn={settings.learnLang}
          native={settings.nativeLang}
          level={settings.level}
          model={settings.model}
          online={!!online}
          onExit={() => setChatOpen(false)}
        />
      ) : quiz ? (
        <Quiz state={quiz} onExit={() => setQuiz(null)} />
      ) : (
        <>
          <details
            class="ll-section"
            name="ll-acc"
            open={resultsExpanded}
            onToggle={(e) => {
              const open = e.currentTarget.open;
              setResultsExpanded(open);
              if (open) {
                if (autoOpenRef.current) autoOpenRef.current = false;
                else setActiveResultId(null); // manual open → all cards collapsed
              }
              onSectionToggle(e);
            }}
          >
            <summary>Übersetzungen ({results.length})</summary>
            <ResultsList
              results={results}
              pageKey={currentKey}
              activeId={activeResultId}
              onToggleCard={(id) => setActiveResultId((cur) => (cur === id ? null : id))}
            />
          </details>

          <details class="ll-section" name="ll-acc" onToggle={onSectionToggle}>
            <summary>Vokabeln ({vocab.length})</summary>
            <div class="ll-vocab-collect">
              <button
                type="button"
                class="ll-collect-btn"
                disabled={collectBusy}
                title="Sammelt einen Niveau-Mix passender Wörter von dieser Seite (ohne KI)."
                onClick={() => void collectFromPage()}
              >
                {collectBusy ? 'sammle…' : '＋ Wörter von Seite'}
              </button>
              {collectMsg && <span class="ll-collect-msg">{collectMsg}</span>}
            </div>
            <VocabList entries={vocab} onWordClick={explainVocab} />
          </details>

          <details class="ll-section" name="ll-acc" onToggle={onSectionToggle}>
            <summary>🔖 Sites ({bookmarks.length})</summary>
            <SitesList bookmarks={bookmarks} />
          </details>
        </>
      )}
    </main>
  );
}

/** Open an accordion section scrolls it into view (and closes the others via name). */
function onSectionToggle(e: Event) {
  const el = e.currentTarget as HTMLDetailsElement;
  if (el.open) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** Daily-challenge card: today's Wikipedia article + read / done / streak. */
function DailyCard({
  article,
  tag,
  level,
  done,
  streak,
  onOpen,
  onDone,
}: {
  article: { title: string; extract: string; thumbnail?: string };
  tag: DifficultyTag | null;
  level: CefrLevel;
  done: boolean;
  streak: number;
  onOpen: () => void;
  onDone: () => void;
}) {
  const teaser = article.extract.replace(/\s+/g, ' ').trim().slice(0, 130);
  return (
    <section class="ll-daily">
      <div class="ll-daily-top">
        <span class="ll-daily-eyebrow">🎯 Tägliche Challenge</span>
        {streak > 0 && (
          <span class="ll-daily-streak" title="Tage in Folge">
            🔥 {streak}
          </span>
        )}
      </div>
      <div class="ll-daily-body">
        {article.thumbnail && <img class="ll-daily-thumb" src={article.thumbnail} alt="" />}
        <div class="ll-daily-text">
          <h3 class="ll-daily-title">{article.title}</h3>
          {teaser && <p class="ll-daily-teaser">{teaser}…</p>}
          {tag && <span class={`ll-daily-tag t-${tag}`}>{difficultyLabel(tag, level)}</span>}
        </div>
      </div>
      <div class="ll-daily-actions">
        <button type="button" class="ll-daily-read" onClick={onOpen}>
          Lesen →
        </button>
        <button
          type="button"
          class={`ll-daily-done ${done ? 'is-done' : ''}`}
          disabled={done}
          onClick={onDone}
        >
          {done ? '✓ erledigt' : 'erledigt ✓'}
        </button>
      </div>
    </section>
  );
}

/** Compact progress strip on the home view. */
function StatsCard({ stats }: { stats: LearnStats }) {
  const acc =
    stats.review.answered > 0 ? `${Math.round(stats.review.accuracy * 100)}%` : '–';
  return (
    <section class="ll-stats">
      <div class="ll-stat">
        <span class="ll-stat-num">{stats.vocab.week}</span>
        <span class="ll-stat-lbl">Vokabeln 7 T.</span>
      </div>
      <div class="ll-stat">
        <span class="ll-stat-num">{stats.vocab.month}</span>
        <span class="ll-stat-lbl">30 T.</span>
      </div>
      <div class="ll-stat">
        <span class="ll-stat-num">{stats.vocab.all}</span>
        <span class="ll-stat-lbl">gesamt</span>
      </div>
      <div class="ll-stat" title={`${stats.review.correct}/${stats.review.answered} richtig`}>
        <span class="ll-stat-num">{acc}</span>
        <span class="ll-stat-lbl">Übungsquote</span>
      </div>
    </section>
  );
}

function SitesList({ bookmarks }: { bookmarks: Bookmark[] }) {
  if (bookmarks.length === 0) {
    return (
      <p class="ll-vocab-empty">
        Noch keine Seiten gemerkt. Klicke oben auf den ☆-Stern, um die aktuelle Seite zu merken.
      </p>
    );
  }
  return (
    <ul class="ll-site-list">
      {bookmarks.map((b) => (
        <li key={b.url} class="ll-site-card" style={{ borderLeftColor: b.color || 'var(--ll-accent)' }}>
          <button type="button" class="ll-site-open" onClick={() => void browser.tabs.create({ url: b.url })}>
            {b.favIconUrl ? (
              <img class="ll-site-favicon" src={b.favIconUrl} alt="" />
            ) : (
              <span class="ll-site-dot" style={{ background: b.color || 'var(--ll-accent)' }} />
            )}
            <span class="ll-site-text">
              <span class="ll-site-title">{b.title}</span>
              <span class="ll-site-url">{domainOf(b.url)}</span>
            </span>
          </button>
          <button
            type="button"
            class="ll-close"
            title="entfernen"
            onClick={() => void removeBookmark(b.url)}
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}

function shuffle<T>(items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function Quiz({ state, onExit }: { state: QuizState; onExit: () => void }) {
  const { title, questions, onAnswer } = state;
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const q = questions[index];
  if (!q) return null;

  function choose(option: string) {
    if (selected) return;
    setSelected(option);
    const correct = option === q!.answer;
    if (correct) setScore((s) => s + 1);
    onAnswer?.(index, correct);
  }

  function next() {
    if (index + 1 >= questions.length) setDone(true);
    else {
      setIndex(index + 1);
      setSelected(null);
    }
  }

  if (done) {
    return (
      <section class="ll-review ll-review-done">
        <h2>Fertig!</h2>
        <p class="ll-score">
          {score} / {questions.length} richtig
        </p>
        <button type="button" onClick={onExit}>
          Zurück
        </button>
      </section>
    );
  }

  return (
    <section class="ll-review">
      <FullHeader
        title={title}
        extra={
          <span class="ll-review-progress">
            {index + 1} / {questions.length}
          </span>
        }
        onExit={onExit}
      />

      <p class="ll-review-word">{q.prompt}</p>

      <div class="ll-review-options">
        {q.options.map((opt) => (
          <button
            key={opt}
            type="button"
            class={`ll-option ${optionClass(opt, q.answer, selected)}`}
            disabled={selected !== null}
            onClick={() => choose(opt)}
          >
            {opt}
          </button>
        ))}
      </div>

      {selected && (
        <button type="button" class="ll-review-next" onClick={next}>
          {index + 1 >= questions.length ? 'Auswerten' : 'Weiter'}
        </button>
      )}
    </section>
  );
}

function interleave<T>(a: T[], b: T[]): T[] {
  const out: T[] = [];
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i]) out.push(a[i]!);
    if (b[i]) out.push(b[i]!);
  }
  return out;
}

function ReviewChooser({
  current,
  onPick,
  onCancel,
}: {
  current: Settings['reviewMode'];
  onPick: (mode: Settings['reviewMode']) => void;
  onCancel: () => void;
}) {
  const modes: { value: Settings['reviewMode']; label: string; hint: string }[] = [
    { value: 'words', label: 'Wörter', hint: 'Wort → Übersetzung' },
    { value: 'sentences', label: 'Sätze', hint: 'Lückentext von der Seite' },
    { value: 'mix', label: 'Mix', hint: 'Wörter + Sätze' },
  ];
  return (
    <section class="ll-chooser">
      <FullHeader title="Üben" onExit={onCancel} />
      {modes.map((m) => (
        <button
          key={m.value}
          type="button"
          class={`ll-chooser-btn ${current === m.value ? 'sel' : ''}`}
          onClick={() => onPick(m.value)}
        >
          <span class="ll-chooser-label">{m.label}</span>
          <span class="ll-chooser-hint">{m.hint}</span>
        </button>
      ))}
    </section>
  );
}

/** Visual state of an option once the user has answered. */
function optionClass(option: string, answer: string, selected: string | null): string {
  if (!selected) return '';
  if (option === answer) return 'correct';
  if (option === selected) return 'wrong';
  return 'dim';
}

function VocabList({
  entries,
  onWordClick,
}: {
  entries: VocabEntry[];
  onWordClick: (word: string, context?: string) => void;
}) {
  if (entries.length === 0) {
    return (
      <p class="ll-vocab-empty">
        Noch keine Vokabeln. Nutze <b>★ merken</b> auf der Hover-Karte oder Rechtsklick →
        „Wort erklären".
      </p>
    );
  }
  return (
    <div class="ll-vocab">
      <button type="button" class="ll-clearall" onClick={() => void clearVocab()}>
        alle löschen ({entries.length})
      </button>
      <ul class="ll-vocab-list">
        {entries.map((e) => (
          <li key={e.id} class="ll-vocab-item">
            <span
              class={e.band ? 'll-vocab-band' : 'll-vocab-band-empty'}
              data-band={e.band?.[0] ?? ''}
            >
              {e.band ?? ''}
            </span>
            <span class="ll-vocab-main">
              <button
                type="button"
                class="ll-vocab-word"
                title="Mehr Infos & Beispiele (KI)"
                onClick={() => onWordClick(e.text, e.context)}
              >
                {e.text}
              </button>
              {e.translation && <span class="ll-vocab-trans">— {e.translation}</span>}
            </span>
            <button
              type="button"
              class="ll-close"
              title="entfernen"
              onClick={() => void removeVocab(e.id)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Full-view title bar: colour-marked, double-click anywhere closes. */
function FullHeader({
  title,
  extra,
  onExit,
}: {
  title: string;
  extra?: ComponentChildren;
  onExit: () => void;
}) {
  return (
    <div class="ll-fullhead" onDblClick={onExit} title="Doppelklick zum Schließen">
      <span class="ll-fullhead-title">{title}</span>
      {extra}
      <button type="button" class="ll-close" title="schließen" onClick={onExit}>
        ×
      </button>
    </div>
  );
}

function ResultsList({
  results,
  pageKey: key,
  activeId,
  onToggleCard,
}: {
  results: PanelResult[];
  pageKey: string;
  activeId: string | null;
  onToggleCard: (id: string) => void;
}) {
  if (results.length === 0) {
    return (
      <p class="ll-vocab-empty">
        Noch keine Übersetzungen. Markiere Text → Rechtsklick → <b>Sidelearn: übersetzen</b>, fahre
        über ein <span class="ll-hint-mark">unterstrichenes</span> Wort, oder klick eine Vokabel an.
      </p>
    );
  }
  return (
    <div class="ll-results-body">
      <button type="button" class="ll-clearall" onClick={() => void clearResults(key)}>
        alle löschen
      </button>
      {results.map((r) => (
        <ResultCard
          key={r.id}
          result={r}
          collapsed={r.id !== activeId}
          onToggle={() => onToggleCard(r.id)}
          onRemove={() => void removeResult(key, r.id)}
        />
      ))}
    </div>
  );
}

function ResultCard({
  result,
  collapsed,
  onToggle,
  onRemove,
}: {
  result: PanelResult;
  collapsed: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  return (
    <article class={`ll-result ${collapsed ? 'collapsed' : ''}`}>
      <div class="ll-result-head">
        <button
          type="button"
          class="ll-result-toggle"
          onClick={onToggle}
          title={collapsed ? 'aufklappen' : 'zuklappen'}
        >
          <span class="ll-caret">{collapsed ? '▸' : '▾'}</span>
          <h2>{result.title}</h2>
        </button>
        <button type="button" class="ll-close" title="Karte löschen" onClick={onRemove}>
          ×
        </button>
      </div>

      {collapsed ? null : <ResultBody result={result} />}
    </article>
  );
}

/** Animated three-dot spinner. */
function Dots() {
  return (
    <span class="ll-dots" aria-label="lädt">
      <span />
      <span />
      <span />
    </span>
  );
}

function ResultBody({ result }: { result: PanelResult }) {
  return (
    <>
      {result.status === 'loading' && (
        <p class="ll-muted">
          {result.kind === 'translation' ? 'übersetze' : 'erkläre'} <Dots />
        </p>
      )}
      {result.status === 'error' && <p class="ll-error">Fehler: {result.error}</p>}

      {result.status === 'done' && result.kind === 'translation' && (
        <>
          {result.source && <p class="ll-source">{result.source}</p>}
          <p class="ll-translation">{result.translation}</p>
        </>
      )}

      {result.status === 'done' && result.kind === 'explanation' && result.explanation && (
        <Explanation e={result.explanation} />
      )}
    </>
  );
}

function Explanation({ e }: { e: NonNullable<PanelResult['explanation']> }) {
  return (
    <div class="ll-explanation">
      <p class="ll-meaning">{e.meaning}</p>
      {e.examples.length > 0 && (
        <ul class="ll-examples">
          {e.examples.map((ex) => (
            <li>{ex}</li>
          ))}
        </ul>
      )}
      {e.synonyms.length > 0 && (
        <p class="ll-synonyms">
          <span class="ll-label">Synonyme:</span> {e.synonyms.join(', ')}
        </p>
      )}
      {e.grammarNote && (
        <p class="ll-grammar">
          <span class="ll-label">Grammatik:</span> {e.grammarNote}
        </p>
      )}
    </div>
  );
}

interface ChatMsg extends ChatTurn {
  translation?: string;
  translating?: boolean;
}

const YOU_LABEL: Record<Language, string> = { de: 'Du', en: 'You', fr: 'Tu', nl: 'Jij', es: 'Tú' };
const modelShort = (model: string) => model.split('/').pop() ?? model;

function Chat({
  pageKey: key,
  learn,
  native,
  level,
  model,
  online,
  onExit,
}: {
  pageKey: string;
  learn: Language;
  native: Language;
  level: CefrLevel;
  model: string;
  online: boolean;
  onExit: () => void;
}) {
  const [pageText, setPageText] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Load this page's saved conversation on open.
  useEffect(() => {
    void getChat(key).then((m) => {
      setMessages(m);
      setLoaded(true);
    });
  }, [key]);

  // Persist after each completed turn (not on every streaming token).
  useEffect(() => {
    if (loaded && !busy) {
      void setChat(
        key,
        messages.map((m) => ({ role: m.role, content: m.content, translation: m.translation })),
      );
    }
  }, [messages, busy, loaded, key]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send() {
    const q = input.trim();
    if (!q || busy) return;
    setInput('');
    setBusy(true);
    const history: ChatTurn[] = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages([...messages, { role: 'user', content: q }, { role: 'assistant', content: '' }]);
    try {
      let ctx = pageText;
      if (ctx === null) {
        ctx = await getPageText();
        setPageText(ctx);
      }
      await askAboutPage(ctx, history, q, learn, native, level, model, (delta) => {
        setMessages((cur) => {
          const copy = cur.slice();
          const last = copy.length - 1;
          copy[last] = { ...copy[last]!, content: copy[last]!.content + delta };
          return copy;
        });
      });
    } catch (err) {
      setMessages((cur) => {
        const copy = cur.slice();
        copy[copy.length - 1] = { role: 'assistant', content: `Fehler: ${String(err)}` };
        return copy;
      });
    } finally {
      setBusy(false);
    }
  }

  async function translateTurn(i: number) {
    const target = messages[i];
    if (!target || target.translating || target.translation) return;
    setMessages((cur) => cur.map((m, idx) => (idx === i ? { ...m, translating: true } : m)));
    try {
      const r = await translateParagraph(target.content, learn, native, model);
      setMessages((cur) =>
        cur.map((m, idx) => (idx === i ? { ...m, translation: r.translation, translating: false } : m)),
      );
    } catch {
      setMessages((cur) => cur.map((m, idx) => (idx === i ? { ...m, translating: false } : m)));
    }
  }

  return (
    <div class="ll-chat">
      <FullHeader title="Chat zur Seite" onExit={onExit} />
      <div class="ll-chat-messages" ref={listRef}>
        {messages.length === 0 && (
          <p class="ll-chat-hint">
            Frag etwas zur Seite — z.B. „Worum geht es hier?" Antwort kommt auf {LANG_LABELS[learn]}{' '}
            (Niveau {level}).
          </p>
        )}
        {messages.map((m, i) => {
          const streaming = busy && i === messages.length - 1;
          return (
            <div key={i} class={`ll-bubble-wrap ll-bubble-wrap-${m.role}`}>
              <span class="ll-bubble-label">
                {m.role === 'user' ? YOU_LABEL[native] : modelShort(model)}
              </span>
              {m.role === 'assistant' && !streaming ? (
                <div
                  class="ll-bubble ll-bubble-assistant ll-md"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }}
                />
              ) : (
                <div class={`ll-bubble ll-bubble-${m.role}`}>
                  {m.content || (streaming ? <Dots /> : '')}
                </div>
              )}
              {m.role === 'assistant' && m.content && !streaming && !m.translation && (
                <button
                  type="button"
                  class="ll-translate-badge"
                  disabled={m.translating}
                  onClick={() => void translateTurn(i)}
                >
                  {m.translating ? '…' : `↦ auf ${LANG_LABELS[native]}`}
                </button>
              )}
              {m.translation && (
                <div
                  class="ll-bubble ll-bubble-translation ll-md"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(m.translation) }}
                />
              )}
            </div>
          );
        })}
      </div>
      <div class="ll-chat-input">
        <textarea
          rows={5}
          placeholder={online ? 'Frage zur Seite…' : 'LM Studio offline'}
          value={input}
          disabled={!online}
          onInput={(e) => setInput(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button type="button" class="ll-send" onClick={() => void send()} disabled={!online || busy}>
          Senden
        </button>
      </div>
    </div>
  );
}

function Onboarding({
  initial,
  onDone,
}: {
  initial: Settings;
  onDone: (p: Partial<Settings>) => void;
}) {
  const [native, setNative] = useState<Language>(initial.nativeLang);
  const [learn, setLearn] = useState<Language>(
    initial.learnLang === initial.nativeLang ? otherThan(initial.nativeLang) : initial.learnLang,
  );
  const [level, setLevel] = useState<CefrLevel>(initial.level);

  function pickNative(value: Language) {
    setNative(value);
    if (value === learn) setLearn(otherThan(value));
  }

  return (
    <main class="ll-panel ll-onboarding">
      <h1>Willkommen bei Sidelearn</h1>
      <p class="ll-intro">
        Lies Webseiten in deiner Lernsprache — schwere Wörter werden markiert und
        lokal erklärt. Stell kurz dein Profil ein:
      </p>

      <label>
        Meine Muttersprache
        <select value={native} onChange={(e) => pickNative(e.currentTarget.value as Language)}>
          {LANGUAGES.map((l) => (
            <option value={l}>{LANG_LABELS[l]}</option>
          ))}
        </select>
      </label>

      <label>
        Ich lerne
        <select value={learn} onChange={(e) => setLearn(e.currentTarget.value as Language)}>
          {LANGUAGES.filter((l) => l !== native).map((l) => (
            <option value={l}>{LANG_LABELS[l]}</option>
          ))}
        </select>
      </label>

      <label>
        Mein Niveau
        <select value={level} onChange={(e) => setLevel(e.currentTarget.value as CefrLevel)}>
          {CEFR_LEVELS.map((l) => (
            <option value={l}>{l}</option>
          ))}
        </select>
      </label>

      <button
        type="button"
        onClick={() => onDone({ nativeLang: native, learnLang: learn, level, onboarded: true })}
      >
        Los geht’s
      </button>
    </main>
  );
}

function LanguagePicker({
  native,
  learn,
  onChange,
}: {
  native: Language;
  learn: Language;
  onChange: (p: Partial<Settings>) => void;
}) {
  function pickNative(value: Language) {
    onChange(
      value === learn ? { nativeLang: value, learnLang: otherThan(value) } : { nativeLang: value },
    );
  }
  return (
    <>
      <label>
        Muttersprache
        <select value={native} onChange={(e) => pickNative(e.currentTarget.value as Language)}>
          {LANGUAGES.map((l) => (
            <option value={l}>{LANG_LABELS[l]}</option>
          ))}
        </select>
      </label>
      <label>
        Ich lerne
        <select
          value={learn}
          onChange={(e) => onChange({ learnLang: e.currentTarget.value as Language })}
        >
          {LANGUAGES.filter((l) => l !== native).map((l) => (
            <option value={l}>{LANG_LABELS[l]}</option>
          ))}
        </select>
      </label>
    </>
  );
}

interface QuizState {
  title: string;
  questions: QuizQuestion[];
  onAnswer?: (index: number, correct: boolean) => void;
}

/** Extract the active page's main readable text (capped) for translate/quiz. */
async function getPageText(): Promise<string> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return '';
  try {
    const [res] = await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const el = document.querySelector('article, main') ?? document.body;
        return (el as HTMLElement).innerText.replace(/\n{3,}/g, '\n\n').trim().slice(0, 8000);
      },
    });
    return (res?.result as string) ?? '';
  } catch {
    return '';
  }
}

/** First language that isn't `lang` — keeps native ≠ learn. */
function otherThan(lang: Language): Language {
  return LANGUAGES.find((l) => l !== lang)!;
}

/** Option label: id + loaded/context hints + "untested" flag. */
function modelLabel(m: ModelInfo): string {
  const tags: string[] = [];
  if (m.state === 'loaded') {
    const ctx = m.loadedContextLength ?? m.maxContextLength;
    tags.push(`● geladen, ${Math.round(ctx / 1024)}k ctx`);
  }
  if (!m.approved) tags.push('ungetestet');
  return tags.length ? `${m.id} (${tags.join(', ')})` : m.id;
}
