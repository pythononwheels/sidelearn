/**
 * Stage 1–2 word resolution: combine frequency band + dictionary into a single
 * `WordInfo`. Fully local, no LLM, safe to call for every word on the page.
 */

import type { CefrLevel } from './difficulty/banding';
import { isAboveLevel, rankToBand } from './difficulty/banding';
import { loadRanks, rankOf } from './difficulty/frequency';
import { lookup } from './dict/freedict';
import type { Language } from './config';
import type { WordInfo } from './types';

export async function resolveWord(
  word: string,
  learn: Language,
  native: Language,
  level: CefrLevel,
): Promise<WordInfo> {
  const ranks = await loadRanks(learn);
  const rank = rankOf(ranks, word);
  // Unknown words (names, foreign words, or not in the learning language at all)
  // are NOT flagged — flagging them turned every page into noise. Only words that
  // are in the frequency list AND above the learner's level get highlighted.
  const known = rank !== undefined;
  const band: CefrLevel = known ? rankToBand(rank) : 'C2';

  const senses = await lookup(word, learn, native);
  return {
    word,
    band,
    challenging: known && isAboveLevel(band, level),
    senses,
  };
}
