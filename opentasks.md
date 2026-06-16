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

## Later

- [open] **Vocabulary collection** — store looked-up words for review.
- [open] **Caching layer** — IndexedDB cache for explanations/translations.
- [open] **FLELex refinement** for French CEFR banding.
- [open] **Lemmatization** for dictionary hits on inflected forms.
- [open] **Streaming** LLM responses into the panel.
