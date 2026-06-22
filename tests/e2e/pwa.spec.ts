/**
 * PWA smoke test against the built app served statically. Gated on PWA_URL:
 *   ( cd .output/pwa && python3 -m http.server 4178 ) &
 *   PWA_URL=http://localhost:4178 npx playwright test pwa
 * Hits the live content server (CORS open) — no extension context needed.
 */

import { test, expect } from '@playwright/test';

const URL = process.env.PWA_URL;
test.skip(!URL, 'set PWA_URL to a served .output/pwa');

test('daily list renders and a word lookup works', async ({ page }) => {
  // Skip onboarding by seeding settings before the app boots.
  await page.addInitScript(() => {
    localStorage.setItem(
      'sl_pwa_settings',
      JSON.stringify({ learn: 'fr', native: 'de', level: 'A2', onboarded: true }),
    );
  });
  await page.goto(URL!);
  await expect(page.locator('.h2-hero')).toBeVisible();
  // The daily lesson card's Start button appears once the daily set loads.
  await expect(page.locator('.h2-go')).toBeVisible({ timeout: 20000 });

  // Open the daily lesson → simplified paragraph renders.
  await page.locator('.h2-go').click();
  await expect(page.locator('.sl-text').first()).toBeVisible({ timeout: 20000 });

  // Level switcher present.
  await expect(page.locator('.sl-lvlbtn').first()).toBeVisible();

  // Tap a word → translation popover (bundled dict).
  await page.locator('.sl-word').first().click();
  await expect(page.locator('.sl-pop')).toBeVisible({ timeout: 15000 });
});
