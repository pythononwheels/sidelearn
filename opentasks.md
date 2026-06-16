# Open Tasks

Status: `open` · `hold` · `closed` · `archive`

## Now

- [closed] **curl-test LM Studio** — done. gemma-4-e4b: translation ~3s,
  word-JSON valid & high quality ~5.8s/111tok. Model ids corrected to gemma-4.
- [open] **Compare e2b vs e4b** — same prompts on `google/gemma-4-e2b` for the
  speed/quality trade-off; set the default accordingly.
- [open] **Real wordlists** — wire up `scripts/build-wordlists.mjs`
  (FrequencyWords + FreeDict) and replace the sample data.

## Next

- [open] **Reader view in panel** — Readability.js extraction of the source
  text, difficulty colouring in-panel, per-paragraph translation rendered
  *beneath* each paragraph (the stable backbone fallback).
- [open] **Stage 3 wiring to panel** — hover "more" should surface the LLM
  explanation in the side panel (currently fire-and-acknowledge).
- [open] **Background prefetch** — on explicit "translate page", queue
  paragraphs to LM Studio and cache results.

## Later

- [open] **Vocabulary collection** — store looked-up words for review.
- [open] **Caching layer** — IndexedDB cache for explanations/translations.
- [open] **FLELex refinement** for French CEFR banding.
- [open] **Lemmatization** for dictionary hits on inflected forms.
- [open] **Streaming** LLM responses into the panel.
