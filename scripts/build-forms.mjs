#!/usr/bin/env node
/**
 * Build an inflection → lemma map from a Wiktextract (Kaikki) JSONL stream,
 * limited to our frequency words, so the hover can resolve inflected forms
 * (e.g. tengo → tener) and translate them via the existing FreeDict dictionary.
 *
 * Streams stdin (so the ~1 GB extract never needs to be saved or held in RAM):
 *   curl -s https://kaikki.org/dictionary/Spanish/...jsonl | node scripts/build-forms.mjs es
 *
 * Output: src/public/data/forms-<learn>.json  ({ form: lemma })
 */

import { createInterface } from 'node:readline';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'src', 'public', 'data');
const norm = (w) => w.toLowerCase().replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');

async function main() {
  const learn = process.argv[2];
  if (!learn) throw new Error('usage: build-forms.mjs <learn>   (pipe the jsonl via stdin)');

  const freq = JSON.parse(await readFile(join(DATA, `freq-${learn}.json`), 'utf8'));
  const vocab = new Set(Object.keys(freq)); // only keep forms we'd actually mark
  const forms = {};
  let lines = 0;

  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line) continue;
    lines++;
    let e;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    const form = norm(e.word ?? '');
    if (!form || form.length < 2 || !vocab.has(form) || forms[form]) continue;
    for (const s of e.senses ?? []) {
      const lemma = s.form_of?.[0]?.word ?? s.alt_of?.[0]?.word;
      if (lemma) {
        const l = norm(lemma);
        if (l && l !== form) {
          forms[form] = l;
          break;
        }
      }
    }
  }

  await writeFile(join(DATA, `forms-${learn}.json`), JSON.stringify(forms));
  console.log(`forms-${learn}.json: ${Object.keys(forms).length} forms (from ${lines} entries)`);
}

await main();
