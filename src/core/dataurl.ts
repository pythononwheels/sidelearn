/**
 * Resolve a bundled data file URL across runtimes.
 *
 * - Extension (WXT): `browser.runtime.getURL('/data/x.json')` → chrome-extension://…
 * - PWA / web: the same files are served from the site root → return the path.
 *
 * Lets `src/core/*` (dict, frequency, names) be shared by both the extension
 * and the PWA without each loader knowing where it runs.
 */
export function dataUrl(path: string): string {
  try {
    // `browser` is injected by WXT only in the extension build.
    const b = (globalThis as { browser?: { runtime?: { getURL?: (p: string) => string } } }).browser;
    if (b?.runtime?.getURL) return b.runtime.getURL(path);
  } catch {
    // fall through to the plain path
  }
  return path;
}
