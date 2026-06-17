/**
 * Inline "vereinfachen" reading aid: under each readable paragraph, show a
 * level-adapted version in the same language. Paragraphs are simplified lazily
 * as they enter the viewport (an IntersectionObserver with look-ahead), the
 * result rendered in a muted block beneath the original. Everything is cached
 * per page so re-scrolling is instant and the local model is hit at most once
 * per paragraph.
 */

import type { Settings } from '@/core/config';
import { requestSimplify } from '@/core/messaging';
import { pageKey } from '@/core/result';
import { cacheKey, getCached, putCached } from '@/core/simplify';

const DONE_ATTR = 'data-ll-simplified';
const BLOCK_CLASS = 'll-simplify-block';

let observer: IntersectionObserver | null = null;
const inflight = new WeakSet<Element>();

/** Remove all simplify blocks and stop observing. */
export function clearSimplify(): void {
  observer?.disconnect();
  observer = null;
  for (const b of document.querySelectorAll(`.${BLOCK_CLASS}`)) b.remove();
  for (const p of document.querySelectorAll(`[${DONE_ATTR}]`)) p.removeAttribute(DONE_ATTR);
}

/** Begin simplifying the page's paragraphs (idempotent — clears first). */
export function simplifyPage(settings: Settings): void {
  clearSimplify();
  injectStyle();
  const key = pageKey(location.href);
  const root = document.querySelector('article, main') ?? document.body;
  const paras = Array.from(root.querySelectorAll('p')).filter(isCandidate);
  if (paras.length === 0) return;

  observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        observer?.unobserve(e.target);
        void process(e.target as HTMLElement, settings, key);
      }
    },
    { rootMargin: '300px 0px' }, // look ahead so it's ready by the time you scroll there
  );
  for (const p of paras) observer.observe(p);
}

function isCandidate(p: Element): boolean {
  if (p.closest('[data-ll-ui]')) return false;
  if (p.closest('nav, footer, aside, form, figure')) return false;
  const text = p.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  return text.length >= 80 && text.length <= 1500;
}

async function process(p: HTMLElement, settings: Settings, key: string): Promise<void> {
  if (p.hasAttribute(DONE_ATTR) || inflight.has(p)) return;
  inflight.add(p);
  p.setAttribute(DONE_ATTR, '');

  const text = p.textContent!.replace(/\s+/g, ' ').trim();
  const ck = cacheKey(settings.learnLang, settings.level, text);

  const cached = await getCached(key, ck);
  if (cached) {
    insertBlock(p, cached);
    inflight.delete(p);
    return;
  }

  const block = insertBlock(p, null); // null → spinner
  const simplified = await requestSimplify(text);
  // The block may have been removed in the meantime (toggle off / re-scan).
  if (!block.isConnected) {
    inflight.delete(p);
    return;
  }
  if (simplified) {
    void putCached(key, ck, simplified);
    fill(block, simplified);
  } else {
    block.remove();
  }
  inflight.delete(p);
}

/** Create the muted block beneath a paragraph (spinner if text is null). */
function insertBlock(p: HTMLElement, text: string | null): HTMLElement {
  const block = document.createElement('div');
  block.className = BLOCK_CLASS;
  block.setAttribute('data-ll-ui', 'simplify');
  if (text) {
    fill(block, text);
  } else {
    block.innerHTML =
      '<span class="ll-simplify-dots"><i></i><i></i><i></i></span>';
  }
  p.after(block);
  return block;
}

function fill(block: HTMLElement, text: string): void {
  block.textContent = text;
}

let styled = false;
function injectStyle(): void {
  if (styled) return;
  styled = true;
  const style = document.createElement('style');
  style.setAttribute('data-ll-ui', 'simplify-style');
  style.textContent = `
    .${BLOCK_CLASS} {
      margin: 4px 0 10px !important;
      padding: 8px 12px !important;
      border-left: 3px solid var(--ll-underline, #8b78f0) !important;
      border-radius: 6px !important;
      background: color-mix(in srgb, var(--ll-underline, #8b78f0) 8%, transparent) !important;
      font-size: 0.92em !important;
      line-height: 1.5 !important;
      color: inherit !important;
      opacity: 0.92;
    }
    .${BLOCK_CLASS} .ll-simplify-dots { display: inline-flex; gap: 4px; }
    .${BLOCK_CLASS} .ll-simplify-dots i {
      width: 5px; height: 5px; border-radius: 50%;
      background: var(--ll-underline, #8b78f0);
      animation: ll-simplify-bounce 1s infinite ease-in-out;
    }
    .${BLOCK_CLASS} .ll-simplify-dots i:nth-child(2) { animation-delay: 0.15s; }
    .${BLOCK_CLASS} .ll-simplify-dots i:nth-child(3) { animation-delay: 0.3s; }
    @keyframes ll-simplify-bounce {
      0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
      40% { transform: translateY(-4px); opacity: 1; }
    }
  `;
  document.head.append(style);
}
