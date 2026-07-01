/**
 * Resolve a bundled data file URL across runtimes.
 *
 * - Extension (WXT): `browser.runtime.getURL('/data/x.json')` → chrome-extension://…
 * - PWA / web: the same files are served from the site root → return the path.
 *
 * Lets `src/core/*` (dict, frequency, names) be shared by both the extension
 * and the PWA without each loader knowing where it runs.
 */
// Per-file content-hash manifest (PWA only). Loaded once at startup so data URLs
// can be versioned (?v=<hash>): a changed dictionary gets a new URL → the SW's
// CacheFirst fetches it fresh, while unchanged files keep their hash and stay
// cached. Empty in the extension (files update atomically there).
let manifest: Record<string, string> = {};

/** Fetch the data manifest once. Fails soft → unversioned URLs still work. */
export async function loadDataManifest(): Promise<void> {
  try {
    const res = await fetch(dataUrl('/data/data-manifest.json'));
    if (res.ok) manifest = await res.json();
  } catch {
    /* offline / missing → keep empty, URLs stay unversioned */
  }
}

export function dataUrl(path: string): string {
  let url: string;
  try {
    // `browser` is injected by WXT only in the extension build.
    const b = (globalThis as { browser?: { runtime?: { getURL?: (p: string) => string } } }).browser;
    if (b?.runtime?.getURL) return b.runtime.getURL(path);
    throw 0; // fall through to PWA path
  } catch {
    // PWA / web: prefix with the app's base (e.g. "/app/") so data files resolve
    // when the app is served from a subpath, not just the site root.
    const base = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
    url = base.replace(/\/$/, '') + path;
  }
  // Cache-bust changed data files by content hash (skips the manifest itself).
  const v = manifest[path.split('/').pop() ?? ''];
  return v ? `${url}?v=${v}` : url;
}
