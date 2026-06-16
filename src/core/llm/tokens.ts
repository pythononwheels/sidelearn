/**
 * Token budgeting. We don't ship a full tokenizer (overkill in the browser);
 * a char-based estimate is plenty to keep calls under a safe input budget and
 * thus keep latency + RAM predictable.
 *
 * ~4 characters per token is a solid heuristic for French/Dutch/German text.
 */

const CHARS_PER_TOKEN = 4;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Split `text` into chunks whose estimated token count stays under `maxTokens`.
 * Splits on paragraph then sentence boundaries so we never cut mid-sentence
 * unless a single sentence already exceeds the budget.
 */
export function splitForBudget(text: string, maxTokens: number): string[] {
  if (estimateTokens(text) <= maxTokens) return [text.trim()].filter(Boolean);

  const maxChars = maxTokens * CHARS_PER_TOKEN;
  const units = text.split(/(?<=[.!?])\s+|\n{2,}/).map((u) => u.trim()).filter(Boolean);

  const chunks: string[] = [];
  let current = '';
  for (const unit of units) {
    if (unit.length > maxChars) {
      // A single oversized sentence: flush, then hard-split it.
      if (current) {
        chunks.push(current);
        current = '';
      }
      for (let i = 0; i < unit.length; i += maxChars) chunks.push(unit.slice(i, i + maxChars));
      continue;
    }
    if (current && (current.length + 1 + unit.length) > maxChars) {
      chunks.push(current);
      current = unit;
    } else {
      current = current ? `${current} ${unit}` : unit;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
