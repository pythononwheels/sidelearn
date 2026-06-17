/**
 * Playwright fixtures for testing the Sidelearn MV3 extension.
 *
 * Extensions require a persistent context launched with --load-extension. The
 * side-panel page is opened by its chrome-extension:// URL, which gives it the
 * real extension context (storage, runtime) — so we can drive the actual UI.
 *
 * Prereqs: a build in `.output/chrome-mv3` (run `npm run build`) and the
 * Playwright chromium browser (`npm run e2e:install`). LM Studio only matters
 * for the LLM-driven flows; the smoke tests seed storage and avoid them.
 */

import { test as base, chromium, type BrowserContext, type Worker } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const EXTENSION_PATH = path.resolve('.output/chrome-mv3');

export const test = base.extend<{
  context: BrowserContext;
  serviceWorker: Worker;
  extensionId: string;
}>({
  context: async ({}, use) => {
    if (!fs.existsSync(EXTENSION_PATH)) {
      throw new Error(`Extension build not found at ${EXTENSION_PATH}. Run "npm run build" first.`);
    }
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sidelearn-e2e-'));
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium', // required to run extensions in headless mode
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
      ],
    });
    await use(context);
    await context.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  },

  serviceWorker: async ({ context }, use) => {
    let [sw] = context.serviceWorkers();
    if (!sw) sw = await context.waitForEvent('serviceworker');
    await use(sw);
  },

  extensionId: async ({ serviceWorker }, use) => {
    await use(serviceWorker.url().split('/')[2]!);
  },
});

export const expect = test.expect;

/** Local 'YYYY-MM-DD' for a date — mirrors core/daily.ts dateKey(). */
export function dateKey(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Seed chrome.storage.local through the service worker. wxt/storage maps a
 * `local:foo` key to chrome.storage.local["foo"], so pass bare keys here.
 */
export async function seedStorage(sw: Worker, data: Record<string, unknown>): Promise<void> {
  await sw.evaluate(async (d) => {
    await chrome.storage.local.set(d);
  }, data);
}
