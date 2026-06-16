/**
 * Service worker — owns LM Studio calls and routes their output to the panel.
 *
 *  - Right-click on a selection → "LangLearn: übersetzen" → open panel + translate
 *  - Messages from the page (hover "more") → explain word
 *
 * Every result is written to the shared panel result (core/result.ts); the side
 * panel renders whatever is there. Calls are fire-and-forget from the caller.
 */

import type { Message } from '@/core/messaging';
import { explainWord, translateParagraph } from '@/core/llm/prompts';
import { getSettings } from '@/core/settings';
import { clearResults, pushResult, updateResult } from '@/core/result';
import { resolveWord } from '@/core/wordinfo';
import { addVocab } from '@/core/vocab';

// chrome.sidePanel is Chrome-only and not in the cross-browser `browser` types.
declare const chrome: {
  sidePanel?: {
    setPanelBehavior(o: { openPanelOnActionClick: boolean }): Promise<void>;
    open(o: { windowId?: number; tabId?: number }): Promise<void>;
  };
};

const MENU_TRANSLATE = 'll-translate';
const MENU_EXPLAIN = 'll-explain';

export default defineBackground(() => {
  chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: MENU_TRANSLATE,
      title: 'Sidelearn: übersetzen',
      contexts: ['selection'],
    });
    browser.contextMenus.create({
      id: MENU_EXPLAIN,
      title: 'Sidelearn: Wort erklären',
      contexts: ['selection'],
    });
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    const text = info.selectionText?.trim();
    if (!text) return;
    // Open the panel within the user gesture before the async work starts.
    if (tab?.windowId != null) chrome.sidePanel?.open({ windowId: tab.windowId }).catch(() => {});
    if (info.menuItemId === MENU_TRANSLATE) void runTranslate(text);
    if (info.menuItemId === MENU_EXPLAIN) void runExplain(firstWord(text));
  });

  browser.runtime.onMessage.addListener((msg: unknown) => {
    const m = msg as Message;
    if (m.type === 'translateToPanel') void runTranslate(m.text);
    if (m.type === 'explainToPanel') void runExplain(m.word);
    if (m.type === 'saveVocab') void captureWord(m.word, m.context);
    return false;
  });
});

async function runTranslate(text: string): Promise<void> {
  const { learnLang, nativeLang, model, keepResults } = await getSettings();
  if (!keepResults) await clearResults();
  const id = newId();
  await pushResult({ id, kind: 'translation', status: 'loading', title: 'Übersetzung', source: text });
  try {
    const r = await translateParagraph(text, learnLang, nativeLang, model);
    await updateResult(id, { status: 'done', translation: r.translation });
  } catch (err) {
    await updateResult(id, { status: 'error', error: String(err) });
  }
}

async function runExplain(word: string): Promise<void> {
  const { learnLang, nativeLang, model, keepResults } = await getSettings();
  if (!keepResults) await clearResults();
  void captureWord(word); // explicit explain = a study moment worth remembering
  const id = newId();
  await pushResult({ id, kind: 'explanation', status: 'loading', title: word });
  try {
    const explanation = await explainWord(word, learnLang, nativeLang, model);
    await updateResult(id, { status: 'done', explanation });
  } catch (err) {
    await updateResult(id, { status: 'error', error: String(err) });
  }
}

/** Record a looked-up word in the local vocabulary store (no LLM needed). */
async function captureWord(word: string, context?: string): Promise<void> {
  const { learnLang, nativeLang, level } = await getSettings();
  const info = await resolveWord(word, learnLang, nativeLang, level);
  const translation = info.senses[0]?.translations.slice(0, 3).join(', ');
  await addVocab({
    id: newId(),
    text: word,
    learn: learnLang,
    native: nativeLang,
    band: info.band,
    translation,
    context,
    ts: Date.now(),
    seen: 1,
    reviews: 0,
  });
}

let counter = 0;
function newId(): string {
  counter += 1;
  return `${Date.now()}-${counter}`;
}

/** A "Wort erklären" selection should explain a single word. */
function firstWord(text: string): string {
  return text.split(/\s+/)[0] ?? text;
}
