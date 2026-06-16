/**
 * Prompt builders for the two on-demand LLM tasks (Stages 3 & 4).
 *
 * Output language is German (the learner's native language). We ask for JSON
 * for the word explanation so the panel can render structured fields.
 */

import { LANG_NAMES_EN, LM_STUDIO, type Language } from '../config';
import type { ParagraphTranslation, WordExplanation } from '../types';
import { chat } from './lmstudio';
import { splitForBudget } from './tokens';

export async function explainWord(
  word: string,
  learn: Language,
  native: Language,
  model: string,
  context?: string,
  signal?: AbortSignal,
): Promise<WordExplanation> {
  const learnName = LANG_NAMES_EN[learn];
  const nativeName = LANG_NAMES_EN[native];
  // When we know the sentence the word appeared in, explain the word *as used
  // there* — otherwise an isolated participle/inflection gets a wrong meaning.
  const inContext = context
    ? ` as used in this sentence: "${context}". Give the meaning that fits this context.`
    : '.';
  const raw = await chat(
    [
      {
        role: 'system',
        content:
          `You help a ${nativeName} speaker learn ${learnName}. Answer ONLY with minified JSON, ` +
          'no markdown, matching: {"meaning":string,"examples":string[],"synonyms":string[],"grammarNote":string}. ' +
          `All explanatory text (meaning, grammarNote) must be in ${nativeName}. Keep examples in ${learnName}.`,
      },
      {
        role: 'user',
        content: `Explain the ${learnName} word "${word}"${inContext} Give a concise ${nativeName} meaning, 2 short example sentences in ${learnName}, up to 3 synonyms, and a one-line grammar note.`,
      },
    ],
    { model, signal },
  );

  const parsed = safeParse(raw);
  return {
    word,
    meaning: parsed.meaning ?? raw,
    examples: parsed.examples ?? [],
    synonyms: parsed.synonyms ?? [],
    grammarNote: parsed.grammarNote,
  };
}

export async function translateParagraph(
  text: string,
  learn: Language,
  native: Language,
  model: string,
  signal?: AbortSignal,
): Promise<ParagraphTranslation> {
  const learnName = LANG_NAMES_EN[learn];
  const nativeName = LANG_NAMES_EN[native];
  // Stay within the input budget: oversized selections are translated chunk by
  // chunk and re-joined, so latency/RAM per call stay bounded.
  const chunks = splitForBudget(text, LM_STUDIO.maxInputTokens);
  const parts: string[] = [];
  for (const chunk of chunks) {
    parts.push(
      await chat(
        [
          {
            role: 'system',
            content: `Translate the user's ${learnName} text into natural ${nativeName}. Reply with the translation only — no preamble.`,
          },
          { role: 'user', content: chunk },
        ],
        { model, signal, maxTokens: 1024 },
      ),
    );
  }
  return { source: text, translation: parts.join('\n\n') };
}

interface RawExplanation {
  meaning?: string;
  examples?: string[];
  synonyms?: string[];
  grammarNote?: string;
}

/** Tolerant JSON extraction — local models sometimes wrap output in prose/fences. */
function safeParse(raw: string): RawExplanation {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try {
    return JSON.parse(match[0]) as RawExplanation;
  } catch {
    return {};
  }
}
