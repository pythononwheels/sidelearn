/**
 * Hover dialog rendered on the live page, isolated in a Shadow DOM so the
 * host page's CSS can never affect it (and vice versa).
 *
 * Shows instant info (band + dictionary senses). The "more" button escalates
 * to the LLM via the background worker (Stage 3) and renders the result inline.
 */

import { sendMessage } from '@/core/messaging';
import type { WordInfo } from '@/core/types';
import tokens from '@/ui/tokens.css?inline';
import styles from './hover.css?inline';

let host: HTMLDivElement | null = null;
let shadow: ShadowRoot | null = null;
let hideTimer: number | undefined;

/** Grace period so the cursor can travel from the word into the card. */
const HIDE_DELAY = 280;

function ensureHost(): ShadowRoot {
  if (shadow) return shadow;
  host = document.createElement('div');
  host.setAttribute('data-ll-ui', 'hover');
  host.style.cssText = 'position:absolute;top:0;left:0;z-index:2147483647;';
  document.body.append(host);
  shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  // Design tokens are declared on :root, but inside a Shadow DOM :root matches
  // nothing — the custom properties must live on :host to apply here.
  style.textContent = tokens.replace(/:root/g, ':host') + styles;
  shadow.append(style);
  return shadow;
}

export function showHover(anchor: HTMLElement, info: WordInfo): void {
  cancelHide();
  const root = ensureHost();
  root.querySelector('.ll-card')?.remove();

  const card = document.createElement('div');
  card.className = 'll-card';
  // Keep the card open while the cursor is over it; hide shortly after leaving.
  card.addEventListener('mouseenter', cancelHide);
  card.addEventListener('mouseleave', () => scheduleHide());
  card.innerHTML = `
    <div class="ll-head"><span class="ll-word"></span><span class="ll-band"></span></div>
    <ul class="ll-senses"></ul>
    <button class="ll-more" type="button">mehr in der Sidebar →</button>
  `;
  card.querySelector('.ll-word')!.textContent = info.word;
  const bandEl = card.querySelector('.ll-band')!;
  bandEl.textContent = info.band;
  bandEl.setAttribute('data-band', info.band[0] ?? '');

  const list = card.querySelector('.ll-senses')!;
  if (info.senses.length) {
    for (const sense of info.senses.slice(0, 3)) {
      const li = document.createElement('li');
      li.textContent = sense.translations.join(', ');
      list.append(li);
    }
  } else {
    const li = document.createElement('li');
    li.className = 'll-empty';
    li.textContent = 'Keine Wörterbuch­übersetzung — „mehr" fragt das lokale Modell.';
    list.append(li);
  }

  card.querySelector('.ll-more')!.addEventListener('click', () => {
    void sendMessage({ type: 'explainToPanel', word: info.word });
    card.querySelector('.ll-more')!.textContent = '✓ im Panel (öffne die Sidebar)';
  });

  root.append(card);
  position(card, anchor);
}

/** Hide after a short grace period (cancellable by re-entering word or card). */
export function scheduleHide(): void {
  cancelHide();
  hideTimer = window.setTimeout(() => {
    shadow?.querySelector('.ll-card')?.remove();
  }, HIDE_DELAY);
}

export function cancelHide(): void {
  if (hideTimer !== undefined) {
    window.clearTimeout(hideTimer);
    hideTimer = undefined;
  }
}

function position(card: HTMLElement, anchor: HTMLElement): void {
  const rect = anchor.getBoundingClientRect();
  card.style.top = `${rect.bottom + window.scrollY + 4}px`;
  card.style.left = `${rect.left + window.scrollX}px`;
}
