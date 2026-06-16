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

/** Marker styling injected into the host page; intentionally minimal. */
function injectMarkerStyle(): void {
  const style = document.createElement('style');
  style.setAttribute('data-ll-ui', 'marker');
  style.textContent = `
    [data-ll-mark] {
      text-decoration: underline;
      text-decoration-style: dotted;
      text-decoration-color: rgba(58, 110, 165, 0.5);
      text-underline-offset: 3px;
      cursor: help;
    }
  `;
  document.head.append(style);
}
