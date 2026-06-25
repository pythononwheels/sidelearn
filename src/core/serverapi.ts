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
  /** Optional "digest" short-read mode (area articles, A2+). */
  digest?: string;
  digestQuestions?: Array<{ q: string; options: string[]; correct: number }>;
}

function base(url: string): string {
  return url.replace(/\/+$/, '');
}

export async function fetchServerDaily(
  serverUrl: string,
  lang: Language,
  level: CefrLevel,
  date?: string,
): Promise<ServerDaily | null> {
  try {
    const q = new URLSearchParams({ lang, level });
    if (date) q.set('date', date);
    const res = await fetch(`${base(serverUrl)}/daily?${q}`, { headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    return (await res.json()) as ServerDaily;
  } catch {
    return null;
  }
}

/** Past days that have content (for the Challenges archive). */
export async function fetchServerArchive(
  serverUrl: string,
  lang: Language,
  limit = 30,
): Promise<string[]> {
  try {
    const res = await fetch(`${base(serverUrl)}/archive?lang=${lang}&limit=${limit}`, {
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return [];
    const d = (await res.json()) as { dates?: string[] };
    return d.dates ?? [];
  } catch {
    return [];
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

/** A random topical article, prepared on demand for `level`. Null on failure
 * (no article found / daily budget reached / prepare error). Slow (LLM). */
export async function fetchSurprise(
  serverUrl: string,
  lang: Language,
  level: CefrLevel,
  area: string,
): Promise<ServerLesson | null> {
  try {
    const q = new URLSearchParams({ lang, level, area });
    const res = await fetch(`${base(serverUrl)}/surprise?${q}`, {
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as ServerLesson;
  } catch {
    return null;
  }
}

export interface AreaArticle { area: string; id: string; title: string; url: string; thumbnail?: string }

/** Already-prepared area-pool articles for (lang, level), optionally for one day.
 * Instant (cached) — for the Challenges "Aus den Rubriken" list. */
export async function fetchAreaList(
  serverUrl: string,
  lang: Language,
  level: CefrLevel,
  opts?: { date?: string; days?: number },
): Promise<AreaArticle[]> {
  try {
    const q = new URLSearchParams({ lang, level });
    if (opts?.date) q.set('date', opts.date);
    if (opts?.days) q.set('days', String(opts.days));
    const res = await fetch(`${base(serverUrl)}/areas/list?${q}`, {
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return [];
    const d = (await res.json()) as { articles?: AreaArticle[] };
    return d.articles ?? [];
  } catch {
    return [];
  }
}

export interface ServerToot {
  id: string;
  lang: Language;
  instance: string;
  url: string;
  author: string;
  author_handle: string;
  content: string;
  media_url?: string;
  tags: string;
  rubrik: string;
  created_at: string;
}

/** Pooled Mastodon toots for the Social-Stream tab (instant, no LLM). `rubriks`
 * filters by topic; `days` limits age. Returns [] on failure (fail-soft). */
export async function fetchStream(
  serverUrl: string,
  lang: Language,
  opts?: { rubriks?: string[]; days?: number; limit?: number },
): Promise<ServerToot[]> {
  try {
    const q = new URLSearchParams({ lang });
    if (opts?.rubriks?.length) q.set('tags', opts.rubriks.join(','));
    if (opts?.days) q.set('days', String(opts.days));
    if (opts?.limit) q.set('limit', String(opts.limit));
    const res = await fetch(`${base(serverUrl)}/stream?${q}`, {
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return [];
    const d = (await res.json()) as { toots?: ServerToot[] };
    return d.toots ?? [];
  } catch {
    return [];
  }
}

/** Translate a whole sentence/question into the native language. Null on failure. */
export async function fetchSentenceTranslation(
  serverUrl: string,
  lang: Language,
  native: Language,
  text: string,
): Promise<string | null> {
  try {
    const q = new URLSearchParams({ lang, native, text });
    const res = await fetch(`${base(serverUrl)}/sentence?${q}`, {
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    const d = (await res.json()) as { translation?: string };
    return d.translation || null;
  } catch {
    return null;
  }
}

export interface ServerDigest {
  digest: string;
  digestQuestions: Array<{ q: string; options: string[]; correct: number }>;
}

/** Digest for an area article, generated lazily server-side on first request. */
export async function fetchDigest(
  serverUrl: string,
  id: string,
  level: CefrLevel,
): Promise<ServerDigest | null> {
  try {
    const res = await fetch(`${base(serverUrl)}/digest/${encodeURIComponent(id)}?level=${level}`, {
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    const d = (await res.json()) as Partial<ServerDigest>;
    return { digest: d.digest || '', digestQuestions: d.digestQuestions || [] };
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
