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
    name: 'LangLearn',
    description:
      'Read foreign-language pages with inline, CEFR-aware reading help powered by a local LLM.',
    // Side panel is the stable backbone; content script adds the optional inline layer.
    permissions: ['storage', 'sidePanel', 'activeTab', 'scripting'],
    // LM Studio's OpenAI-compatible server. Kept narrow on purpose.
    host_permissions: ['http://localhost/*', 'http://127.0.0.1/*'],
    side_panel: {
      default_path: 'sidepanel.html',
    },
    action: {
      default_title: 'Open LangLearn panel',
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
