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
import { setResult } from '@/core/result';

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
      title: 'LangLearn: übersetzen',
      contexts: ['selection'],
    });
    browser.contextMenus.create({
      id: MENU_EXPLAIN,
      title: 'LangLearn: Wort erklären',
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
    return false;
  });
});

async function runTranslate(text: string): Promise<void> {
  const { learnLang, nativeLang, model } = await getSettings();
  await setResult({ kind: 'translation', status: 'loading', title: 'Übersetzung', source: text });
  try {
    const r = await translateParagraph(text, learnLang, nativeLang, model);
    await setResult({
      kind: 'translation',
      status: 'done',
      title: 'Übersetzung',
      source: text,
      translation: r.translation,
    });
  } catch (err) {
    await setResult({
      kind: 'translation',
      status: 'error',
      title: 'Übersetzung',
      source: text,
      error: String(err),
    });
  }
}

async function runExplain(word: string): Promise<void> {
  const { learnLang, nativeLang, model } = await getSettings();
  await setResult({ kind: 'explanation', status: 'loading', title: word });
  try {
    const explanation = await explainWord(word, learnLang, nativeLang, model);
    await setResult({ kind: 'explanation', status: 'done', title: word, explanation });
  } catch (err) {
    await setResult({ kind: 'explanation', status: 'error', title: word, error: String(err) });
  }
}

/** A "Wort erklären" selection should explain a single word. */
function firstWord(text: string): string {
  return text.split(/\s+/)[0] ?? text;
}
