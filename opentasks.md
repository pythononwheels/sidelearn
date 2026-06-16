# Open Tasks

Status: `open` · `hold` · `closed` · `archive`

## Now

- [open] **curl-test LM Studio** — verify Gemma 3n E2B speed & quality for
  word explanation + paragraph translation; decide E2B vs E4B. (doc/tech/architecture.md has the curl snippet)
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
