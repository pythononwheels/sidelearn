/**
 * Page chat — a multi-turn conversation with the current page's text in context,
 * so the user can ask about what they're reading. Runs in the panel (direct
 * LM Studio call). Page text and history are capped to stay within the input
 * budget.
 */

import { LANG_NAMES_EN, type Language } from './config';
import { chat, type ChatMessage } from './llm/lmstudio';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

const MAX_CONTEXT_CHARS = 6000;
const MAX_HISTORY = 8;

export async function askAboutPage(
  pageText: string,
  history: ChatTurn[],
  userMessage: string,
  learn: Language,
  native: Language,
  model: string,
): Promise<string> {
  const learnName = LANG_NAMES_EN[learn];
  const nativeName = LANG_NAMES_EN[native];
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        `You are a helpful language-learning assistant. The user is a ${nativeName} speaker ` +
        `reading a ${learnName} web page. Answer their questions using the page content below. ` +
        `Reply in ${nativeName} unless asked otherwise. Be concise.\n\n` +
        `PAGE CONTENT:\n${pageText.slice(0, MAX_CONTEXT_CHARS)}`,
    },
    ...history.slice(-MAX_HISTORY),
    { role: 'user', content: userMessage },
  ];
  return chat(messages, { model, maxTokens: 800 });
}
