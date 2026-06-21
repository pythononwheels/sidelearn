# Open Tasks

Status: `open` · `hold` · `closed` · `archive`

## Now

- [closed] **curl-test LM Studio** — done. gemma-4-e4b: translation ~3s,
  word-JSON valid & high quality ~5.8s/111tok. Model ids corrected to gemma-4.
- [hold] **Compare e2b vs e4b** — deferred. Staying on e4b (default) for now;
  revisit the speed/quality trade-off later by loading `google/gemma-4-e2b`.
- [closed] **Real wordlists** — done. Generator downloads FrequencyWords
  (top-20k ranks, top-50k vocab) for fr/de/en/nl and parses FreeDict dictd for
  6 directed pairs, filtered to vocab. ~7 MB committed; sources gitignored.

## Next

- [closed] **Inline "Vereinfachen"** — done (0.6.46). Level-adapted, same-language
  rewrite under each paragraph on the live page; lazy (viewport), cached per page,
  concurrency-limited. Follow-ups: per-paragraph "Original/Vereinfacht" toggle;
  optional native-language translation mode; reuse for the daily-challenge
  "einfachere Sprache" side-by-side.
- [open] **Reader view in panel** — Readability.js extraction of the source
  text, difficulty colouring in-panel, per-paragraph translation rendered
  *beneath* each paragraph (the stable backbone fallback).
- [closed] **Stage 3 wiring to panel** — done. Hover "more" + right-click
  "Wort erklären" surface the explanation in the panel via the shared result slot.
- [open] **Background prefetch** — on explicit "translate page", queue
  paragraphs to LM Studio and cache results.
- [open] **Auto-open panel from hover "more"** — content-script can't open the
  side panel (no gesture); explanation only shows if the panel is already open.
  Consider a small toast/cue, or route hover-more through the context menu only.

## Next

- [closed] **Chat with page context** — done (0.6.3). "Chat zur Seite":
  multi-turn, page text in context, resets per page.

## Ideas (pipeline)

- [open] **Learn-PWA** (`pwa/`, Vite+Preact+vite-plugin-pwa) — v1 done: mobile
  daily challenge from the content server, lesson reader (level switch A2-C1,
  tap-to-translate via bundled dict, per-paragraph quiz), on-device progress,
  offline SW, rubber-band/safe-area, update banner. Reuses src/core via
  core/dataurl.ts. Build `npm run pwa:build` → .output/pwa; smoke `PWA_URL=… npx
  playwright test pwa`. **Next:** gamification (XP/streak/weekly recap), TTS of
  the simplified text (on-device), vocab from server (translations+examples) →
  vocab trainer, deploy to learn.sidelearn.pyrates.io (rsync /opt + Caddy),
  privacy-first share card; then continue the sidebar.


- [open] **Sidelearn content server** — MVP done (`server/`, FastAPI+Docker):
  daily Wikipedia pool per language, pre-baked simplifications A2–C1 + MC + vocab
  + summary via cloud LLM (OpenAI/Gemini/mock), SQLite, `/daily /lesson /archive
  /random`, CORS, Caddy-ready. Concept: `doc/tech/server.md`. Extension client (opt-in, level dropdown, local fallback) done (0.6.63). **Deployed** at
  https://api.sidelearn.pyrates.io (Gemini flash-lite, /opt/sidelearn, Caddy, port 9990).
  **Next:** archive/random UI; question/vocab tuning; monitor cost.

- [open] **Lern-App-Modus (Tageslektion)** — phases A+B done (0.6.47–0.6.52):
  dedicated `lesson.html`, paragraph-by-paragraph level-adapted reading with
  background prefetch + resume; one-click word popover (dict + merken + mehr) and
  select-to-translate; per-paragraph MC question + auto vocab extraction; daily
  challenge as a configurable set of mini-lessons with streak. **Follow-ups:**
  "gelernte Artikel"-Übersicht; feed MC results into Erfolge/Übungsquote;
  difficulty-aware article pick; free-text question option.
- [open] **Daily Challenge & Progress** — daily "Artikel des Tages" from the
  Wikipedia featured feed (`mostread` is universal across fr/de/en/nl/es; `tfa`
  only de/en), difficulty-tagged, with read/done/streak + a start-of-panel stats
  card (new vocab 7d/30d/all, quiz accuracy) and optional "einfachere Sprache"
  side-by-side. Concept: `doc/tech/daily-challenge.md`. First non-localhost
  network call → opt-in setting + onboarding/privacy note.

- [closed] **Bookmark a page + Sites view** — done (0.6.2). Follow-ups: pin
  bookmarked pages' result cache (exempt from eviction); link vocab/quiz back to
  the source page; optional pre-seed for bookmarked pages.

- [closed] **Vocab capture store** — done. `core/vocab.ts`: looked-up words
  remembered locally (★ merken + explain), listed in the panel.
- [closed] **Review test** — done. Multiple-choice from captured vocab,
  distractors from other vocab, spaced-repetition ordering, score summary.
- [closed] **Page quiz** — done. 5-question MC comprehension quiz from page text
  at CEFR level, shared Quiz UI (core/quiz.ts).
- [open] **Vocab quiz: LLM sentence mode** — cloze (no-LLM) + Wörter + Mix done
  (0.6.20). Still to add: LLM-generated sentences mixing known vocab + new words
  (with "start with words, prepare sentences in background" for latency).

## Later

- [open] **Page-adaptive theming (revisit)** — removed in 0.3.1 because card
  surfaces didn't follow page colours (unreadable). Bring back only with proper
  per-surface contrast derivation (cards/badges must adapt too). Code is in git
  history at 0.2.0–0.3.0.

- [open] **Vocabulary collection** — store looked-up words for review.
- [open] **Caching layer** — IndexedDB cache for explanations/translations.
- [open] **FLELex refinement** for French CEFR banding.
- [open] **Lemmatization** for dictionary hits on inflected forms.
- [open] **Streaming** LLM responses into the panel.
