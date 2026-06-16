/**
 * Minimal client for LM Studio's OpenAI-compatible chat API.
 *
 * Kept deliberately tiny: one `chat()` primitive that the higher-level
 * prompt builders (explainWord, translateParagraph) sit on top of.
 */

import { LM_STUDIO } from '../config';
import { estimateTokens } from './tokens';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  /** Required: which model to run. Comes from user settings. */
  model: string;
  signal?: AbortSignal;
  maxTokens?: number;
  temperature?: number;
}

export async function chat(messages: ChatMessage[], opts: ChatOptions): Promise<string> {
  const inputTokens = messages.reduce((n, m) => n + estimateTokens(m.content), 0);
  if (inputTokens > LM_STUDIO.maxInputTokens) {
    throw new Error(
      `Input ~${inputTokens} tokens exceeds budget of ${LM_STUDIO.maxInputTokens}. ` +
        'Split the text before calling chat().',
    );
  }

  const res = await fetch(`${LM_STUDIO.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: opts.signal,
    body: JSON.stringify({
      model: opts.model,
      messages,
      max_tokens: opts.maxTokens ?? LM_STUDIO.maxTokens,
      temperature: opts.temperature ?? LM_STUDIO.temperature,
      stream: false,
    }),
  });

  if (!res.ok) {
    throw new Error(`LM Studio request failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('LM Studio returned an empty response');
  return content.trim();
}

/** Lightweight reachability probe for the settings UI. */
export async function isReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${LM_STUDIO.baseUrl}/models`);
    return res.ok;
  } catch {
    return false;
  }
}
