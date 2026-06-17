/**
 * Smoke E2E for the side panel — covers exactly the regressions we hit by hand:
 *  - the panel opens on the Lernen/Surfen chooser (mode is not persisted)
 *  - choosing Lernen shows the daily-challenge card (seeded, no network)
 *  - reloading returns to the chooser
 *  - choosing Surfen shows the browsing tools
 *
 * Storage is seeded via the service worker so the run is deterministic and does
 * not need Wikipedia or LM Studio.
 */

import { test, expect, dateKey, seedStorage } from './fixtures';

const ARTICLES = [
  {
    title: 'Testartikel Eins',
    extract: 'Ceci est un court texte de test pour la première leçon du jour.',
    url: 'https://fr.wikipedia.org/wiki/Testartikel_Eins',
    lang: 'fr',
  },
  {
    title: 'Testartikel Zwei',
    extract: 'Un deuxième texte de test pour la seconde leçon quotidienne.',
    url: 'https://fr.wikipedia.org/wiki/Testartikel_Zwei',
    lang: 'fr',
  },
];

test.beforeEach(async ({ serviceWorker }) => {
  await seedStorage(serviceWorker, {
    settings: { onboarded: true, learnLang: 'fr', nativeLang: 'de', level: 'A2' },
    daily: { dateKey: dateKey(), lang: 'fr', articles: ARTICLES, streak: 0 },
  });
});

test('opens on the Lernen/Surfen chooser', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

  await expect(page.locator('.ll-home')).toBeVisible();
  await expect(page.locator('.ll-mode-card.learn')).toBeVisible();
  await expect(page.locator('.ll-mode-card.surf')).toBeVisible();
});

test('Lernen shows the seeded daily card with "Lektion starten"', async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

  await page.locator('.ll-mode-card.learn').click();

  await expect(page.locator('.ll-daily')).toBeVisible();
  await expect(page.locator('.ll-daily-title')).toHaveText('Testartikel Eins');
  await expect(page.locator('.ll-daily-count')).toHaveText('0/2');
  await expect(page.locator('.ll-daily-read')).toHaveText(/Lektion starten/);
});

test('reloading returns to the chooser (mode not persisted)', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

  await page.locator('.ll-mode-card.learn').click();
  await expect(page.locator('.ll-daily')).toBeVisible();

  await page.reload();
  await expect(page.locator('.ll-home')).toBeVisible();
  await expect(page.locator('.ll-daily')).toHaveCount(0);
});

test('Surfen shows the browsing tools', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

  await page.locator('.ll-mode-card.surf').click();

  await expect(page.getByRole('button', { name: /Markieren/ })).toBeVisible();
  await expect(page.locator('.ll-actions-row')).toBeVisible();
});
