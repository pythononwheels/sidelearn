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
  await page.goto(URL!);
  await expect(page.locator('.sl-brand')).toBeVisible();
  // Daily list (or an empty-state message) appears.
  await expect(page.locator('.sl-item').first()).toBeVisible({ timeout: 20000 });

  // Open the first lesson → simplified paragraph renders.
  await page.locator('.sl-item').first().click();
  await expect(page.locator('.sl-text').first()).toBeVisible({ timeout: 20000 });

  // Level switcher present.
  await expect(page.locator('.sl-lvlbtn').first()).toBeVisible();

  // Tap a word → translation popover (bundled dict).
  await page.locator('.sl-word').first().click();
  await expect(page.locator('.sl-pop')).toBeVisible({ timeout: 15000 });
});
