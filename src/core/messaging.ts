/**
 * Typed messages from content script → background. The background runs the LLM
 * and writes the outcome to the shared panel result (see core/result.ts), so
 * these are fire-and-forget; the panel reflects the result via storage.
 */

export type Message =
  | { type: 'translateToPanel'; text: string; title?: string; hideSource?: boolean; pageKey?: string }
  | { type: 'explainToPanel'; word: string; context?: string }
  | { type: 'saveVocab'; word: string; context?: string };

/** Send a message to the background worker. Resolves once it is accepted. */
export async function sendMessage(message: Message): Promise<void> {
  await browser.runtime.sendMessage(message);
}

/**
 * Request a level-simplified version of a paragraph from the background worker
 * (which owns the LM Studio connection). Returns null on any failure.
 */
export async function requestSimplify(text: string): Promise<string | null> {
  try {
    const res = await browser.runtime.sendMessage({ type: 'simplifyPara', text });
    return typeof res === 'string' && res.trim() ? res : null;
  } catch {
    return null;
  }
}
