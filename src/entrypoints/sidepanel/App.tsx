import { useEffect, useState } from 'preact/hooks';
import { CEFR_LEVELS, type CefrLevel } from '@/core/difficulty/banding';
import { LANG_LABELS, LANGUAGES, type Language, type Settings } from '@/core/config';
import { getSettings, setSettings } from '@/core/settings';
import { isReachable } from '@/core/llm/lmstudio';
import { listModels, type ModelInfo } from '@/core/llm/models';
import { sendMessage } from '@/core/messaging';

/**
 * Side panel — the stable backbone.
 *
 * First run shows onboarding (native language, learning language, level).
 * Afterwards: settings, LM Studio status + model picker, and a paragraph
 * translator (Stage 4). The Readability reader view lands next (opentasks.md).
 */
export function App() {
  const [settings, setLocal] = useState<Settings | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);

  useEffect(() => {
    void getSettings().then(setLocal);
    void isReachable().then(setOnline);
    void listModels().then(setModels);
  }, []);

  if (!settings) return null;

  async function patch(p: Partial<Settings>) {
    setLocal(await setSettings(p));
  }

  if (!settings.onboarded) return <Onboarding initial={settings} onDone={patch} />;

  return (
    <main class="ll-panel">
      <header class="ll-panel-head">
        <h1>LangLearn</h1>
        <span class={`ll-status ${online ? 'on' : 'off'}`}>
          {online === null ? '…' : online ? 'LM Studio verbunden' : 'LM Studio offline'}
        </span>
      </header>

      <section class="ll-settings">
        <LanguagePicker
          native={settings.nativeLang}
          learn={settings.learnLang}
          onChange={patch}
        />

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
            checked={settings.inlineEnabled}
            onChange={(e) => patch({ inlineEnabled: e.currentTarget.checked })}
          />
          Inline-Markierung auf der Seite
        </label>
      </section>

      <Translator learn={settings.learnLang} native={settings.nativeLang} />
    </main>
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

      <button type="button" onClick={() => onDone({ nativeLang: native, learnLang: learn, level, onboarded: true })}>
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
    onChange(value === learn ? { nativeLang: value, learnLang: otherThan(value) } : { nativeLang: value });
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

/** First language that isn't `lang` — used to keep native ≠ learn. */
function otherThan(lang: Language): Language {
  return LANGUAGES.find((l) => l !== lang)!;
}

/** Human-readable option label: id + loaded/context hints + "untested" flag. */
function modelLabel(m: ModelInfo): string {
  const tags: string[] = [];
  if (m.state === 'loaded') {
    const ctx = m.loadedContextLength ?? m.maxContextLength;
    tags.push(`● geladen, ${Math.round(ctx / 1024)}k ctx`);
  }
  if (!m.approved) tags.push('ungetestet');
  return tags.length ? `${m.id} (${tags.join(', ')})` : m.id;
}

function Translator({ learn, native }: { learn: Language; native: Language }) {
  const [text, setText] = useState('');
  const [out, setOut] = useState('');
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!text.trim()) return;
    setBusy(true);
    setOut('');
    try {
      const res = await sendMessage({ type: 'translateParagraph', text, learn, native });
      setOut(res.translation);
    } catch (err) {
      setOut(`Fehler: ${String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section class="ll-translator">
      <h2>Absatz übersetzen</h2>
      <textarea
        rows={4}
        placeholder="Text einfügen oder auf der Seite markieren…"
        value={text}
        onInput={(e) => setText(e.currentTarget.value)}
      />
      <button type="button" onClick={run} disabled={busy}>
        {busy ? 'übersetze…' : 'übersetzen'}
      </button>
      {out && <p class="ll-translation">{out}</p>}
    </section>
  );
}
