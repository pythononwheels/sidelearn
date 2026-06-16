/**
 * Page chat — a multi-turn conversation with the current page's text in context.
 * By default the assistant replies in the learning language at the learner's
 * level; the user can override that in their message. Runs in the panel.
 */

import { LANG_NAMES_EN, type Language } from './config';
import type { CefrLevel } from './difficulty/banding';
import { chat, chatStream, type ChatMessage } from './llm/lmstudio';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

const MAX_CONTEXT_CHARS = 6000;
const MAX_HISTORY = 8;

function buildMessages(
  pageText: string,
  history: ChatTurn[],
  userMessage: string,
  learn: Language,
  native: Language,
  level: CefrLevel,
): ChatMessage[] {
  const learnName = LANG_NAMES_EN[learn];
  const nativeName = LANG_NAMES_EN[native];
  return [
    {
      role: 'system',
      content:
        `You are a language-learning assistant for a ${nativeName} speaker learning ${learnName} ` +
        `at CEFR level ${level}. By default, reply in ${learnName} using vocabulary and grammar ` +
        `around level ${level} (clear and simple). If the user's message explicitly asks for ` +
        `another language or difficulty, follow that. Use the page content below to answer. Be concise.\n\n` +
        `PAGE CONTENT:\n${pageText.slice(0, MAX_CONTEXT_CHARS)}`,
    },
    ...history.slice(-MAX_HISTORY).map((t) => ({ role: t.role, content: t.content })),
    { role: 'user', content: userMessage },
  ];
}

export async function askAboutPage(
  pageText: string,
  history: ChatTurn[],
  userMessage: string,
  learn: Language,
  native: Language,
  level: CefrLevel,
  model: string,
  onToken?: (delta: string) => void,
): Promise<string> {
  const messages = buildMessages(pageText, history, userMessage, learn, native, level);
  if (onToken) return chatStream(messages, { model, maxTokens: 800 }, onToken);
  return chat(messages, { model, maxTokens: 800 });
}
