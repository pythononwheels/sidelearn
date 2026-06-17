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
 * Fetch an article's full body as clean plain-text paragraphs (Action API,
 * `prop=extracts&explaintext`). Section headers and stray short lines are
 * dropped — we keep substantial sentences for the lesson reader. Returns [] on
 * failure; the caller can fall back to the summary extract.
 */
export async function fetchArticleParagraphs(lang: Language, title: string): Promise<string[]> {
  const params = new URLSearchParams({
    action: 'query',
    prop: 'extracts',
    explaintext: '1',
    exsectionformat: 'plain',
    redirects: '1',
    format: 'json',
    origin: '*',
    titles: title,
  });
  try {
    const res = await fetch(`https://${lang}.wikipedia.org/w/api.php?${params}`);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      query?: { pages?: Record<string, { extract?: string }> };
    };
    const pages = data.query?.pages ?? {};
    const extract = Object.values(pages)[0]?.extract ?? '';
    return extract
      .split(/\n+/)
      .map((s) => s.trim())
      // keep real paragraphs: long enough and with sentence punctuation
      // (drops headings like "Biographie", "Notes et références").
      .filter((s) => s.length >= 40 && /[.!?…]/.test(s));
  } catch {
    return [];
  }
}

/**
 * Fetch the day's challenge article for `lang`. Returns `null` on any failure
 * (offline, no feed for the date, unexpected shape) — the caller hides the card.
 */
export async function fetchDailyArticle(lang: Language, date: Date): Promise<DailyArticle | null> {
  return (await fetchDailyArticles(lang, date, 1))[0] ?? null;
}

/**
 * Fetch up to `count` distinct articles for the day's challenge set. The
 * featured feed for "today" can 404 early in the day, so we fall back to the
 * previous day's feed (its `mostread` always exists).
 */
export async function fetchDailyArticles(
  lang: Language,
  date: Date,
  count: number,
): Promise<DailyArticle[]> {
  const today = await fetchFeedArticles(lang, date, count);
  if (today.length > 0) return today;
  const yesterday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1);
  return fetchFeedArticles(lang, yesterday, count);
}

async function fetchFeedArticles(
  lang: Language,
  date: Date,
  count: number,
): Promise<DailyArticle[]> {
  const url =
    `https://${lang}.wikipedia.org/api/rest_v1/feed/featured/` +
    `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
  try {
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) {
      console.warn('[sidelearn] daily feed fetch failed', res.status, url);
      return [];
    }
    const data = (await res.json()) as FeaturedFeed;
    const candidates: FeedPage[] = [];
    if (data.tfa) candidates.push(data.tfa);
    if (data.mostread?.articles?.length) candidates.push(...data.mostread.articles);
    const out: DailyArticle[] = [];
    const seen = new Set<string>();
    for (const p of candidates) {
      const a = toArticle(p, lang);
      if (!a || seen.has(a.url)) continue;
      seen.add(a.url);
      out.push(a);
      if (out.length >= count) break;
    }
    return out;
  } catch (err) {
    console.warn('[sidelearn] daily feed fetch error', url, err);
    return [];
  }
}
