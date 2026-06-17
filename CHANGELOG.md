# Changelog

All notable changes to this project are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

## [0.6.47] — 2026-06-17

### Added
- **Lern-App-Modus (Tageslektion) — phase A.** A dedicated full-page Sidelearn
  surface (`lesson.html`, its own appier style) that turns the daily Wikipedia
  article into a guided reading lesson: paragraphs are revealed **one at a time**,
  level-adapted (simplified in the learning language), with the next paragraph
  prepared in the background while you read. "Gelesen ✓" advances; "Original
  zeigen" reveals the source text; Wikipedia is credited (logo-mark + CC BY-SA
  link). Progress and content are remembered in a new lesson store
  (`local:lessons`) so a lesson resumes where you left off.
- Launched from the daily-challenge card: **"Lektion lesen →"** is now the
  primary action (opens the app page); a small "↗ auf Wikipedia öffnen" keeps the
  raw page available.

### Notes
- New: `entrypoints/lesson/` (page), `core/lessons.ts` (store),
  `wikifeed.fetchArticleParagraphs` (full plain-text body via Action API),
  reuses `simplifyParagraph` + the `local:simplify` cache. Phase B (per-paragraph
  vocab extraction + end-of-lesson quiz, tied into Erfolge/streak) is next.

## [0.6.46] — 2026-06-17

### Added
- **Inline "Vereinfachen" reading aid.** A new toggle (next to "Markieren")
  renders, beneath each paragraph, a level-adapted version of the text **in the
  same language** (short sentences, common words — not a translation), produced
  by the local model. Paragraphs are simplified lazily as they scroll into view
  (300px look-ahead) with a small dancing-dots placeholder, and every result is
  cached per page (`local:simplify`, keyed by language+level+text) so
  re-scrolling and revisits are instant. Background simplify calls are capped at
  2 concurrent so a long page doesn't flood LM Studio. Gated on the panel being
  open and LM Studio online; off by default.

### Notes
- New: `core/simplify.ts` (cache), `core/llm/prompts.ts#simplifyParagraph`,
  `entrypoints/content/simplify.ts`, `requestSimplify` messaging, background
  concurrency limiter, `simplifyInline` setting.

## [0.6.45] — 2026-06-17

### Changed
- **Double-click the "Erfolge" title to collapse the card** (tabs and values
  hide, leaving just the header), matching the double-click-to-close gesture of
  the full views.

## [0.6.44] — 2026-06-17

### Changed
- **Emoji icons → crisp inline SVGs** in the daily-challenge and Erfolge cards:
  a concentric target (challenge / accuracy), a flame (streak) and a trophy
  (achievements), Lucide-style line icons that inherit colour via `currentColor`
  (warm flame, accent target, amber trophy). New `src/ui/icons.tsx`.

## [0.6.43] — 2026-06-17

### Changed
- **Daily challenge: "erledigt ✓" appears only after "Lesen".** The done button
  is gated on actually opening the article today (tracked per day); before that
  the read button spans the card, and afterwards it reads "Nochmal lesen →".
