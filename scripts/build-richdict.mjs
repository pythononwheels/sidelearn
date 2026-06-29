#!/usr/bin/env node
/**
 * Build a rich, leveled learner dictionary (learn → German), once, on a machine
 * with a Gemini key. GROUNDED: the German MEANINGS come from the bundled FreeDict
 * dictionary (trusted); the LLM only adds part-of-speech + a natural example
 * sentence (+ its German translation) per sense, and may add at most ONE clearly
 * very-common missing sense. It must NOT invent rare/uncertain meanings — this is
 * a learning app.
 *
 *   GEMINI_API_KEY=... [GEMINI_MODEL=gemini-2.5-flash-lite] \
 *     node scripts/build-richdict.mjs <learn> [native=de] [N] [concurrency]
 *
 * Reads:  src/public/data/freq-<learn>.json, dict-<learn>-<native>.json, gloss-<learn>-<native>.json
 * Writes: src/public/data/richdict-<learn>-<native>.json
 *   schema: { word: { b: "A2", s: [{t,p,ex,exd}], alt: [..] } }
 *   meanings/POS/example-translation are in the NATIVE language; `native` defaults
 *   to 'de'. Grounding dict is optional — without it the build is LLM-only.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'src', 'public', 'data');

const LANG_NAMES = { fr: 'French', es: 'Spanish', en: 'English', nl: 'Dutch', it: 'Italian', de: 'German' };
const KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';

// Mirror src/core/difficulty/banding.ts RANK_THRESHOLDS.
const THRESHOLDS = [['A1', 750], ['A2', 1500], ['B1', 3000], ['B2', 6000], ['C1', 12000]];
const bandOf = (rank) => THRESHOLDS.find(([, b]) => rank <= b)?.[0] ?? 'C2';
const norm = (w) => w.toLowerCase().replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');

function systemPrompt(lang, nativeName) {
  return (
    `You build a learner's dictionary for a ${nativeName} speaker learning ${lang}. ` +
    `The user message is a JSON array of words, each: { "w": the ${lang} word, ` +
    `"b": CEFR band, "fd": ${nativeName} translations from a TRUSTED dictionary grouped by sense (may be empty) }.\n` +
    `For EACH word, output an entry with:\n` +
    `- "s": 1-3 senses ORDERED BY HOW COMMONLY A LEARNER MEETS THE WORD — the everyday ` +
    `dominant meaning MUST be first, NOT necessarily the order given in "fd". Each sense:\n` +
    `  "t" = ${nativeName} meaning (1-4 words). Use "fd" as the source of meanings, BUT you MUST:\n` +
    `    • put the everyday dominant sense first — the meaning a learner meets most often, ` +
    `not necessarily the order given in "fd" (e.g. for a frequent function word or a common ` +
    `conjugated verb form, lead with its everyday sense);\n` +
    `    • ADD a clearly-correct very common sense if it is missing from "fd" ` +
    `(negation particles, possessives, articles, frequent conjugated verb forms);\n` +
    `    • NEVER invent rare, technical, or uncertain meanings.\n` +
    `  "p" = part of speech, written in ${nativeName} using that language's standard grammatical ` +
    `terms (the equivalents of noun, verb, adjective, adverb, pronoun, article, preposition, …).\n` +
    `  "ex" = ONE short, natural ${lang} example sentence using the word in THAT sense.\n` +
    `  "exd" = the ${nativeName} translation of that example.\n` +
    `- "alt": up to 3 further ${nativeName} synonyms across the senses (optional, may be []).\n` +
    `Correctness matters — this is for language learning. Reply with MINIFIED JSON ONLY, an object ` +
    `keyed by each input word: {"<w>":{"s":[{"t":"","p":"","ex":"","exd":""}],"alt":[]}, ...}. Include every input word.`
  );
}

async function gemini(system, user) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`;
  const body = {
    system_instruction: { parts: [{ text: system }] },
    contents: [{ parts: [{ text: user }] }],
    generationConfig: { response_mime_type: 'application/json', temperature: 0.3 },
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      if (res.status === 429 || res.status >= 500) { await sleep(2000 * (attempt + 1)); continue; }
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      const j = await res.json();
      const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '{}';
      return JSON.parse(text.replace(/```(?:json)?/g, '').trim());
    } catch (e) {
      if (attempt === 2) { console.error('  ! batch failed:', e.message); return null; }
      await sleep(1500 * (attempt + 1));
    }
  }
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const learn = process.argv[2];
  // Optional <native> (defaults to 'de' for backward compatibility). If argv[3]
  // isn't a known language code it's treated as N, so `… <learn> [N] [conc]` works.
  let native = process.argv[3];
  let argShift = 4;
  if (!native || !LANG_NAMES[native]) { native = 'de'; argShift = 3; }
  const N = parseInt(process.argv[argShift] || '6000', 10);
  const CONC = parseInt(process.argv[argShift + 1] || '8', 10);
  if (!learn || !LANG_NAMES[learn]) throw new Error('usage: build-richdict.mjs <learn> [native=de] [N] [conc]');
  if (learn === native) throw new Error('learn and native must differ');
  if (!KEY) throw new Error('set GEMINI_API_KEY');
  const lang = LANG_NAMES[learn];
  const nativeName = LANG_NAMES[native];

  const freq = JSON.parse(await readFile(join(DATA, `freq-${learn}.json`), 'utf8'));
  const dict = JSON.parse(await readFile(join(DATA, `dict-${learn}-${native}.json`), 'utf8').catch(() => '{}'));
  const gloss = JSON.parse(await readFile(join(DATA, `gloss-${learn}-${native}.json`), 'utf8').catch(() => '{}'));
  if (!Object.keys(dict).length) {
    console.warn(`! no dict-${learn}-${native}.json grounding found — building UNGROUNDED (LLM-only). Review quality by sampling.`);
  }

  // Candidate words: top-N by rank, letters only, length >= 2.
  const words = Object.entries(freq)
    .filter(([, r]) => r <= N)
    .sort((a, b) => a[1] - b[1])
    .map(([w]) => w)
    .filter((w) => w.length >= 2 && /^[\p{L}]+$/u.test(w));

  // Build per-word grounding from FreeDict senses (+ gloss as one extra group).
  const cand = words.map((w) => {
    const fd = (dict[w] || []).map((s) => s.translations).filter((t) => t && t.length);
    if (gloss[w]?.length) fd.unshift(gloss[w]);
    return { w, b: bandOf(freq[w]), fd: fd.slice(0, 4) };
  });

  const system = systemPrompt(lang, nativeName);
  const BATCH = 12;
  const batches = [];
  for (let i = 0; i < cand.length; i += BATCH) batches.push(cand.slice(i, i + BATCH));

  const out = {};
  let done = 0;
  let cursor = 0;
  async function worker() {
    while (cursor < batches.length) {
      const idx = cursor++;
      const batch = batches[idx];
      const res = await gemini(system, JSON.stringify(batch.map((c) => ({ w: c.w, b: c.b, fd: c.fd }))));
      if (res) {
        for (const c of batch) {
          const e = res[c.w];
          const rawSenses = Array.isArray(e?.s) ? e.s.filter((s) => s && typeof s.t === 'string' && s.t.trim()) : [];
          const seenT = new Set();
          const senses = rawSenses.filter((s) => { // drop duplicate meanings (e.g. "Zeit"×2)
            const k = s.t.trim().toLowerCase();
            if (seenT.has(k)) return false;
            seenT.add(k); return true;
          }).slice(0, 3);
          if (senses.length) {
            out[c.w] = {
              b: c.b,
              s: senses.map((s) => ({
                t: String(s.t).trim(),
                p: typeof s.p === 'string' ? s.p.trim() : '',
                ex: typeof s.ex === 'string' ? s.ex.trim() : '',
                exd: typeof s.exd === 'string' ? s.exd.trim() : '',
              })),
              alt: Array.isArray(e.alt) ? e.alt.filter((a) => typeof a === 'string' && a.trim()).slice(0, 3) : [],
            };
          }
        }
      }
      done++;
      if (done % 10 === 0 || done === batches.length) {
        process.stderr.write(`\r  ${learn}: ${done}/${batches.length} batches, ${Object.keys(out).length} words`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  process.stderr.write('\n');

  await writeFile(join(DATA, `richdict-${learn}-${native}.json`), JSON.stringify(out));
  console.log(`richdict-${learn}-${native}.json: ${Object.keys(out).length} words (of ${cand.length} candidates)`);
}

await main();
