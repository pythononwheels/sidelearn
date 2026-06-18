/**
 * Screenshot run for a visual review of every surface (dark + light). Not a
 * pass/fail test — it captures PNGs into tests/e2e/__screens__/ for eyeballing.
 * Storage is seeded (incl. a finished lesson) so nothing needs Wikipedia/LM Studio.
 *
 *   npx playwright test screens
 */

import { test, dateKey, seedStorage } from './fixtures';
import path from 'node:path';

const OUT = path.resolve('tests/e2e/__screens__');

const LESSON_URL = 'https://fr.wikipedia.org/wiki/Testartikel_Eins';
const ARTICLES = [
  {
    title: 'Michael Olise',
    extract: 'Michael Olise est un footballeur français qui joue au Bayern Munich.',
    url: LESSON_URL,
    lang: 'fr',
  },
  {
    title: 'Tour Eiffel',
    extract: 'La tour Eiffel est un monument célèbre situé à Paris, en France.',
    url: 'https://fr.wikipedia.org/wiki/Testartikel_Zwei',
    lang: 'fr',
  },
  {
    title: 'Coupe du monde de football',
    extract: 'La Coupe du monde est une compétition de football très importante.',
    url: 'https://fr.wikipedia.org/wiki/Testartikel_Drei',
    lang: 'fr',
  },
  {
    title: 'Intelligence artificielle',
    extract: "L'intelligence artificielle change beaucoup de choses aujourd'hui.",
    url: 'https://fr.wikipedia.org/wiki/Testartikel_Vier',
    lang: 'fr',
  },
];

const now = Date.now();
const vocab = [
  { id: 'v1', text: 'footballeur', learn: 'fr', native: 'de', band: 'B1', translation: 'Fußballspieler', ts: now - 1 * 86400000, seen: 2, reviews: 3, correct: 2, lastReviewed: now - 86400000 },
  { id: 'v2', text: 'évoluer', learn: 'fr', native: 'de', band: 'B2', translation: 'sich entwickeln', ts: now - 2 * 86400000, seen: 1, reviews: 2, correct: 1, lastReviewed: now - 2 * 86400000 },
  { id: 'v3', text: 'carrière', learn: 'fr', native: 'de', band: 'B1', translation: 'Laufbahn, Karriere', ts: now - 9 * 86400000, seen: 1, reviews: 0 },
  { id: 'v4', text: 'champion', learn: 'fr', native: 'de', band: 'A2', translation: 'Meister', ts: now - 20 * 86400000, seen: 1, reviews: 1, correct: 1, lastReviewed: now - 5 * 86400000 },
];

const lesson = {
  url: LESSON_URL,
  lang: 'fr',
  level: 'A2',
  title: 'Michael Olise',
  dateKey: dateKey(),
  paragraphs: [
    {
      original: 'Michael Olise est un footballeur international français qui évolue au poste d’ailier droit.',
      simplified: 'Michael Olise est un footballeur. Il est français et il joue pour la France.',
      read: true,
    },
    {
      original: 'Formé en Angleterre, il commence sa carrière au Reading FC puis au Crystal Palace.',
      simplified: 'Il a grandi en Angleterre. Sa carrière a commencé au Reading FC, puis au Crystal Palace.',
      read: false,
    },
  ],
  progress: 2,
  startedTs: now,
  updatedTs: now,
};

test('capture all surfaces (dark + light)', async ({ context, extensionId }) => {
  await seedStorage(context.serviceWorkers()[0]!, {
    settings: { onboarded: true, learnLang: 'fr', nativeLang: 'de', level: 'A2', serverEnabled: false },
    daily: { dateKey: dateKey(), lang: 'fr', articles: ARTICLES, streak: 3 },
    vocab,
    bookmarks: [{ url: 'https://lemonde.fr/article', title: 'Le Monde — un article', ts: now }],
    lessons: { [LESSON_URL]: lesson },
  });

  const page = await context.newPage();

  for (const scheme of ['dark', 'light'] as const) {
    await page.emulateMedia({ colorScheme: scheme });

    // --- Side panel (narrow) ---
    await page.setViewportSize({ width: 390, height: 820 });
    const panel = `chrome-extension://${extensionId}/sidepanel.html`;

    await page.goto(panel);
    await page.waitForSelector('.ll-home');
    await page.screenshot({ path: `${OUT}/${scheme}-1-chooser.png`, fullPage: true });

    await page.locator('.ll-mode-card.learn').click();
    await page.waitForSelector('.ll-daily');
    await page.screenshot({ path: `${OUT}/${scheme}-2-learn.png`, fullPage: true });

    await page.locator('.ll-trophy').click();
    await page.waitForSelector('.ll-prog');
    await page.screenshot({ path: `${OUT}/${scheme}-3-erfolge.png`, fullPage: true });
    await page.locator('.ll-prog-close').click();

    await page.goto(panel); // reset to chooser
    await page.waitForSelector('.ll-home');
    await page.locator('.ll-mode-card.surf').click();
    await page.waitForSelector('.ll-actions-row');
    await page.screenshot({ path: `${OUT}/${scheme}-4-surf.png`, fullPage: true });

    await page.locator('.ll-gear').click();
    await page.waitForSelector('.ll-settings');
    await page.screenshot({ path: `${OUT}/${scheme}-5-settings.png`, fullPage: true });

    // --- Lesson page (wide) ---
    await page.setViewportSize({ width: 900, height: 1000 });
    const q = new URLSearchParams({ lang: 'fr', title: 'Michael Olise', url: LESSON_URL });
    await page.goto(`chrome-extension://${extensionId}/lesson.html?${q}`);
    await page.waitForSelector('.lz-article');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/${scheme}-6-lesson.png`, fullPage: true });
  }
});
