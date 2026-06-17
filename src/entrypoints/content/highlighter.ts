/**
 * Inline highlighter — the optional "Kür" layer on the live page.
 *
 * Conservative by design (see doc/tech/architecture.md):
 *  - only walks plain text nodes inside readable content
 *  - never touches inputs, editable regions, code, scripts or our own UI
 *  - wraps only words flagged as challenging, so the DOM churn stays minimal
 *
 * All marks carry the `data-ll-mark` attribute so `clear()` can fully undo them.
 */

import type { CefrLevel } from '@/core/difficulty/banding';
import type { Language } from '@/core/config';
import { resolveWord } from '@/core/wordinfo';

const MARK_ATTR = 'data-ll-mark';
const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'CODE', 'PRE', 'KBD',
]);

// Splitting a text node whose direct parent is a flex/grid container turns one
// item into many → the layout collapses into columns (e.g. lemonde.fr). Skip those.
const displayCache = new WeakMap<Element, boolean>();
function isFlexOrGrid(el: Element): boolean {
  let cached = displayCache.get(el);
  if (cached === undefined) {
    const display = getComputedStyle(el).display;
    cached = display.includes('flex') || display.includes('grid');
    displayCache.set(el, cached);
  }
  return cached;
}

export interface HighlightOptions {
  learn: Language;
  native: Language;
  level: CefrLevel;
  /** Only mark words that have a dictionary entry. */
  requireDict: boolean;
  /** Proper nouns to never mark (John, Paris, …). */
  names: Set<string>;
  onMarkCreated: (el: HTMLElement, word: string) => void;
}

export async function highlight(root: ParentNode, opts: HighlightOptions): Promise<void> {
  const textNodes = collectTextNodes(root);
  for (const node of textNodes) {
    await processNode(node, opts);
  }
}

/** Remove every mark this extension added, restoring original text. */
export function clear(root: ParentNode = document.body): void {
  for (const mark of root.querySelectorAll(`[${MARK_ATTR}]`)) {
    mark.replaceWith(document.createTextNode(mark.textContent ?? ''));
  }
}

function collectTextNodes(root: ParentNode): Text[] {
  const walker = document.createTreeWalker(root as Node, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = (node as Text).parentElement;
      if (!parent || SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
      if (parent.isContentEditable) return NodeFilter.FILTER_REJECT;
      // Never mark inside links: underlining hides that they are links and
      // discourages clicking them.
      if (parent.closest('a')) return NodeFilter.FILTER_REJECT;
      if (parent.closest('[data-ll-ui]')) return NodeFilter.FILTER_REJECT;
      if (isFlexOrGrid(parent)) return NodeFilter.FILTER_REJECT;
      if (!node.textContent?.trim()) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
  return nodes;
}

async function processNode(node: Text, opts: HighlightOptions): Promise<void> {
  const text = node.textContent ?? '';
  const tokens = text.split(/(\p{L}[\p{L}\-']*)/u); // keep delimiters for faithful reconstruction
  const frag = document.createDocumentFragment();
  let changed = false;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i] ?? '';
    const isWord = i % 2 === 1; // odd indices are captured words
    if (!isWord || token.length < 3 || opts.names.has(token.toLowerCase())) {
      frag.append(token);
      continue;
    }
    const info = await resolveWord(token, opts.learn, opts.native, opts.level);
    if (!info.challenging || (opts.requireDict && info.senses.length === 0)) {
      frag.append(token);
      continue;
    }
    const span = document.createElement('span');
    span.setAttribute(MARK_ATTR, info.band);
    span.textContent = token;
    frag.append(span);
    opts.onMarkCreated(span, token);
    changed = true;
  }

  if (changed) node.replaceWith(frag);
}
