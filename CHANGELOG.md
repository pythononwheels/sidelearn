# Changelog

All notable changes to this project are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added
- Initial project scaffold (WXT + TypeScript + Preact + Vitest).
- Central config (`core/config.ts`) and design tokens (`ui/tokens.css`).
- Difficulty banding (frequency rank → CEFR band) with unit tests.
- Instant word resolution: frequency band + bilingual dictionary (Stages 1–2).
- LM Studio client + prompt builders for word explanation (Stage 3) and
  paragraph translation (Stage 4).
- Content script: conservative inline highlighter + Shadow-DOM hover card.
- Side panel (Preact): settings, LM Studio status, paragraph translator.
- Sample frequency/dictionary data for FR and NL so the extension runs on clone.
- Docs: technical architecture, user guide, data pipeline.
- Model discovery via LM Studio native `/api/v0/models` (`core/llm/models.ts`):
  picker shows installed models, marks the loaded one + context size, sorts the
  approved `gemma-4-e2b`/`gemma-4-e4b` first; selected model persisted in settings.
- Input token budgeting (`core/llm/tokens.ts`, tested): per-call cap with
  sentence/paragraph-aware chunking for paragraph translation.

### Changed
- Corrected model ids to the `gemma-4` family (verified against a live LM Studio).
- `chat()` now takes the model explicitly and enforces the input token budget.
