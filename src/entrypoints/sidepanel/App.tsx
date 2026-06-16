import { useEffect, useState } from 'preact/hooks';
import { CEFR_LEVELS, type CefrLevel } from '@/core/difficulty/banding';
import { LANG_LABELS, LANGUAGES, type Language, type Settings } from '@/core/config';
import { getSettings, setSettings } from '@/core/settings';
import { isReachable } from '@/core/llm/lmstudio';
import { listModels, type ModelInfo } from '@/core/llm/models';
import { sendMessage } from '@/core/messaging';
import {
  clearResults,
  getResults,
  removeResult,
  watchResults,
  type PanelResult,
} from '@/core/result';

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

  useEffect(() => {
    void getSettings().then(setLocal);
    void isReachable().then(setOnline);
    void listModels().then(setModels);
    void getResults().then(setResults);
    return watchResults(setResults);
  }, []);

  if (!settings) return null;

  async function patch(p: Partial<Settings>) {
    setLocal(await setSettings(p));
  }

  if (!settings.onboarded) return <Onboarding initial={settings} onDone={patch} />;

  return (
    <main class="ll-panel">
      <header class="ll-panel-head">
        <div class="ll-brand">
          <span class="ll-logo" aria-hidden="true">📖</span>
          <h1>LangLearn</h1>
        </div>
        <div class="ll-head-right">
          <span class={`ll-status ${online ? 'on' : 'off'}`} title="LM Studio">
            {online === null ? '…' : online ? '● LM' : '○ LM'}
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

      <button
        type="button"
        class={`ll-marktoggle ${settings.inlineEnabled ? 'on' : 'off'}`}
        onClick={() => patch({ inlineEnabled: !settings.inlineEnabled })}
      >
        {settings.inlineEnabled ? '◉ Markierung an' : '○ Markierung aus'}
      </button>

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

      <ResultsView results={results} />

      <details class="ll-translator">
        <summary>Freitext übersetzen</summary>
        <ManualTranslate />
      </details>
    </main>
  );
}

function ResultsView({ results }: { results: PanelResult[] }) {
  if (results.length === 0) {
    return (
      <section class="ll-result ll-empty">
        <div class="ll-empty-emoji" aria-hidden="true">✨</div>
        <p>Markiere Text auf der Seite, dann Rechtsklick → <b>LangLearn: übersetzen</b>.</p>
        <p>Oder fahre über ein <span class="ll-hint-mark">unterstrichenes</span> Wort.</p>
      </section>
    );
  }
  return (
    <section class="ll-results">
      {results.length > 1 && (
        <button type="button" class="ll-clearall" onClick={() => void clearResults()}>
          alle löschen ({results.length})
        </button>
      )}
      {results.map((r) => (
        <ResultCard key={r.id} result={r} onRemove={() => void removeResult(r.id)} />
      ))}
    </section>
  );
}

function ResultCard({ result, onRemove }: { result: PanelResult; onRemove: () => void }) {
  return (
    <article class="ll-result">
      <div class="ll-result-head">
        <h2>{result.title}</h2>
        <button type="button" class="ll-close" title="Karte löschen" onClick={onRemove}>
          ×
        </button>
      </div>

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
    </article>
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

function ManualTranslate() {
  const [text, setText] = useState('');
  function run() {
    if (text.trim()) void sendMessage({ type: 'translateToPanel', text });
  }
  return (
    <div class="ll-manual">
      <textarea
        rows={3}
        placeholder="Text einfügen…"
        value={text}
        onInput={(e) => setText(e.currentTarget.value)}
      />
      <button type="button" onClick={run}>
        übersetzen
      </button>
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
      <h1>Willkommen bei LangLearn</h1>
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
