/**
 * Typed messages from content script → background. The background runs the LLM
 * and writes the outcome to the shared panel result (see core/result.ts), so
 * these are fire-and-forget; the panel reflects the result via storage.
 */

export type Message =
  | { type: 'translateToPanel'; text: string }
  | { type: 'explainToPanel'; word: string }
  | { type: 'saveVocab'; word: string; context?: string };

/** Send a message to the background worker. Resolves once it is accepted. */
export async function sendMessage(message: Message): Promise<void> {
  await browser.runtime.sendMessage(message);
}
