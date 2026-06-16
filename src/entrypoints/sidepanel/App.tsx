import { useEffect, useState } from 'preact/hooks';
import { CEFR_LEVELS, type CefrLevel } from '@/core/difficulty/banding';
import { LANG_PAIRS, type Settings } from '@/core/config';
import { getSettings, setSettings } from '@/core/settings';
import { isReachable } from '@/core/llm/lmstudio';
import { sendMessage } from '@/core/messaging';

/**
 * Side panel — the stable backbone.
 *
 * MVP scope: settings (language / level / inline toggle), LM Studio status,
 * and a paragraph translator (Stage 4) to exercise the LLM path end-to-end.
 * The Readability-based reader view lands next (see opentasks.md).
 */
export function App() {
  const [settings, setLocal] = useState<Settings | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    void getSettings().then(setLocal);
    void isReachable().then(setOnline);
  }, []);

  if (!settings) return null;

  async function patch(p: Partial<Settings>) {
    setLocal(await setSettings(p));
  }

  return (
    <main class="ll-panel">
      <header class="ll-panel-head">
        <h1>LangLearn</h1>
        <span class={`ll-status ${online ? 'on' : 'off'}`}>
          {online === null ? '…' : online ? 'LM Studio verbunden' : 'LM Studio offline'}
        </span>
      </header>

      <section class="ll-settings">
        <label>
          Sprache
          <select
            value={settings.langPair}
            onChange={(e) => patch({ langPair: e.currentTarget.value as Settings['langPair'] })}
          >
            {LANG_PAIRS.map((p) => (
              <option value={p.source}>{p.label}</option>
            ))}
          </select>
        </label>

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

        <label class="ll-toggle">
          <input
            type="checkbox"
            checked={settings.inlineEnabled}
            onChange={(e) => patch({ inlineEnabled: e.currentTarget.checked })}
          />
          Inline-Markierung auf der Seite
        </label>
      </section>

      <Translator lang={settings.langPair} />
    </main>
  );
}

function Translator({ lang }: { lang: Settings['langPair'] }) {
  const [text, setText] = useState('');
  const [out, setOut] = useState('');
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!text.trim()) return;
    setBusy(true);
    setOut('');
    try {
      const res = await sendMessage({ type: 'translateParagraph', text, lang });
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
