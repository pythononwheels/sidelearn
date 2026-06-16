# Architecture

LangLearn is a Manifest V3 browser extension that helps you read pages in a
language you are learning (FR/NL) with German reading aids, powered entirely by
a **local** LLM (LM Studio). Nothing leaves your machine.

## Design principle

> We assist, we don't dominate.

Easy words recede (muted grey), challenging words gently stand out. The LLM is
only invoked on explicit user action — reading and hovering stay instant.

## The escalation ladder

| Stage | Trigger | Source | LLM? | Latency |
|------:|---------|--------|:----:|---------|
| 1 | word detected on load | frequency band (`data/freq-<lang>.json`) | no | instant |
| 2 | hover over a word | dictionary (`data/dict-<lang>.json`) | no | instant |
| 3 | "more" in the hover card | LM Studio → side panel | yes | on-demand |
| 4 | select a paragraph | LM Studio → side panel | yes | on-demand |

Stages 1–2 never touch the model, so browsing stays fluid. Only 3–4 call
LM Studio, and only on an explicit click.

## Two surfaces

- **Side panel = stable backbone.** Settings, status, paragraph translation,
  and (next) a Readability-based reader view of the source text with the
  per-paragraph translation rendered *beneath* each paragraph.
- **Inline layer = optional "Kür".** Highlights challenging words on the live
  page with a Shadow-DOM hover card. Fragile on hostile/SPA pages by nature, so
  it is conservative (text nodes only, skips inputs/code/editable) and fully
  toggleable. When off, everything still works via the panel.

## Components

```
src/
  core/                  framework-agnostic, unit-tested logic (single source of truth)
    config.ts            central config: LM Studio endpoint/model, lang pairs, defaults
    settings.ts          persisted settings (WXT storage)
    messaging.ts         typed message contract (content ↔ background ↔ panel)
    types.ts             shared data shapes
    difficulty/
      banding.ts         frequency rank → CEFR band; is-above-level  (tested)
      frequency.ts       lazy-loaded rank tables
    dict/freedict.ts     lazy-loaded bilingual dictionary
    llm/
      lmstudio.ts        minimal OpenAI-compatible client
      prompts.ts         explainWord (Stage 3) + translateParagraph (Stage 4)
    wordinfo.ts          combines band + dict into WordInfo (Stages 1–2)
  entrypoints/
    background.ts        service worker; ONLY context that calls LM Studio
    content/             inline highlighter + Shadow-DOM hover
    sidepanel/           Preact UI
  ui/tokens.css          design tokens — the single source of truth for the look
```

## Difficulty model

There is no clean, free CEFR word list for every language, but CEFR vocabulary
size correlates strongly with frequency rank. We bucket the rank into bands
(`banding.ts`, `RANK_THRESHOLDS`). This is a tunable heuristic.

- **French** can later be refined with **FLELex** (UCLouvain), a real
  CEFR-graded FFL lexicon.
- **Dutch** has no comparable open resource, so frequency is the common
  denominator.

Unknown words (not in the frequency table) are treated as the hardest band so
rare words still get flagged — fail-soft, never blocks reading.

## LM Studio

Two endpoints are used:

- **`POST /v1/chat/completions`** (OpenAI-compatible) — the chat API. We use
  role-based messages (system + user); Gemma is chat-tuned, so this is the right
  choice over the legacy `/v1/completions` (raw-prompt) API.
- **`GET /api/v0/models`** (native REST) — richer than `/v1/models`: reports
  `state` (loaded/not-loaded), `max_context_length`, `loaded_context_length`
  and capabilities. Used to populate the model picker (`core/llm/models.ts`).

**Streaming:** non-streaming (`stream:false`) for now — the word explanation is
parsed as JSON anyway. Streaming is planned only for paragraph translation, to
show text progressively in the panel.

**Models:** the picker lists installed generation models, sorts our tested &
approved ones first (`APPROVED_MODELS` in `core/config.ts` — currently
`google/gemma-4-e2b`, `google/gemma-4-e4b`), marks the loaded one and shows its
context size. Others can still be picked but are flagged "ungetestet". The
chosen model id is persisted in settings and passed through every call.

**Token budget:** `LM_STUDIO.maxInputTokens` (default 5000) caps input per call
to keep latency and RAM bounded. `core/llm/tokens.ts` estimates tokens (~4 chars
each) and `splitForBudget()` chunks oversized selections on sentence/paragraph
boundaries; `chat()` throws if a single call still exceeds the budget.

Validate with `curl` before tuning prompts:

```bash
curl http://localhost:1234/v1/chat/completions -H "Content-Type: application/json" -d '{
  "model": "google/gemma-4-e4b",
  "messages": [{"role":"user","content":"Translate to German: Le chat dort sur le canapé."}],
  "temperature": 0.3
}'
```
