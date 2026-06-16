/**
 * Service worker — the only context that talks to LM Studio.
 *
 * Responsibilities:
 *  - open the side panel when the toolbar icon is clicked
 *  - handle the two on-demand LLM messages (explainWord, translateParagraph)
 *
 * Instant, LLM-free lookups (frequency band + dictionary) happen in the
 * content script / panel directly — they never need to round-trip here.
 */

import type { Message, MessageResponses } from '@/core/messaging';
import { explainWord, translateParagraph } from '@/core/llm/prompts';

// chrome.sidePanel is Chrome-only and not in the cross-browser `browser` types.
declare const chrome: { sidePanel?: { setPanelBehavior(o: { openPanelOnActionClick: boolean }): Promise<void> } };

export default defineBackground(() => {
  // Clicking the toolbar icon opens the side panel for the active tab.
  chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
    // Firefox / older Chrome: action default popup handles it instead.
  });

  browser.runtime.onMessage.addListener((msg: unknown, _sender, sendResponse) => {
    handle(msg as Message).then(sendResponse).catch((err) => sendResponse({ error: String(err) }));
    return true; // keep the channel open for the async response
  });
});

async function handle<T extends Message>(msg: T): Promise<MessageResponses[T['type']]> {
  switch (msg.type) {
    case 'explainWord':
      return explainWord(msg.word, msg.lang) as Promise<MessageResponses[T['type']]>;
    case 'translateParagraph':
      return translateParagraph(msg.text, msg.lang) as Promise<MessageResponses[T['type']]>;
  }
}
