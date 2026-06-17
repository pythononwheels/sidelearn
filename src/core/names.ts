/**
 * Global proper-noun stoplist (John, Paris, …) built from Wiktionary, so the
 * highlighter doesn't mark names that have no meaningful translation.
 */

let cache: Set<string> | null = null;

export async function loadNames(): Promise<Set<string>> {
  if (cache) return cache;
  let list: string[] = [];
  try {
    const url = browser.runtime.getURL('/data/names.json' as never);
    const res = await fetch(url);
    if (res.ok) list = (await res.json()) as string[];
  } catch {
    // No names list yet.
  }
  cache = new Set(list);
  return cache;
}
