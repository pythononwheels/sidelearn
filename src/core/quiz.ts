/**
 * Page quiz — generate a small multiple-choice comprehension quiz about the
 * current page, at the learner's CEFR level, via the local LLM.
 *
 * The generator runs in the side panel (which may call LM Studio directly).
 * `parseQuiz` is pure so it can be unit-tested without a model.
 */

import { LANG_NAMES_EN, type Language } from './config';
import type { CefrLevel } from './difficulty/banding';
import { chat } from './llm/lmstudio';

export interface QuizQuestion {
  prompt: string;
  options: string[];
  answer: string;
}

export async function generatePageQuiz(
  text: string,
  learn: Language,
  native: Language,
  level: CefrLevel,
  model: string,
): Promise<QuizQuestion[]> {
  const learnName = LANG_NAMES_EN[learn];
  const nativeName = LANG_NAMES_EN[native];
  const raw = await chat(
    [
      {
        role: 'system',
        content:
          `You create a reading-comprehension quiz for a ${nativeName} speaker learning ${learnName} ` +
          `at CEFR level ${level}. Output ONLY minified JSON, no markdown, matching ` +
          '{"questions":[{"q":string,"options":[string,string,string,string],"correct":number}]}. ' +
          `Write q and options in ${learnName}, appropriate for level ${level}. "correct" is the ` +
          '0-based index of the right option. Produce exactly 5 questions about the text content.',
      },
      { role: 'user', content: text },
    ],
    { model, maxTokens: 1200, temperature: 0.4 },
  );
  return parseQuiz(raw);
}

interface RawQuiz {
  questions?: Array<{ q?: unknown; options?: unknown; correct?: unknown }>;
}

/** Tolerant parse of the model's JSON into validated quiz questions. */
export function parseQuiz(raw: string): QuizQuestion[] {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return [];
  let data: RawQuiz;
  try {
    data = JSON.parse(match[0]) as RawQuiz;
  } catch {
    return [];
  }
  const out: QuizQuestion[] = [];
  for (const item of data.questions ?? []) {
    const prompt = typeof item.q === 'string' ? item.q.trim() : '';
    const options = Array.isArray(item.options)
      ? item.options.filter((o): o is string => typeof o === 'string' && o.trim() !== '').slice(0, 4)
      : [];
    const correct = typeof item.correct === 'number' ? item.correct : -1;
    if (prompt && options.length >= 2 && correct >= 0 && correct < options.length) {
      out.push({ prompt, options, answer: options[correct]! });
    }
  }
  return out;
}
