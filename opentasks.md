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

- [open] **Chat with page context** — turn the "Freitext" box into a chat where
  the loaded page text (via Readability) is in context, so the user can ask
  questions about what they're reading. Multi-turn, history in the panel.

## Ideas (pipeline)

- [open] **Bookmark a page** — "Seite merken" button; bookmarked pages keep their
  result cache pinned (exempt from the MAX_PAGES eviction) and could optionally
  pre-seed translation/quiz. Link vocab/quiz back to the page they came from.

- [closed] **Vocab capture store** — done. `core/vocab.ts`: looked-up words
  remembered locally (★ merken + explain), listed in the panel.
- [closed] **Review test** — done. Multiple-choice from captured vocab,
  distractors from other vocab, spaced-repetition ordering, score summary.
- [closed] **Page quiz** — done. 5-question MC comprehension quiz from page text
  at CEFR level, shared Quiz UI (core/quiz.ts).

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
