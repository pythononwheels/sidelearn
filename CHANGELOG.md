# Changelog

All notable changes to this project are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

## [0.6.17] — 2026-06-17

### Fixed
- Inline marks broke the layout on some sites (e.g. lemonde.fr) whose own `span`
  CSS (inline-block, margins, font-size tricks) applied to our wrapper spans.
  Marks are now hardened with `!important` resets (inline, no margin/padding,
  baseline, inherited font/spacing) so only our underline shows.

### Fixed
- **"Seite übersetzen" showed nothing**: a panel-triggered translate had its page
  key resolved by the service worker's own active-tab query, which is unreliable
  (no "current window"), so the result was stored under a key the panel wasn't
  showing. The panel now passes its current page key explicitly, and the SW
  fallback uses `lastFocusedWindow`.

### Added
- **Chat is now saved per page** (`core/chatstore.ts`): the conversation persists
  when you close and reopen the chat, scoped to the page URL like the result cache.

### Changed
- Clicking the chat **title** also closes the chat (not just the ×).

### Changed
- **Chat is now a full-height view** (opened via the new "Chat" action button):
  the panel fills the viewport, the title stays at the top, the message area
  scrolls in the middle, and the input + send stay pinned at the bottom. The
  marking row and action nav hide while chatting for more room; × closes it.
  Chat is no longer an accordion section.

### Fixed
- Chat textarea overflowed the panel (width:100% + padding without border-box).
  Added global `box-sizing: border-box`.

## [0.6.12] — 2026-06-17

### Changed
- Chat answers **render Markdown** once streaming finishes (bold, lists,
  headings, code; raw text while streaming) via a small safe renderer
  (`core/markdown.ts`, HTML-escaped, tested).
- Each message shows a **sender label** ("Du"/"Tu"/… for you, the model name for
  the answer); the **"↦ auf <Muttersprache>"** action is now a badge.
- Chat input is 5 rows with the send button flat beneath it.

### Changed
- Tighter, flatter UI: chat send button moved below the textarea (right-aligned,
  flatter), and reduced vertical padding across nav buttons, marking toggle,
  star, colour button and section headers; smaller panel gaps.

### Fixed
- Settings added after a user's first run are now backfilled with defaults
  (getSettings/watchSettings merge over DEFAULT_SETTINGS). Fixes the blank
  underline-colour button (markerColor was undefined for existing users) and
  any future new-setting gaps.

### Changed
- **Chat improvements**: replies stream token-by-token (`chatStream`, LM Studio
  SSE; the model's reasoning is ignored, only the answer streams). The assistant
  answers in the **learning language at the user's level** by default — the user
  can override it in their message. The message list now scrolls and auto-sticks
  to the bottom. Each finished answer has a **"↦ auf <Muttersprache>"** button to
  translate it. Send button is more compact.

### Added
- **"＋ Wörter von Seite"** in the Vokabeln section: collects a level-appropriate
  mix of vocabulary from the current page into the list — ~10 at level, 6 one
  level up, 4 two up (frequency bands; instant, no LLM). Skips already-saved words
  and words without a dictionary translation. `core/collect.ts` (tested).

### Changed
- Vokabeln, Chat and **Sites are now one exclusive accordion** (collapsed by
  default; opening one closes the others and scrolls it into view). Sites is no
  longer a confusing full-panel takeover — it's a section like the others.

### Added
- **Underline colour adapts to dark pages**: "Auto" picks a bright underline on
  dark backgrounds (page luminance) and the violet on light ones. Plus a colour
  quick-pick next to the marking toggle (Auto + 5 fixed hues), saved in settings.
  Underline also a touch thicker for visibility.

### Added
- **Right-click a link → "Sidelearn: übersetzen" / "Wort erklären"** (context now
  includes links): translates the link's text. Makes link-heavy pages (news/
  aggregators) usable without selecting text.

### Fixed
- **Bookmarking a second page failed** when colour extraction via scripting was
  blocked on that tab — the error aborted the whole save. Scripting is now
  wrapped in try/catch (bookmark saves without a colour), and host permissions
  for http/https make panel scripting (page text, bookmark colour, quiz) reliable
  across tabs instead of depending on per-tab activeTab.

