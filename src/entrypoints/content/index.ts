/**
 * Content script entrypoint — wires the inline layer together:
 *   highlight challenging words → on hover, resolve + show the dialog.
 *
 * It also injects the marker style (challenging = subtle underline; easy words
 * are simply left as the page's normal text, which already reads as "darker"
 * next to the muted marks). Honours the `inlineEnabled` setting and toggles live.
 */

import { resolveWord } from '@/core/wordinfo';
import { getSettings, watchSettings } from '@/core/settings';
import { getPanelOpen, watchPanelOpen } from '@/core/panel';
import { clear, highlight } from './highlighter';
import { cancelHide, scheduleHide, showHover } from './hover';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  async main() {
    injectMarkerStyle();
    let settings = await getSettings();
    let panelOpen = await getPanelOpen();

    async function apply() {
      clear();
      // Only mark while the panel is open — closing it removes the markings.
      if (!settings.inlineEnabled || !settings.onboarded || !panelOpen) return;
      document.documentElement.style.setProperty('--ll-underline', underlineColor(settings.markerColor));
      await highlight(document.body, {
        learn: settings.learnLang,
        native: settings.nativeLang,
        level: settings.level,
        onMarkCreated: attachHover,
      });
    }

    function attachHover(el: HTMLElement, word: string) {
      let hoverTimer: number | undefined;
      el.addEventListener('mouseenter', () => {
        cancelHide();
        hoverTimer = window.setTimeout(async () => {
          const info = await resolveWord(word, settings.learnLang, settings.nativeLang, settings.level);
          showHover(el, info);
        }, 120);
      });
      el.addEventListener('mouseleave', () => {
        window.clearTimeout(hoverTimer);
        scheduleHide();
      });
    }

    await apply();
    watchSettings((next) => {
      settings = next;
      void apply();
    });
    watchPanelOpen((open) => {
      panelOpen = open;
      void apply();
    });
  },
});

/**
 * Marker styling injected into the host page. We aggressively reset the mark so
 * the site's own `span` rules (display:inline-block, margins, font-size:0 tricks)
 * can't apply and break the text flow — only our underline remains.
 */
function injectMarkerStyle(): void {
  const style = document.createElement('style');
  style.setAttribute('data-ll-ui', 'marker');
  style.textContent = `
    [data-ll-mark] {
      display: inline !important;
      margin: 0 !important;
      padding: 0 !important;
      border: 0 !important;
      background: transparent !important;
      box-shadow: none !important;
      float: none !important;
      position: static !important;
      width: auto !important;
      height: auto !important;
      max-width: none !important;
      vertical-align: baseline !important;
      font: inherit !important;
      color: inherit !important;
      letter-spacing: inherit !important;
      word-spacing: inherit !important;
      white-space: inherit !important;
      text-decoration: underline dotted var(--ll-underline, rgba(107, 87, 214, 0.6)) !important;
      text-decoration-thickness: 2px !important;
      text-underline-offset: 3px !important;
      cursor: help;
    }
  `;
  document.head.append(style);
}

/** Resolve the underline colour: a fixed hex, or auto by page brightness. */
function underlineColor(setting: string): string {
  if (setting && setting !== 'auto') return setting;
  return isDarkPage() ? 'rgba(170, 150, 255, 0.95)' : 'rgba(107, 87, 214, 0.6)';
}

/** True if the page background is dark (so we need a brighter underline). */
function isDarkPage(): boolean {
  for (const el of [document.body, document.documentElement]) {
    if (!el) continue;
    const m = getComputedStyle(el).backgroundColor.match(/rgba?\(([^)]+)\)/);
    if (!m?.[1]) continue;
    const parts = m[1].split(',').map((n) => parseFloat(n.trim()));
    const r = parts[0] ?? 255;
    const g = parts[1] ?? 255;
    const b = parts[2] ?? 255;
    if (parts[3] === 0) continue; // fully transparent → keep looking
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5;
  }
  return false;
}
