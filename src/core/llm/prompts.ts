/**
 * Prompt builders for the two on-demand LLM tasks (Stages 3 & 4).
 *
 * Output language is German (the learner's native language). We ask for JSON
 * for the word explanation so the panel can render structured fields.
 */

import { LM_STUDIO, type LangPair } from '../config';
import type { ParagraphTranslation, WordExplanation } from '../types';
import { chat } from './lmstudio';
import { splitForBudget } from './tokens';

const LANG_NAME: Record<LangPair['source'], string> = {
  fr: 'French',
  nl: 'Dutch',
};

export async function explainWord(
  word: string,
  lang: LangPair['source'],
  model: string,
  signal?: AbortSignal,
): Promise<WordExplanation> {
  const raw = await chat(
    [
      {
        role: 'system',
        content:
          'You help a German speaker learn a foreign language. Answer ONLY with minified JSON, ' +
          'no markdown, matching: {"meaning":string,"examples":string[],"synonyms":string[],"grammarNote":string}. ' +
          'All explanatory text (meaning, grammarNote) must be in German. Keep examples in the source language.',
      },
      {
        role: 'user',
        content: `Explain the ${LANG_NAME[lang]} word "${word}". Give a concise German meaning, 2 short example sentences in ${LANG_NAME[lang]}, up to 3 synonyms, and a one-line grammar note.`,
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
  lang: LangPair['source'],
  model: string,
  signal?: AbortSignal,
): Promise<ParagraphTranslation> {
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
            content: `Translate the user's ${LANG_NAME[lang]} text into natural German. Reply with the translation only — no preamble.`,
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
