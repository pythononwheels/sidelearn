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

OpenAI-compatible server, default `http://localhost:1234/v1`. Model and endpoint
live in `core/config.ts`. Start with **Gemma 3n E2B** (fast); switch to **E4B**
if quality is insufficient. Validate with `curl` before tuning prompts:

```bash
curl http://localhost:1234/v1/chat/completions -H "Content-Type: application/json" -d '{
  "model": "google/gemma-3n-e2b",
  "messages": [{"role":"user","content":"Translate to German: Le chat dort sur le canapé."}],
  "temperature": 0.3
}'
```
