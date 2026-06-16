/**
 * Stage 1–2 word resolution: combine frequency band + dictionary into a single
 * `WordInfo`. Fully local, no LLM, safe to call for every word on the page.
 */

import type { CefrLevel } from './difficulty/banding';
import { isAboveLevel, rankToBand } from './difficulty/banding';
import { loadRanks, rankOf } from './difficulty/frequency';
import { lookup } from './dict/freedict';
import type { LangPair } from './config';
import type { WordInfo } from './types';

export async function resolveWord(
  word: string,
  lang: LangPair['source'],
  level: CefrLevel,
): Promise<WordInfo> {
  const ranks = await loadRanks(lang);
  const rank = rankOf(ranks, word);
  // Unknown rank → treat as the hardest band so rare words still get flagged.
  const band: CefrLevel = rank === undefined ? 'C2' : rankToBand(rank);

  const senses = await lookup(word, lang);
  return {
    word,
    band,
    challenging: isAboveLevel(band, level),
    senses,
  };
}
