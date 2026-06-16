/**
 * Hover dialog rendered on the live page, isolated in a Shadow DOM so the
 * host page's CSS can never affect it (and vice versa).
 *
 * Shows instant info (band + dictionary senses). The "more" button escalates
 * to the LLM via the background worker (Stage 3) and renders the result inline.
 */

import type { Language } from '@/core/config';
import { sendMessage } from '@/core/messaging';
import type { WordInfo } from '@/core/types';
import tokens from '@/ui/tokens.css?inline';
import styles from './hover.css?inline';

let host: HTMLDivElement | null = null;
let shadow: ShadowRoot | null = null;

function ensureHost(): ShadowRoot {
  if (shadow) return shadow;
  host = document.createElement('div');
  host.setAttribute('data-ll-ui', 'hover');
  host.style.cssText = 'position:absolute;top:0;left:0;z-index:2147483647;';
  document.body.append(host);
  shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = tokens + styles;
  shadow.append(style);
  return shadow;
}

export function showHover(
  anchor: HTMLElement,
  info: WordInfo,
  learn: Language,
  native: Language,
): void {
  const root = ensureHost();
  root.querySelector('.ll-card')?.remove();

  const card = document.createElement('div');
  card.className = 'll-card';
  card.innerHTML = `
    <div class="ll-head"><span class="ll-word"></span><span class="ll-band"></span></div>
    <ul class="ll-senses"></ul>
    <button class="ll-more" type="button">mehr in der Sidebar →</button>
  `;
  card.querySelector('.ll-word')!.textContent = info.word;
  card.querySelector('.ll-band')!.textContent = info.band;

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
    void sendMessage({ type: 'explainWord', word: info.word, learn, native });
    // The side panel listens for the explanation; here we just acknowledge.
    card.querySelector('.ll-more')!.textContent = '… an die Sidebar gesendet';
  });

  root.append(card);
  position(card, anchor);
}

export function hideHover(): void {
  shadow?.querySelector('.ll-card')?.remove();
}

function position(card: HTMLElement, anchor: HTMLElement): void {
  const rect = anchor.getBoundingClientRect();
  card.style.top = `${rect.bottom + window.scrollY + 6}px`;
  card.style.left = `${rect.left + window.scrollX}px`;
}
