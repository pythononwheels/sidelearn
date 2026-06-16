# Changelog

All notable changes to this project are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

## [0.2.0] — 2026-06-16

### Changed
- **Renamed the extension to "Sidelearn"** (fits the side-panel nature).
- Added a real extension icon (violet side-panel mark, `assets/icon.svg` → PNGs).
- Removed emojis; the header is now a full-width brand bar in our colour with an
  "S" monogram.
- **Page-adaptive panel theming**: the panel body adopts the colours of the
  currently loaded page (background/text/surface/border), while the header keeps
  the brand colour. Toggle via "An die Seitenfarben anpassen" (default on).

## [0.1.4] — 2026-06-16

### Changed
- Friendlier, warmer look: violet accent with a gradient, logo chip in the
  header, pill buttons with a soft hover lift, rounder cards, a warmer neutral
  palette, and a friendlier empty state. Colored CEFR badges in the hover card
  (A green → B amber → C red). Still restrained — assist, don't dominate.

## [0.1.3] — 2026-06-16

### Added
- Result cards now stack (newest first) and persist; each card has an × to
  remove it, plus "alle löschen". New "Ergebnisse sammeln" setting (default on)
  toggles between stacking and showing only the latest.

### Changed
- Renamed the manual box from "Absatz übersetzen" to "Freitext übersetzen"
  (paragraph translation is covered by select + right-click).

## [0.1.2] — 2026-06-16

### Added
- Lightweight per-language lemmatization for dictionary lookups: inflected words
  (e.g. "champions", "maisons", "chevaux") now resolve to their base form, so the
  hover shows a translation instead of "no dictionary entry". Instant, no LLM.

## [0.1.1] — 2026-06-16

### Added
- Initial project scaffold (WXT + TypeScript + Preact + Vitest).
- Central config (`core/config.ts`) and design tokens (`ui/tokens.css`).
- Difficulty banding (frequency rank → CEFR band) with unit tests.
- Instant word resolution: frequency band + bilingual dictionary (Stages 1–2).
- LM Studio client + prompt builders for word explanation (Stage 3) and
  paragraph translation (Stage 4).
- Content script: conservative inline highlighter + Shadow-DOM hover card.
- Side panel (Preact): settings, LM Studio status, paragraph translator.
- Real frequency + dictionary data (≈7 MB) generated from FrequencyWords and
  FreeDict for fr/de/en/nl and 6 directed dictionary pairs, committed so the
  extension works on clone.
- Docs: technical architecture, user guide, data pipeline.
- Model discovery via LM Studio native `/api/v0/models` (`core/llm/models.ts`):
  picker shows installed models, marks the loaded one + context size, sorts the
  approved `gemma-4-e2b`/`gemma-4-e4b` first; selected model persisted in settings.
- Input token budgeting (`core/llm/tokens.ts`, tested): per-call cap with
  sentence/paragraph-aware chunking for paragraph translation.

### Changed
- Inline marking now skips text inside links (`<a>`), so links stay recognisable
  and clickable.
- Prominent "Markierung an/aus" toggle in the panel (live on/off); removed the
  duplicate checkbox from settings.
- Right-click context menu on a selection: "LangLearn: übersetzen" and
  "Wort erklären" → opens the panel and shows the result. Results now flow
  through a shared storage slot (`core/result.ts`) that the panel renders.
- Hover card: fixed missing background (Shadow DOM uses `:host`, not `:root`, for
  design tokens) — now a clean white card.
- Inline highlighting no longer flags unknown words (names/foreign words), only
  words present in the frequency list and above the learner's level — far quieter.
- Panel redesign: settings collapse behind a ⚙ gear (top-right), central result
  area (translation/explanation), collapsible manual translator at the bottom.
- Corrected model ids to the `gemma-4` family (verified against a live LM Studio).
- `chat()` now takes the model explicitly and enforces the input token budget.
- **Multi-language support (fr/de/en/nl)** with selectable native + learning
  language. First-run onboarding asks native language, learning language and
  level. Dictionaries are now directed (`dict-<learn>-<native>.json`); frequency
  lists are per language (`freq-<learn>.json`). Prompts adapt explanation
  language to the native language. Missing dictionary pairs fail soft.
