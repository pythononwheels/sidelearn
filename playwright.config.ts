import { defineConfig } from '@playwright/test';

// E2E for the MV3 extension. Each test launches its own persistent context with
// the unpacked build, so we keep it to a single worker. Run `npm run build`
// first (the test:e2e script does this) and `npm run e2e:install` once.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: 'list',
});
