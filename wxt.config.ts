import { defineConfig } from 'wxt';
import preact from '@preact/preset-vite';

// WXT configuration — https://wxt.dev
// Entrypoints live in `src/entrypoints`, shared logic in `src/core` and `src/ui`.
export default defineConfig({
  srcDir: 'src',
  modules: [],
  vite: () => ({
    plugins: [preact()],
  }),
  manifest: {
    name: 'Sidelearn',
    description:
      'Read foreign-language pages with inline, CEFR-aware reading help powered by a local LLM.',
    // Side panel is the stable backbone; content script adds the optional inline layer.
    permissions: ['storage', 'sidePanel', 'activeTab', 'scripting', 'contextMenus', 'tabs'],
    // localhost: LM Studio. http/https: reliable scripting (page text, bookmark
    // colour) from the panel without per-tab activeTab gestures. The content
    // script already runs on <all_urls>, so this is consistent.
    host_permissions: ['http://localhost/*', 'http://127.0.0.1/*', 'http://*/*', 'https://*/*'],
    side_panel: {
      default_path: 'sidepanel.html',
    },
    action: {
      default_title: 'Open Sidelearn panel',
      default_icon: {
        '16': 'icon/16.png',
        '32': 'icon/32.png',
        '48': 'icon/48.png',
        '128': 'icon/128.png',
      },
    },
    // Bundled data must be fetchable from the content script context.
    web_accessible_resources: [
      {
        resources: ['data/*.json'],
        matches: ['<all_urls>'],
      },
    ],
  },
});
