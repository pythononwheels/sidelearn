#!/usr/bin/env node
/**
 * Build src/public/data/data-manifest.json: a map of each bundled data file to a
 * short content hash. The PWA loads this once and requests data files as
 * `/data/<file>?v=<hash>`, so a changed dictionary gets a NEW URL and the service
 * worker's CacheFirst fetches it fresh — while unchanged dicts keep their hash
 * and stay cached (no wasteful re-download). Run before `vite build`.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'public', 'data');
const MANIFEST = 'data-manifest.json';

const files = readdirSync(DATA).filter((f) => f.endsWith('.json') && f !== MANIFEST);
const manifest = {};
for (const f of files.sort()) {
  const hash = createHash('sha256').update(readFileSync(join(DATA, f))).digest('hex').slice(0, 10);
  manifest[f] = hash;
}
writeFileSync(join(DATA, MANIFEST), JSON.stringify(manifest));
console.log(`data-manifest.json: ${files.length} files hashed`);
