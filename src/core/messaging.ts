/**
 * Typed message contract between content script, background and side panel.
 *
 * All cross-context calls go through `sendMessage` so the payload/response types
 * stay in one place instead of being re-declared at every call site.
 */

import type { Language } from './config';
import type { ParagraphTranslation, WordExplanation } from './types';

export type Message =
  | { type: 'explainWord'; word: string; learn: Language; native: Language }
  | { type: 'translateParagraph'; text: string; learn: Language; native: Language };

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
