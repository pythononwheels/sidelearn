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
    { model, maxTokens: 2000, temperature: 0.4 },
  );
  const quiz = parseQuiz(raw);
  if (quiz.length === 0) {
    // Surface the raw model output so an empty quiz can be diagnosed.
    console.warn('[sidelearn] quiz parse yielded 0 questions; raw model output:\n', raw);
  }
  return quiz;
}

type Rec = Record<string, unknown>;

/**
 * Tolerant parse of the model's JSON into validated quiz questions. Small local
 * models are sloppy, so we forgive: code fences, `<think>` blocks, prose around
 * the JSON, alternative key names, `correct` as a numeric string / letter /
 * option text, options given as objects, and — crucially — truncated output
 * (we salvage each complete question object individually).
 */
export function parseQuiz(raw: string): QuizQuestion[] {
  const cleaned = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```(?:json)?/gi, '');

  // Preferred path: the whole object parses cleanly.
  let items = parseWhole(cleaned);
  // Fallback (handles truncation / trailing junk): scan individual objects.
  if (items.length === 0) items = salvageQuestionObjects(cleaned);

  const out: QuizQuestion[] = [];
  for (const item of items) {
    const q = toQuestion(item);
    if (q) out.push(q);
  }
  return out;
}

/** Parse the first balanced `{...}` and return its `questions` array, if any. */
function parseWhole(s: string): Rec[] {
  const obj = firstBalancedObject(s);
  if (!obj) return [];
  try {
    const data = JSON.parse(obj) as Rec;
    const qs = data.questions ?? data.quiz ?? data.items;
    return Array.isArray(qs) ? (qs as Rec[]) : [];
  } catch {
    return [];
  }
}

/** Recover question objects one by one — survives a cut-off final object. */
function salvageQuestionObjects(s: string): Rec[] {
  // Limit scanning to the questions array body when present.
  const qKey = s.search(/"(?:questions|quiz|items)"\s*:/i);
  const body = qKey >= 0 ? s.slice(s.indexOf('[', qKey) + 1) : s;
  const out: Rec[] = [];
  for (const objStr of scanTopLevelObjects(body)) {
    try {
      const obj = JSON.parse(objStr) as Rec;
      if (obj && typeof obj === 'object') out.push(obj);
    } catch {
      // skip incomplete/garbled object
    }
  }
  return out;
}

/** First complete brace-balanced object substring (string-aware), or null. */
function firstBalancedObject(s: string): string | null {
  const start = s.indexOf('{');
  if (start < 0) return null;
  const end = matchBrace(s, start);
  return end < 0 ? null : s.slice(start, end + 1);
}

/** All complete brace-balanced `{...}` substrings at the outer scan level. */
function scanTopLevelObjects(s: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < s.length) {
    if (s[i] === '{') {
      const end = matchBrace(s, i);
      if (end < 0) break; // truncated tail — stop
      out.push(s.slice(i, end + 1));
      i = end + 1;
    } else {
      i++;
    }
  }
  return out;
}

/** Index of the `}` matching the `{` at `open`, respecting strings; -1 if none. */
function matchBrace(s: string, open: number): number {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return i;
  }
  return -1;
}

const Q_KEYS = ['q', 'question', 'prompt', 'frage', 'text'];
const OPT_KEYS = ['options', 'choices', 'answers', 'optionen', 'choix'];
const CORRECT_KEYS = ['correct', 'answer', 'correctIndex', 'correct_index', 'antwort', 'solution'];

/** Normalize one raw item into a validated question, or null if unusable. */
function toQuestion(item: Rec): QuizQuestion | null {
  const prompt = pickString(item, Q_KEYS);
  const rawOpts = pickArray(item, OPT_KEYS);
  const options = rawOpts.map(optToString).filter((o) => o !== '').slice(0, 4);
  if (!prompt || options.length < 2) return null;

  const idx = resolveIndex(pickValue(item, CORRECT_KEYS), options);
  if (idx < 0 || idx >= options.length) return null;
  return { prompt, options, answer: options[idx]! };
}

function pickValue(item: Rec, keys: string[]): unknown {
  for (const k of keys) if (k in item) return item[k];
  return undefined;
}
function pickString(item: Rec, keys: string[]): string {
  const v = pickValue(item, keys);
  return typeof v === 'string' ? v.trim() : '';
}
function pickArray(item: Rec, keys: string[]): unknown[] {
  const v = pickValue(item, keys);
  return Array.isArray(v) ? v : [];
}

/** An option may be a plain string or an object like {text}/{label}/{value}. */
function optToString(o: unknown): string {
  if (typeof o === 'string') return o.trim();
  if (o && typeof o === 'object') {
    const r = o as Rec;
    for (const k of ['text', 'option', 'label', 'value', 'answer']) {
      if (typeof r[k] === 'string') return (r[k] as string).trim();
    }
  }
  return '';
}

/** Resolve the correct answer to an option index from a number, numeric string,
 *  single letter (A/B/C/D), or the option text itself. */
function resolveIndex(correct: unknown, options: string[]): number {
  if (typeof correct === 'number') return correct;
  if (typeof correct === 'string') {
    const t = correct.trim();
    if (/^\d+$/.test(t)) return Number(t);
    if (/^[a-dA-D]$/.test(t)) return t.toUpperCase().charCodeAt(0) - 65;
    const byText = options.findIndex((o) => o.toLowerCase() === t.toLowerCase());
    if (byText >= 0) return byText;
  }
  return -1;
}
