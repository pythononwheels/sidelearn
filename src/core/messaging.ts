/**
 * Typed message contract between content script, background and side panel.
 *
 * All cross-context calls go through `sendMessage` so the payload/response types
 * stay in one place instead of being re-declared at every call site.
 */

import type { LangPair } from './config';
import type { ParagraphTranslation, WordExplanation } from './types';

export type Message =
  | { type: 'explainWord'; word: string; lang: LangPair['source'] }
  | { type: 'translateParagraph'; text: string; lang: LangPair['source'] };

export interface MessageResponses {
  explainWord: WordExplanation;
  translateParagraph: ParagraphTranslation;
}

/** Thin typed wrapper over the extension messaging channel. */
export async function sendMessage<T extends Message>(
  message: T,
): Promise<MessageResponses[T['type']]> {
  return browser.runtime.sendMessage(message);
}
