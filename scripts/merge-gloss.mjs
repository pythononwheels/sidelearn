#!/usr/bin/env node
/**
 * Merge gloss shards into the bundled glossary.
 * Shards: data/gloss/<pair>/*.json  ({ word: [translations] }) — hand-authored,
 * tracked in git. Output: src/public/data/gloss-<pair>.json
 *
 * Usage: node scripts/merge-gloss.mjs <learn> <native>
 */

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  const [learn, native] = process.argv.slice(2);
  if (!learn || !native) throw new Error('usage: merge-gloss.mjs <learn> <native>');
  const pair = `${learn}-${native}`;
  const shardDir = join(ROOT, 'data', 'gloss', pair);

  let files = [];
  try {
    files = (await readdir(shardDir)).filter((f) => f.endsWith('.json')).sort();
  } catch {
    throw new Error(`no shard dir ${shardDir}`);
  }

  const merged = {};
  for (const f of files) {
    const part = JSON.parse(await readFile(join(shardDir, f), 'utf8'));
    for (const [w, t] of Object.entries(part)) {
      if (Array.isArray(t) && t.length && !merged[w]) merged[w] = t;
    }
  }

  const out = join(ROOT, 'src', 'public', 'data', `gloss-${pair}.json`);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(merged));
  console.log(`gloss-${pair}.json: ${Object.keys(merged).length} entries from ${files.length} shards`);
}

await main();
