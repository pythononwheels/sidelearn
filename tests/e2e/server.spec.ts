/**
 * Live integration against a running content server. Skipped unless
 * SL_SERVER_URL is set, e.g.:
 *   SL_SERVER_URL=http://127.0.0.1:8000 npx playwright test server
 */

import { test, expect, seedStorage } from './fixtures';

const SERVER = process.env.SL_SERVER_URL;

test.skip(!SERVER, 'set SL_SERVER_URL to a running content server');

test('daily + lesson come from the content server', async ({
  context,
  extensionId,
  serviceWorker,
}) => {
  await seedStorage(serviceWorker, {
    settings: {
      onboarded: true,
      learnLang: 'fr',
      nativeLang: 'de',
      level: 'A2',
      serverEnabled: true,
      serverUrl: SERVER,
      serverLevel: 'A2',
    },
  });

  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await page.locator('.ll-mode-card.learn').click();
  await expect(page.locator('.ll-daily-item').first()).toBeVisible({ timeout: 15000 });

  // Open a server lesson directly and check it renders pre-baked content.
  const daily = await (await fetch(`${SERVER}/daily?lang=fr&level=A2`)).json();
  const a = daily.articles[0];
  const q = new URLSearchParams({ lang: 'fr', title: a.title, url: a.url, server: a.id, level: 'A2' });
  const lp = await context.newPage();
  await lp.goto(`chrome-extension://${extensionId}/lesson.html?${q}`);
  await expect(lp.locator('.lz-article')).toBeVisible({ timeout: 15000 });
  await expect(lp.locator('.lz-simplified').first()).not.toBeEmpty();
  await expect(lp.locator('.lz-level-select')).toBeVisible();
});