### Fixed
- Made "panel closed → markings off" robust against service-worker restarts: the
  background clears the open-flag on startup, and the panel reconnects its port if
  the worker recycles — so markings never linger after the panel is gone, and
  reappear correctly when it's open.

## [0.6.3] — 2026-06-16

### Changed
- "Freitext übersetzen" is now **"Chat zur Seite"**: a multi-turn chat with the
  page text in context (`core/chat.ts`). Ask about the article, request
  translations, etc. Runs in the panel; page text + history capped to the input
  budget; the chat resets per page. Replaces the one-shot translate box.

### Added
- **Bookmarks + Sites view**: a ☆/★ toggle in the action bar remembers the
  current page (title, favicon, theme-color). A "🔖 Sites" button opens a list of
  bookmarked pages as cards (favicon, title, domain, colour accent); clicking a
  card opens it in a new tab, × removes it. `core/bookmarks.ts`.

### Added
- **Per-page result cache**: results are keyed by page URL. A fresh page shows an
  empty panel; returning to a known page restores its last results. The panel
  follows tab switches and navigation (needs the `tabs` permission).
- Result cards are **collapsible** via their title bar.
- Tooltip on "Vokabeln üben" explaining what it does and the 4-word minimum.

### Added
- **Seiten-Quiz**: generates a 5-question multiple-choice comprehension quiz
  about the current page at the learner's CEFR level (`core/quiz.ts`, tolerant
  JSON parse tested). Runs in the panel (direct LM Studio call) and reuses the
  quiz UI. The vocab review and the page quiz now share one generic `Quiz`
  component.

### Changed
- Inline marking is now tied to the side panel: **closing the panel removes the
  markings**, reopening restores them (tracked via a runtime port). This also
  keeps "mehr in der Sidebar" consistent — it only acts while the panel is open.

## [0.5.1] — 2026-06-16

### Changed
- Word explanations now include the **sentence context** (hover "more" sends the
  sentence; right-click uses the selected phrase). Fixes wrong meanings for
  participles/inflections like "utilisant" → contextual sense instead of a
  literal nominalization.
- French lemmatization handles participles (`-ant`, `-é/-ée/-és/-ées` → `-er`),
  so "utilisant" now resolves to "utiliser" in the dictionary.

### Added
- **Action nav** in the panel: "Vokabeln üben", "Seite übersetzen", and a
  "Seiten-Quiz" placeholder (disabled, coming soon).
- **Seite übersetzen**: pulls the active page's main text (`<article>`/`<main>`
  → body, capped) via scripting and translates it into the panel as a
  "Seitenübersetzung" card.
- "Vokabeln üben" moved from the vocab section into the nav.

## [0.4.0] — 2026-06-16

### Added
- **Multiple-choice review** of captured vocabulary (`core/review.ts`, tested).
  "▶ Üben" in the Vokabeln section starts a session: word → pick the translation,
  4 options with distractors drawn from your other vocab (instant, no LLM),
  correct/wrong feedback, score summary. Spaced-repetition ordering
  (never-reviewed → wrong-last → least-recent); each answer updates the entry's
  review history. Needs ≥4 saved words.

## [0.3.1] — 2026-06-16

### Changed
- Header reworked: no purple bar. `FR → DE` and the level are small badges,
  LM-Studio status badge stays, gear is larger and plain (no badge).

### Removed
- Page-adaptive panel theming (made cards unreadable — the card surfaces didn't
  follow the page colours). Removed for now; revisit with proper card-contrast
  derivation. (`core/theme.ts`, `content/pagetheme.ts`, the `adaptToPage` setting.)

## [0.3.0] — 2026-06-16

### Added
- **Vocabulary capture store** (`core/vocab.ts`): looked-up words are remembered
  locally (chrome.storage.local, deduped, newest-first, capped). Captured on a
  new **★ merken** button on the hover card (instant) and on explicit "Wort
  erklären". A "Vokabeln (N)" section in the panel lists them with band, main
  translation, per-item × and "alle löschen". Foundation for review + quiz.

## [0.2.1] — 2026-06-16

### Changed
- Header no longer duplicates Chrome's own side-panel title bar: the brand bar
  now shows the learning context (e.g. `FR → DE · A2`) instead of repeating the
  name/logo. LM status reads "LM Studio"; the gear is larger.

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
