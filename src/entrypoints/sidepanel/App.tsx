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
import { buildSession, canReview } from '@/core/review';
import { generatePageQuiz, type QuizQuestion } from '@/core/quiz';
import {
  addBookmark,
  getBookmarks,
  removeBookmark,
  watchBookmarks,
  type Bookmark,
} from '@/core/bookmarks';
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
  const [collectBusy, setCollectBusy] = useState(false);
  const [collectMsg, setCollectMsg] = useState<string | null>(null);

  useEffect(() => {
    void getSettings().then(setLocal);
    void isReachable().then(setOnline);
    void listModels().then(setModels);
    void getVocab().then(setVocab);
    void getBookmarks().then(setBookmarks);
    const offVocab = watchVocab(setVocab);
    const offBookmarks = watchBookmarks(setBookmarks);
    // Signal "panel open" to the background; auto-disconnects when it closes.
    // Reconnect if the service worker restarts, so the flag stays accurate.
    let closing = false;
    let port = browser.runtime.connect({ name: 'panel' });
    function reconnect() {
      if (closing) return;
      port = browser.runtime.connect({ name: 'panel' });
      port.onDisconnect.addListener(reconnect);
    }
    port.onDisconnect.addListener(reconnect);

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

    return () => {
      closing = true;
      offVocab();
      offBookmarks();
      offResults();
      port.disconnect();
      browser.tabs.onActivated.removeListener(onActivated);
      browser.tabs.onUpdated.removeListener(onUpdated);
    };
  }, []);

  if (!settings) return null;

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

  function startReview() {
    const session = buildSession(vocab, 10);
    setQuiz({
      title: 'Vokabeln üben',
      questions: session.map((q) => ({ prompt: q.word, options: q.options, answer: q.answer })),
      onAnswer: (i, correct) => void recordReview(session[i]!.entryId, correct),
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
    <main class={`ll-panel ${chatOpen ? 'll-full' : ''}`}>
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

      {!chatOpen && (
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
          title="Wiederhole deine gemerkten Wörter als Multiple-Choice-Quiz (ab 4 Wörtern)."
          onClick={startReview}
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
          {quizLoading ? 'Quiz…' : 'Seiten-Quiz'}
        </button>
        <button
          type="button"
          class="ll-navbtn"
          disabled={!online}
          title={online ? undefined : 'LM Studio offline'}
          onClick={() => setChatOpen(true)}
        >
          Chat
        </button>
      </nav>
      {quizError && <p class="ll-error ll-nav-error">{quizError}</p>}
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
              checked={settings.keepResults}
              onChange={(e) => patch({ keepResults: e.currentTarget.checked })}
            />
            Ergebnisse sammeln (sonst nur das letzte)
          </label>
        </section>
      )}

      {chatOpen ? (
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
          <ResultsView results={results} pageKey={currentKey} />

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
            <VocabList entries={vocab} />
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
      <div class="ll-review-head">
        <span class="ll-review-progress">
          {title} · {index + 1} / {questions.length}
        </span>
        <button type="button" class="ll-close" title="beenden" onClick={onExit}>
          ×
        </button>
      </div>

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

/** Visual state of an option once the user has answered. */
function optionClass(option: string, answer: string, selected: string | null): string {
  if (!selected) return '';
  if (option === answer) return 'correct';
  if (option === selected) return 'wrong';
  return 'dim';
}

function VocabList({ entries }: { entries: VocabEntry[] }) {
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
            <div class="ll-vocab-main">
              <span class="ll-vocab-word">{e.text}</span>
              {e.band && <span class="ll-vocab-band" data-band={e.band[0]}>{e.band}</span>}
              {e.translation && <span class="ll-vocab-trans">— {e.translation}</span>}
            </div>
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

function ResultsView({ results, pageKey: key }: { results: PanelResult[]; pageKey: string }) {
  if (results.length === 0) {
    return (
      <section class="ll-result ll-empty">
        <p>Markiere Text auf der Seite, dann Rechtsklick → <b>Sidelearn: übersetzen</b>.</p>
        <p>Oder fahre über ein <span class="ll-hint-mark">unterstrichenes</span> Wort.</p>
      </section>
    );
  }
  return (
    <section class="ll-results">
      {results.length > 1 && (
        <button type="button" class="ll-clearall" onClick={() => void clearResults(key)}>
          alle löschen ({results.length})
        </button>
      )}
      {results.map((r) => (
        <ResultCard key={r.id} result={r} onRemove={() => void removeResult(key, r.id)} />
      ))}
    </section>
  );
}

function ResultCard({ result, onRemove }: { result: PanelResult; onRemove: () => void }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <article class={`ll-result ${collapsed ? 'collapsed' : ''}`}>
      <div class="ll-result-head">
        <button
          type="button"
          class="ll-result-toggle"
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? 'aufklappen' : 'zuklappen'}
        >
          <span class="ll-caret">{collapsed ? '▸' : '▾'}</span>
          <h2>{result.title}</h2>
        </button>
        <button type="button" class="ll-close" title="Karte löschen" onClick={onRemove}>
          ×
        </button>
      </div>

      {collapsed ? null : (
        <ResultBody result={result} />
      )}
    </article>
  );
}

function ResultBody({ result }: { result: PanelResult }) {
  return (
    <>
      {result.status === 'loading' && (
        <p class="ll-muted">{result.kind === 'translation' ? 'übersetze…' : 'erkläre…'}</p>
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

const YOU_LABEL: Record<Language, string> = { de: 'Du', en: 'You', fr: 'Tu', nl: 'Jij' };
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
      <div class="ll-chatview-head">
        <button type="button" class="ll-chatview-title" title="schließen" onClick={onExit}>
          ▾ Chat zur Seite
        </button>
        <button type="button" class="ll-close" title="schließen" onClick={onExit}>
          ×
        </button>
      </div>
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
                <div class={`ll-bubble ll-bubble-${m.role}`}>{m.content || (streaming ? '…' : '')}</div>
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
