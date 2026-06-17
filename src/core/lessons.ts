/**
 * Lesson store — the "learn-app mode" memory: most-read articles of the day the
 * user has worked through, with their level-adapted paragraphs (and later vocab
 * + quiz results). Separate from the reactive browsing data on purpose; this is
 * the curated learning history.
 */

import { storage } from 'wxt/storage';
import { STORAGE_KEYS, type Language } from './config';

export interface LessonParagraph {
  original: string;
  simplified?: string;
  /** True once the user pressed "Gelesen". */
  read?: boolean;
}

export interface Lesson {
  /** Article URL — stable id within a day/language. */
  url: string;
  lang: Language;
  level: string;
  title: string;
  thumbnail?: string;
  /** Local 'YYYY-MM-DD' the lesson was started. */
  dateKey: string;
  paragraphs: LessonParagraph[];
  /** Index of the furthest paragraph revealed/read. */
  progress: number;
  startedTs: number;
  updatedTs: number;
  /** True once every paragraph has been read. */
  completed?: boolean;
  /** Per-paragraph comprehension quiz tally. */
  quizAnswered?: number;
  quizCorrect?: number;
}

type Lessons = Record<string, Lesson>; // keyed by url

const MAX_LESSONS = 60;

const item = storage.defineItem<Lessons>(STORAGE_KEYS.lessons, { fallback: {} });

export const watchLessons = (cb: (l: Lessons) => void) => item.watch(cb);

export async function getLessons(): Promise<Lessons> {
  return item.getValue();
}

export async function getLesson(url: string): Promise<Lesson | undefined> {
  return (await item.getValue())[url];
}

/** Insert or replace a lesson, capping the store to the most recent ones. */
export async function saveLesson(lesson: Lesson): Promise<void> {
  const all = await item.getValue();
  const next = { ...all, [lesson.url]: lesson };
  await item.setValue(cap(next));
}

function cap(all: Lessons): Lessons {
  const entries = Object.values(all);
  if (entries.length <= MAX_LESSONS) return all;
  entries.sort((a, b) => b.updatedTs - a.updatedTs);
  const keep: Lessons = {};
  for (const l of entries.slice(0, MAX_LESSONS)) keep[l.url] = l;
  return keep;
}
