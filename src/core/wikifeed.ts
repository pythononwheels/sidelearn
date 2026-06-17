/**
 * Wikipedia "featured content" feed — the source for the daily challenge.
 *
 *   GET https://{lang}.wikipedia.org/api/rest_v1/feed/featured/YYYY/MM/DD
 *
 * `tfa` (Artikel des Tages) exists only on de/en; `mostread` (yesterday's most
 * read articles) is available in every language we support, so it's the
 * universal fallback — and arguably more topical. We pick `tfa` when present,
 * otherwise the top `mostread` article.
 *
 * This is the only non-localhost network call in the extension. It hits a
 * public read-only endpoint and sends no user data; gated behind the
 * `dailyChallenge` setting.
 */

import { type Language } from './config';

export interface DailyArticle {
  title: string;
  extract: string;
  url: string;
  thumbnail?: string;
  lang: Language;
}

/** A Wikipedia page-summary object as it appears in tfa / mostread.articles[]. */
interface FeedPage {
  normalizedtitle?: string;
  titles?: { normalized?: string };
  title?: string;
  extract?: string;
  thumbnail?: { source?: string };
  content_urls?: { desktop?: { page?: string }; mobile?: { page?: string } };
}

interface FeaturedFeed {
  tfa?: FeedPage;
  mostread?: { articles?: FeedPage[] };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toArticle(p: FeedPage, lang: Language): DailyArticle | null {
  const title = p.normalizedtitle ?? p.titles?.normalized ?? p.title ?? '';
  const url = p.content_urls?.desktop?.page ?? p.content_urls?.mobile?.page ?? '';
  if (!title || !url) return null;
  return {
    title,
    extract: p.extract ?? '',
    url,
    thumbnail: p.thumbnail?.source,
    lang,
  };
}

/**
 * Fetch the day's challenge article for `lang`. Returns `null` on any failure
 * (offline, no feed for the date, unexpected shape) — the caller hides the card.
 */
export async function fetchDailyArticle(lang: Language, date: Date): Promise<DailyArticle | null> {
  const y = date.getFullYear();
  const url =
    `https://${lang}.wikipedia.org/api/rest_v1/feed/featured/` +
    `${y}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
  try {
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    const data = (await res.json()) as FeaturedFeed;
    const candidates: FeedPage[] = [];
    if (data.tfa) candidates.push(data.tfa);
    if (data.mostread?.articles?.length) candidates.push(...data.mostread.articles);
    for (const p of candidates) {
      const a = toArticle(p, lang);
      if (a) return a;
    }
    return null;
  } catch {
    return null;
  }
}