- **Difficulty tag is now explained on hover.** The tag carries a tooltip like
  "≈ 47 % der bekannten Wörter über A2 (von 73 geprüft)", so the
  "leicht/passt/anspruchsvoll" rating is transparent (frequency-rank share above
  the user's level).
- **Reworked the progress card into "🏆 Erfolge"** with a 7 Tage · 30 Tage ·
  Gesamt tab switcher showing two headline values per period (neue Vokabeln,
  Wörter geübt), plus a 🔥 streak chip (consecutive days the daily challenge was
  completed) and an overall 🎯 Übungsquote. Per-period values use existing
  timestamps (`ts`, `lastReviewed`).

## [0.6.42] — 2026-06-17

### Added
- **Daily Challenge (phase 1).** A start-of-panel card offers a fresh article of
  the day in the learning language, sourced from the Wikipedia featured feed
  (`tfa` where available — de/en — otherwise the universal `mostread`). The
  card shows a thumbnail, teaser and a difficulty tag ("passt zu A2" …
  "anspruchsvoll", from the existing frequency banding), a **Lesen** button
  (opens the article, marking on), an **erledigt ✓** button, and a 🔥 streak of
  consecutive completed days. Cached once per calendar day; refetched when the
  learning language changes.
- **Progress stats card.** New vocab in the last 7 / 30 days and all-time, plus
  review accuracy — all derived from the existing vocab store, no new tracking.
- **Setting `dailyChallenge`** (default on) to toggle the card. It is the only
  non-localhost network call in the extension — a public, read-only Wikipedia
  endpoint that sends no user data; turning it off keeps Sidelearn fully local.

### Notes
- New modules: `core/wikifeed.ts`, `core/daily.ts`, `core/stats.ts`,
  `core/difficulty/estimate.ts`. Concept & roadmap in
  `doc/tech/daily-challenge.md` (phases 2–3: difficulty-aware pick, "einfachere
  Sprache" side-by-side, persisted quiz stats, daily goals, badges).

## [0.6.41] — 2026-06-17

### Fixed
- **"Kein verwertbares Quiz" far less often.** Hardened the quiz parser against
  the ways small local models trip up: numeric-string / single-letter (A–D) /
  option-text answers, alternative key names (question/choices/correctIndex…),
  options given as objects, code fences and `<think>` blocks, and — most
  importantly — **truncated JSON**, where complete question objects are now
  salvaged one by one instead of failing the whole batch. Bumped the quiz token
  budget 1200 → 2000 so 5 questions rarely get cut off. On an empty result the
  raw model output is logged to the panel console for diagnosis.

## [0.6.40] — 2026-06-17

### Added
- **Hover "✓ zeigen" for already-explained words.** When a word already has an
  explanation card, the hover's "mehr →" turns into "✓ zeigen". Clicking it
  jumps the panel straight to that card — opening Übersetzungen, focusing the
  word and collapsing all other cards — even if the panel was on Chat or
  Vokabeln. No duplicate LLM call. Backed by a transient `local:focus` signal
  the hover writes and the panel watches.

## [0.6.39] — 2026-06-17

### Changed
- **Hover "mehr" confirmation** no longer says "im Panel / öffne die Sidebar" —
  the panel is always open whenever marked words are shown, so that hint was
  redundant. It now just reads "✓ gefragt" to acknowledge the click.

## [0.6.38] — 2026-06-17

### Changed
- **Tidier hover actions.** Shortened the "mehr in der Sidebar →" button to
  "mehr →" and its post-click confirmation to "✓ im Panel", and pinned both
  hover buttons to a single line (`white-space: nowrap`) so they no longer wrap
  awkwardly in the card.

## [0.6.37] — 2026-06-17

### Changed
- **Übersetzungen cards are now an exclusive accordion** — only one card is open
  at a time, so the focus is always on the current action. Opening the
  Übersetzungen section manually shows all cards collapsed; a new result (or a
  reused one) opens exactly that card and closes the rest.
- **Clicking a vocabulary word jumps into Übersetzungen** and behaves like
  marked words in the page: if an explanation already exists it is shown (no
  duplicate LLM call), otherwise a fresh card appears with the "erkläre…"
  dancing-dots spinner. Fixes the invisible background pile-up where repeated
  clicks silently queued several "erkläre…" cards.

## [0.6.36] — 2026-06-17

### Changed
- **Übersetzungen is now an inline accordion** (above Vokabeln), just like
  Vokabeln/Sites — no more full-screen Ergebnisse view. A new result auto-expands
  it (and collapses the others).
- **Click a vocabulary word** to fetch richer info from the LLM (meaning,
  example sentences, synonyms, grammar), using the word's saved sentence as
  context. The explanation appears in the Übersetzungen section.

### Changed
- Replaced the "Neues Ergebnis" banner: a new translation/explanation now **opens
  the Ergebnisse view automatically** to show it. "Übersetzungen (N)" is an entry
  in the section list (like Vokabeln/Sites) that opens the view; removed the
  separate nav button and the banner.

### Changed
- **Results moved into a full-screen "Ergebnisse" view** (card per word/sentence/
  paragraph, collapsible), reached via a nav button or the "Neues Ergebnis →
  anzeigen" banner. No longer stacked inline.
- **Consistent full-view title bar** across Chat, Quiz, Üben-chooser and
  Ergebnisse: colour-marked (accent) and rounded; **double-clicking it closes**
  the view (× still works too).
- **Spinner (dancing dots)** for loading states: page/quiz generation, the
  Seiten-Quiz button, streaming chat, and loading result cards.

### Changed
- Translating a **single word** now: titles the card with the word (not
  "Übersetzung"); reuses the local dictionary/glossary/Wiktionary-forms first
  (instant, no LLM) and only calls the model for unknown words — with a proper
  single-word prompt (fixes "stupeur" → garbage). Re-translating the same word
  replaces its card instead of stacking duplicates. Phrase cards are titled with
  the (truncated) source.

### Changed
- Vocab list CEFR badges are now neutral (light grey) instead of coloured, for a
  calmer list. The hover card keeps the colour-coded band (green→amber→red) where
  it signals difficulty while reading.

### Fixed
- Inline marking is now **per window**: it only appears in the window whose side
  panel is open, not in other windows. The panel reports its window id via a
  `panel:<windowId>` port; the content script marks only if its window (asked via
  a `whichWindow` message) is in the open set.

### Changed
- Vocab list aligned: the CEFR band now sits in a fixed left column, so words and
  translations line up cleanly (instead of badges jumping per word length).

## [0.6.29] — 2026-06-17

### Added
- Hand-gloss batches for **fr→de** (175: hyphenated forms est-ce/peut-être/
  dis-moi/tais-toi… + real words), **en→de** (85 real words), **nl→de** (191:
  many common Dutch words FreeDict lacks — hij, tijd, natuurlijk, krijgen, …).
  English contractions/slang/interjections and names skipped.

### Added
- es→de hand-gloss batch 002 (~190 entries): real high-frequency words missed by
  FreeDict + Wiktionary-forms (salvar, precio, venganza, suéltame, equivocas, …).
  Residual non-name gap 3437 → 3106.

## [0.6.27] — 2026-06-17

### Added
- **Proper-noun stoplist** (`names.json`, 6045 names): the highlighter no longer
  marks names (John, Paris, María, …) that have no translation. Built from
  Wiktionary proper nouns (pos="name") across all five languages, filtered to the
  frequency lists (`npm run data:names` + `merge-names`). 52 KB.

### Added
- Wiktionary inflection maps for **all languages**: forms-fr/nl/de/en (joining
  forms-es). Each ~144–238 KB. Resolves inflected words to their lemma for
  FreeDict translation across every learning language (no hand work; the ~1 GB
  extracts are only streamed at build time).

### Added
- **Wiktionary inflection map** (`forms-<learn>.json`): resolves inflected words
  to their lemma (tengo→tener, está→estar, dijiste→decir) and translates them via
  the existing FreeDict dictionary. Built at build time by streaming the Kaikki
  Wiktextract (`npm run data:forms`); the ~1 GB extract never ships — only a tiny
  map (es: 238 KB). Covers ~52% of the Spanish gap automatically (no hand work),
  the rest being mostly proper names. Lookup order: FreeDict → hand gloss →
  Wiktionary-form → FreeDict, so curated entries win.

### Added
- **Supplementary glossary** for frequency words FreeDict doesn't cover: hover
  now falls back to `gloss-<learn>-<native>.json` so far more marked words get an
  instant translation. Hand-authored shards in `data/gloss/<pair>/` are merged
  (`npm run data:gloss`); `npm run data:gaps` lists the words still missing.
- First Spanish→German glossary batch: ~286 high-frequency conjugated verb forms
  and function words (está, tengo, vamos, hay, del, …) that FreeDict lacks.

### Added
- Setting **"Nur Wörter mit Wörterbuch-Eintrag markieren"** (default off): when on,
  only words with an instant dictionary translation are underlined — no more
  "marked but no translation". Off keeps marking all above-level words (rare ones
  rely on the LLM "mehr"). Clarifies that marking comes from the frequency list
  while the dictionary is a separate, partial source.

### Fixed
- Spanish lemmatization now resolves **-ir verb** participles/gerunds
  (`vivido`/`viviendo` → vivir, `subido` → subir), not just -ar/-er. Verified
  against the es→de dictionary.

### Added
- **Spanish** (es) as a fifth language: frequency list + dictionaries
  (es↔de/en/fr and de/en/fr/nl→es; es→nl unavailable in FreeDict, fails soft),
  endonym/prompt names, and Spanish lemmatization (plurals, gerund/participle).

### Fixed
- Dictionary parser strips grammatical markers like `<n, f>` whose commas were
  splitting into bogus translations (regenerated all data).

### Added
- **Review modes**: clicking "Vokabeln üben" now opens a chooser — **Wörter**
  (word → translation), **Sätze** (cloze: real page sentences with a blank, fill
  from your vocab; no LLM — `core/cloze.ts`, tested), or **Mix** (interleaved).
  The last choice is remembered. Answers in any mode update the word's review
  history.

### Fixed
- Inline marks no longer break flex/grid layouts (e.g. lemonde.fr): text nodes
  whose direct parent is a flex/grid container are skipped (splitting them into
  spans would turn one item into many → column collapse).
- Vocab list is one line per word — the translation truncates with "…".

### Changed
- Review ordering now factors **accuracy**: never-reviewed first, then weakest
  (often-wrong) words, then answered-wrong-last, then least-recent. Each answer
  also tracks a correct count, so mastered words resurface least.

### Fixed
- New explanations/translations triggered while the **quiz or chat full-screen
  view is open** were invisible (stacked behind it). A banner now appears
  ("Neues Ergebnis im Panel → anzeigen") that closes the full-screen view.
- Repeated "mehr in der Sidebar" on the same word no longer stacks duplicate
  explanation cards — the existing card is replaced.

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
