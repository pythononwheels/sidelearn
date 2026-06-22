/**
 * Client for the optional Sidelearn content server (see server/). It serves
 * pre-baked, multi-level lessons (public Wikipedia content only). All calls fail
 * soft (return null) so the panel can fall back to the local pipeline.
 */

import type { CefrLevel } from './difficulty/banding';
import type { Language } from './config';

export interface ServerDailyArticle {
  id: string;
  title: string;
  url: string;
  thumbnail?: string;
  paragraphs: number;
  ready: boolean;
  summary: string;
}

export interface ServerDaily {
  date: string;
  lang: Language;
  level: CefrLevel;
  goal: number;
  articles: ServerDailyArticle[];
}

export interface ServerLessonParagraph {
  original: string;
  simplified: string;
  question?: { q: string; options: string[]; correct: number } | null;
}

export interface ServerLesson {
  id: string;
  lang: Language;
  level: CefrLevel;
  title: string;
  url: string;
  thumbnail?: string;
  paragraphs: ServerLessonParagraph[];
  vocab: Array<{ word: string; hint: string }>;
  summary: string;
}

function base(url: string): string {
  return url.replace(/\/+$/, '');
}

export async function fetchServerDaily(
  serverUrl: string,
  lang: Language,
  level: CefrLevel,
): Promise<ServerDaily | null> {
  try {
    const res = await fetch(`${base(serverUrl)}/daily?lang=${lang}&level=${level}`, {
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as ServerDaily;
  } catch {
    return null;
  }
}

export interface ServerWord {
  word: string;
  translation: string;
  alternatives: string[];
  example: string;
  pos: string;
}

/** Context-aware word translation (word + the sentence it's in). Null on failure. */
export async function fetchWordTranslation(
  serverUrl: string,
  lang: Language,
  native: Language,
  word: string,
  sentence: string,
): Promise<ServerWord | null> {
  try {
    const q = new URLSearchParams({ lang, native, word, sentence });
    const res = await fetch(`${base(serverUrl)}/translate?${q}`, {
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    const d = (await res.json()) as ServerWord;
    return d.translation ? d : null;
  } catch {
    return null;
  }
}

export async function fetchServerLesson(
  serverUrl: string,
  id: string,
  level: CefrLevel,
): Promise<ServerLesson | null> {
  try {
    const res = await fetch(`${base(serverUrl)}/lesson/${encodeURIComponent(id)}?level=${level}`, {
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as ServerLesson;
  } catch {
    return null;
  }
}
