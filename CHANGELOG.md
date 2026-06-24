# Changelog

All notable changes to this project are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [0.6.92] — 2026-06-24

### Added (Learny)
- **Vokabeltest: „Weiß nicht"-Button** + nach jeder Antwort eine **ausführliche
  Worterklärung** (alle Bedeutungen · Wortart · Beispiel FR/DE · Alternativen) aus
  richdict. „Weiß nicht" deckt die richtige Lösung auf und zählt als nicht gewusst.

## [0.6.91] — 2026-06-24

### Changed (Learny) — Lernpfad-Redesign + passives Vokabellernen
- **„Lernroute" → „Lernpfad".** Fertige Etappen zeigen jetzt **was man geschafft hat**:
  „Sprachniveau A2.3 · 50 Wörter · 5 Artikel · Check ✓" (statt nur „geschafft"),
  via neuen Milestone-Speicher (`pwa/milestones.ts`, Snapshot beim Etappen-Check).
- **Verspieltere Optik**: Karten wechseln links/rechts an einer zentralen Linie.
- **Klarere Labels**: „Neue Wörter für A2.4 · beim Lesen & im Vokabeltest";
  „Etappentest" → „Etappen-Check · kurzer Test über die neuen Wörter"; Home-Subline
  zeigt das Sublevel („A2.4 · 0/50 neue Wörter").
- **Passives Vokabellernen**: Beim Lesen einer Tageslektion (und im Lückentext)
  werden die **Next-Level-Zielwörter, die im Text vorkommen**, automatisch als
  SRS-Kontakt gewertet (+1 Box) — mit Referenz auf den Text. Der Fertig-Screen zeigt
  „+N neue Wörter aus diesem Artikel gelernt". Lesen & Lückentext speisen so das
  Wochenziel mit (neu: `srs.encounter`, Wort-Scan via normalize/lemmaCandidates/forms).

## [0.6.90] — 2026-06-24

### Changed (Learny) — vokabel-getriebene Progression (SRS + i+1)
- **Levelaufstieg läuft jetzt über Wortschatz, nicht Aktivitäten.** Ein Level = 10
  Etappen (≈ 1 Woche). Jede Etappe bekommt einen Batch von ~50 **Next-Level-
  Zielwörtern** (i+1); der **Vokabeltest ist jetzt eine Spaced-Repetition-Session**
  (fällige Wiederholungen + neue Zielwörter, Leitner-Boxen). Sitzt der Wochen-Batch,
  schaltet der **Etappentest** frei (1×/Woche). Behebt „Etappentest nach 1 Artikel".
- **Tageslektion (2 Artikel/Tag) bleibt** Lesegewohnheit & i+1-Quelle, treibt die
  Route nicht mehr; SRS-Spacing taktet ~1 Etappe/Woche.
- **Etappentest** prüft die just gelernten Etappen-Zielwörter; **Aufstiegstest**
  prüft die Next-Level-Zielwörter des Levels (≥70 %) → man wird A2 nur, wer A2-Wörter
  kann. Home/Report/Lernroute zeigen das Wochenziel „X/50 neue Wörter".
- Neu: `pwa/srs.ts` (Leitner) + Deck-SRS-Felder; `nextLevelTargets()` aus richdict;
  `route.ts` auf Etappen-/Wortziel-Modell umgebaut (alte Node-Route migriert).

### Offen
- Lückentext: Next-Level-Zielwörter als i+1-Distraktoren einmischen (Folge-Schritt).

## [0.6.89] — 2026-06-23

### Changed (Learny)
- **Progression klarer**: Der Home-Balken zeigt jetzt den **Level-Fortschritt**
  (node/30, „A2 → B1") statt des Etappen-Drittels — 1 Artikel + 1 Vokabeltest sind
  ~7 %, nicht 67 %. **Freie Reads (Artikelrubriken/Kurzfassung) geben XP, treiben
  aber die Lernroute nicht** (nur Tageslektion + Übungen/Tests).
- **Vokabeltest = Multiple Choice**: „Was bedeutet X?" mit 4 Optionen (richtige
  Bedeutung + 3 Distraktoren aus dem Pool), auto-bewertet, Beispielsatz danach —
  statt Selbsteinschätzung „Gewusst/Nochmal".

### Added (Learny) — reiches, leveled Wörterbuch
- **richdict-<lang>-de.json** (fr/es/en/nl/it, je bis ~6000 Wörter, CEFR-gebandet):
  pro Wort 1–3 Bedeutungen mit **Wortart + Beispiel (Lernsprache + Deutsch)** —
  offline, gecacht. **Bedeutungen grounded auf FreeDict** (kein Halluzinieren im
  Kern), Beispiele/Wortart/Reihenfolge per LLM (gemini), dominante Alltagsbedeutung
  zuerst (behebt z. B. „pas → nicht" statt „Schritt").
- Wörterbuch zeigt reiche, aufklappbare Einträge; **WordPopover** nutzt zuerst das
  Offline-richdict (instant), Server-/translate nur als Fallback. Vokabeltest/Seed
  ziehen den Primär-Sense aus richdict.
- **Italienisch-Offline** komplett: `freq-it`, `forms-it`, `dict-it-de` (FreeDict)
  + `richdict-it-de` — Wörterbuch & Vokabeltest funktionieren jetzt auch auf Italienisch.

## [0.6.88] — 2026-06-23

### Added — Kurzfassung (digest) read mode for area articles
- **Artikelrubriken (ab A2): Auswahl „Ganzer Artikel" vs „Kurzfassung"**. Die
  Kurzfassung ist eine kompakte, eigenständige Summary (Länge level-skaliert via
  `SL`/`config.DIGEST_WORDS`: A2≈80 … C1≈170 Wörter) mit **3 Verständnisfragen
  am Ende**. Wort-Antippen wie beim Lesen. A1 bleibt ganzer Artikel.
- Server-Prep erzeugt für Area-Artikel (A2+) zusätzlich `digest` +
  `digest_questions` (gilt für neu gebaute / on-demand geholte Artikel). Daily-
  Lektionen unverändert; bleibt lernsprachen-intern (kein Native-Bake).
- Fehlt der Digest (alter Pool-Artikel), erzeugt der Server ihn **lazy beim ersten
  Aufruf** (`/digest/{id}`, `llm.digest_only`, gecacht in der prepared-Zeile) — so
  ist jeder Area-Artikel sofort als Kurzfassung lesbar. Fallback auf „Ganzen
  Artikel lesen", falls die Generierung scheitert.

## [0.6.87] — 2026-06-23

### Changed (Learny)
- **Home: 4 Kacheln (2×2)** — Artikelrubriken · Lückentext · Vokabeltest · Wörterbuch
  (vorher 3: Zufall/Lückentext/Vokabeln).
- **Vokabeltest ist nie mehr leer**: Karten = deine Merkwörter, mit
  level-passenden Stufenwörtern auf 12 aufgefüllt.

### Added (Learny)
- **Wörterbuch** (neu): durchsuchbare Wortliste mit Übersetzung + CEFR-Badge,
  Umschalter „Alle" (Stufenwörter kumulativ bis Level, ~150) ⇄ „Meine"
  (Merkwörter); Stern zum Merken/Entfernen. **Suche fällt aufs komplette
  gebündelte Wörterbuch zurück**, wenn das Wort nicht in der Stufenliste ist —
  jedes Wort bleibt findbar und merkbar.
- **Seed-Wortschatz** (`pwa/seedvocab.ts`): zur Laufzeit aus den gebündelten
  freq + dict/gloss Daten gebaut (kein Extra-Payload), CEFR-gebandet, 2-Buchstaben-
  Glue-Wörter ausgefiltert. Sprachen ohne Offline-Daten (it) → leer + Hinweis.

## [0.6.86] — 2026-06-23

### Added — Italian (it)
- **Italienisch als Lernsprache** (`it` → LANGUAGES, „Italiano"/„Italian").
  Server: `LANG_NAMES["it"]`, italienische Seed-Begriffe für alle 7
  /surprise-Rubriken in `wiki.py`; Daily-most-read läuft über `it.wikipedia.org`.
  Pseudowörter (Vokabel-Test) für `it` ergänzt.
- Offline-Daten (freq-it / dict-it-de / forms-it / gloss-it-de) folgen separat;
  bis dahin nutzt das Wort-Antippen den Server-`/translate`-Fallback.

## [0.6.85] — 2026-06-23

### Changed (Learny)
- **Home-Fortschritt klarer**: statt „% bis zum nächsten Ziel" jetzt ein
  Level-Aufstiegs-Balken (z. B. `A2.1 ▰▰▱▱ A2.2`) plus klarer Untertitel
  „Etappe X/10 im Level A2 · Tagesziel Y/Z". Der Ring um Gurki zeigt den
  Level-Fortschritt (Etappe innerhalb des Levels).

### Added (Learny)
- **Daten · Sicherung in Einstellungen**: Export aller lokalen Daten (Streak,
  Route, Vokabeln, Settings) als `learny-backup-YYYY-MM-DD.json` und Re-Import
  — für App-Löschen oder Handywechsel. Alles bleibt lokal (privacy-first).

## [0.6.84] — 2026-06-23

### Changed (Learny)
- **Daily-Challenge: 5 Pflichtabsätze** statt 8. Nach 5 Absätzen „Challenge
  erfüllt!" (zählt als Tageslektion-Schritt) mit Weiterlesen (3 Bonus-Absätze,
  Bonus-XP) / Nächster Artikel / Zur Übersicht.
- **App-Icon = Gurki** (Gurke auf Jelly-Verlauf), alle Größen + Apple-Touch;
  Theme-Color pink.
- Admin /stats: beide „Pro Tag"-Charts links bündig (gleiche Y-Achsen-Breite).

## [0.6.83] — 2026-06-23

### Added — more rubrics + prebuilt /surprise area pool
- **4 new Zufallsartikel-Rubriken**: Stars & Gesellschaft, Natur & Tiere, Kultur,
  Wissenschaft (7 total). New SurpriseView tiles + icons.
- Server **area pool**: the daily build now tops up ~2 new articles per rubric &
  language (`SL_AREA_TOPUP`), prepared for all levels and stored in a new
  `area_pool` table; **`/surprise` serves instantly from the pool** (LLM
  on-demand only as fallback). Capped via `SL_AREA_DAILY_CAP`.

## [0.6.82] — 2026-06-23

### Added (Learny) — translation on quizzes & cloze
- An **"Übersetzung"** button under each quiz/cloze prompt translates the
  sentence/question into your native language on demand (cloze keeps the blank).
  Server `/sentence` endpoint (cached, capped); hidden when learn == native and
  for vocab-meaning questions (already native).

## [0.6.81] — 2026-06-23

### Changed (Learny PWA)
- Jelly theme: **Mint-Air background** (cool mint→lavender gradient) and a calmer,
  less "bubbly" feel — flatter buttons, softer/recoloured hero blobs, thinner ring.

## [0.6.80] — 2026-06-23

### Changed (Learny PWA) — Jelly polish to match the mock
- Jelly: **purple progress ring** (pink stays for buttons/bubble) and
  **multi-colour tile icons** (lime / sky / grape) like the design mock.
- Home route start now shows a real **flag "Los geht's" node** (no empty slot).

## [0.6.79] — 2026-06-23

### Changed (Learny PWA) — new bold theme set
- Replaced the old 5 palette themes with **3 bold, light designs**: **Jelly**
  (glossy, default), **Knister** (ink outlines + hard shadows, Fredoka), **Comic**
  (halftone dots + black outlines, Bangers). A retired saved theme auto-migrates
  to Jelly. Added Archivo + Bangers fonts.

## [0.6.78] — 2026-06-23

### Changed (Learny PWA)
- Home route preview back to a **vertical** short segment (previous · current ·
  next, Duolingo-style) with a "Los geht's" cap at the very start.

## [0.6.77] — 2026-06-23

### Changed (Learny PWA) — Jelly Deluxe look + horizontal route preview
- New **Jelly Deluxe** theme (default for new installs): glossy gradient buttons
  & bubble, soft 3D cards/tiles, glow ring, pink/purple palette, Baloo 2 +
  Quicksand fonts. Selectable in Settings → Theme (first card).
- **Home route preview** is now a horizontal segment centred on the current node
  (done · done · Gurki · locked · locked) with start/end caps so there's always
  context; tap the current node / label to start it.

## [0.6.76] — 2026-06-22

### Changed (Learny PWA)
- **Lernroute-Vorschau auf Home**: kurzer vertikaler Abschnitt (vorheriger ·
  aktueller mit Gurki · nächster Knoten) statt der CTA-Zeile; aktueller Knoten
  ist antippbar und startet die passende Aktivität, Kopf führt zur vollen Route.
- **Sprüche**: kontextabhängige Bubble (Tagesziel / fast geschafft / Begrüßung),
  erweiterte Liste; „Komm, wir lesen was Neues." statt „… was Cooles.".

## [0.6.75] — 2026-06-22

### Added (Learny PWA)
- **Version display in Settings** (injected at build via `__APP_VERSION__`) plus a
  **"Auf Updates prüfen"** button that asks the service worker to check; a real
  update still surfaces via the existing update banner.

## [0.6.74] — 2026-06-22

### Added (Learny) — 10-Etappen progression, Lernroute, A1
- **A1 level** end-to-end: server supports A1 (`SL_LEVELS`, prompt) and prepares
  any allowed-but-unbuilt level **on demand** in `/lesson` (cap-guarded); A1
  selectable in onboarding/settings (default stays A2).
- **New progression model** (`pwa/route.ts`, replaces the 3-Etappen `progress.ts`):
  each level = **10 Etappen × 3 typed nodes** (Artikel → Vokabel/Lückentext →
  Etappentest), with a full **Aufstiegstest** at Etappe 10 → level-up. Nodes are
  completed by doing the matching activity. Migrates old `sl_pwa_stage` data.
- **Lernroute redesign:** vertical typed-node path, grouped into 10 Etappen
  (chest per Etappe), states done/current/locked, **auto-centred on the current
  node**, Gurki at the current step; tap the current node to launch its activity.
  Home shows the next step; ring reads "Etappe X/10 · % bis zum nächsten Ziel".
- **Etappenabschlusstest:** quick 5-question mixed check (≥4/5 to pass) at each
  Etappe end; the per-correct mastery-points system is removed.

## [0.6.73] — 2026-06-22

### Changed (Learny PWA) — Home redesign + mascot
- Introduced **Gurki**, the pickle mascot (`src/public/gurki/*.png`, transparent),
  shown in the home hero.
- **Home redesign** (unified "Knuddel" look): XP + streak pills top-right,
  progress **ring around Gurki** with "Tag N — stark!" + "X % bis zum nächsten
  Ziel", a motivation **speech bubble**, a compact **Tageslektion card** (Start /
  Weiter) and three action tiles (Zufall / Lückentext / Vokabeln) with custom
  SVG icons (no emojis), plus the Lernroute CTA.

## [0.6.72] — 2026-06-22

### Added (Learny PWA)
- Tasteful **confetti**: a small pop on every correct answer (reading quiz, cloze,
  vocab trainer, level-test) and a bigger burst on milestones (daily goal reached,
  Etappen-Test passed / level-up). Dependency-free, honours
  `prefers-reduced-motion`, kept deliberately restrained.

## [0.6.71] — 2026-06-22

### Added (Learny PWA) — Phase C
- **Lernroute** — a vertical Duolingo-style journey of what you've read and how
  your Etappen-Tests went. A pulsing "next action" node at the top (Tageslektion
  or Etappen-Test), then your history (lessons, test pass/fail, level-ups) on a
  connected timeline with type icons. Reachable from Home and Report.
- On-device **activity log** (activity.ts) feeding the route; lessons and tests
  log automatically.

## [0.6.70] — 2026-06-22

### Added (Learny PWA) — Phase B
- Each paragraph now asks **one randomly chosen question type** — comprehension
  quiz (from prep), **vocab-meaning MC**, or **cloze MC** — with no two same types
  in a row, and a type label (Verständnis / Vokabel / Lückentext). All built
  client-side from the dictionary + frequency data; no extra LLM calls.

## [0.6.69] — 2026-06-22

### Changed (Learny PWA) — Phase A
- Swept remaining emojis to consistent SVG line icons (onboarding, done screens,
  hint bulb, ★ merken, 🎯 test button); success screens get a sparkles badge.
- Lesson done-screen is now gamified with the daily progress ("X von Y der
  Tageslektion geschafft") and direct buttons: **Nächster Artikel →** (opens the
  next unread daily article) and **Zur Übersicht**.

## [0.6.68] — 2026-06-22

### Added (Learny PWA) — staged learning progress + Etappen-Test
- Each CEFR reading level is split into **3 Etappen** (e.g. A2·1 → A2·2 → A2·3 →
  B1·1 …). An Etappe fills with mastery points earned by reading lessons,
  correct quiz/cloze answers and saved words; at 100 % the **Etappen-Test**
  unlocks (shown on the Report tab with a progress bar).
- **Etappen-Test** has two parts: a **Yes/No vocabulary check** (real words at the
  level + pseudo-words as a reliability control) and a short **reading
  comprehension** (MC + cloze from a level-appropriate lesson). Passing both
  advances one Etappe; crossing the third raises the reading level.
- All on-device; vocabulary sampling uses the bundled frequency data. No new
  server calls (reading reuses /daily + /lesson).

## [0.6.67] — 2026-06-22

### Changed (Learny PWA)
- Quick-action tiles and the Zufallsartikel area picker now use consistent SVG
  line icons (in soft accent chips) instead of emojis.
- Added a small source-credit line under the daily list: "Aus den
  meistgelesenen Wikipedia-Artikeln des Tages · CC BY-SA".

## [0.6.66] — 2026-06-22

### Added (Learny PWA)
- **Zufallsartikel nach Bereich** — Home tile + area picker (Technik / Sport /
  Geschichte). Picks a random topical Wikipedia article via relevance search,
  prepares it on demand for your level on the server, and opens it as a lesson.
  Results are cached server-side, so the pool grows into a reusable library.
- **Lückentext (Cloze)** — Home tile. Builds fill-in-the-blank questions from the
  day's prepared lesson text (real sentences, multiple-choice from the lesson's
  vocab + your saved words). Awards XP. No LLM (instant, on-device build).

### Added (server)
- `GET /surprise?lang&level&area` — random topical article, prepared on demand,
  returned as a lesson. Capped per day (`SL_SURPRISE_DAILY_CAP`, default 200) as
  a cost guard; cached repeats are free.
- `GET /areas` — lists the topic areas and the languages each supports.

## [0.6.65] — 2026-06-19

### Changed
- **Daily challenge now uses the central Sidelearn server by default.** When the
  server has content for your language/day, the sidebar's daily challenge is the
  pre-baked set (instant, multi-level); if the server has nothing for that day or
  is unreachable, it **falls back to the local Wikipedia pipeline** automatically.
  Toggle "Lektionen vom Sidelearn-Server" off for local-only. The daily card
  shows the active reading level (server level when central).

## [0.6.64] — 2026-06-18

### Fixed
- Default content-server URL corrected to `https://api.sidelearn.pyrates.io`
  (the `.io` host; `.org` does not exist).

## [0.6.63] — 2026-06-18

### Added
- **Content-server integration (opt-in).** New setting "Lektionen vom
  Sidelearn-Server" + server URL + reading level. When on, the daily card and
  lessons come **pre-baked** from the server (instant, no local model needed) and
  the lesson gains a **level switcher** (A2/B1/B2/C1) — "same article in B1". Off
  or unreachable → falls back to the local Wikipedia + LM Studio pipeline.
  Personal/interactive features (hover, chat, page translate) always stay local.
- **Sidelearn content server** (`server/`, FastAPI + Docker) that pre-bakes the
  daily Wikipedia lessons (simplified A2–C1 + per-paragraph MC question + vocab +
  summary). Provider-agnostic cloud LLM (Gemini/OpenAI/`mock`), default
  `gemini-2.5-flash-lite`; uses the new `google-genai` SDK. Read-only, no auth,
  native-language-agnostic — only public Wikipedia content. Endpoints `/daily`,
  `/lesson/{id}`, `/archive`, `/random`. Concept: `doc/tech/server.md`.
  End-to-end verified: the extension renders a pre-baked server lesson.

## [0.6.62] — 2026-06-18

### Changed
- **Lessons are now a bite-sized excerpt.** Long articles (some have ~100
  paragraphs) are capped at the first 8 paragraphs so a daily lesson stays
  ~5–10 min and the "read 2 of 4" goal is achievable; the header marks it
  "· Auszug" and the full article stays one click away (Wikipedia link).

## [0.6.61] — 2026-06-18

### Changed
- **"dein Niveau" → "dein Sprachniveau"** in the daily card, with a small level
  badge (e.g. A2) shown inline.
- **Lesson header reframes the difficulty tag** as the *original* article's level
  and the target: "Original anspruchsvoll → vereinfacht A2" (instead of a lone
  "anspruchsvoll" over already-simplified text).

## [0.6.60] — 2026-06-18

### Changed
- **Daily challenge reworked into "choose N of M".** The card now explains the
  goal ("Lies 2 von 4 Artikeln … wir vereinfachen sie vorab auf dein Niveau")
  and lists the day's article pool (2× the goal) to pick from; finishing any
  `goal` of them as lessons completes the day. Per-article state (läuft / ✓ /
  lesen). The difficulty tag is gone — moot once we simplify to your level.
- **Lesson words translate on hover** (with click as a fallback), matching the
  hover behaviour of marked words on live pages, instead of requiring a click;
  the popover stays while the cursor is on the word or the card.

### Tooling
- **Screenshot review run** (`tests/e2e/screens.spec.ts`) capturing every surface
  in dark + light into `tests/e2e/__screens__/` (gitignored) for visual review.
- **Playwright E2E harness** (`tests/e2e/`) that loads the built MV3 extension
  (`launchPersistentContext` + `--load-extension`) and drives the real side panel
  via its `chrome-extension://…/sidepanel.html` URL. A seeded smoke suite covers
  the regressions we hit by hand: opens on the Lernen/Surfen chooser, Lernen
  shows the daily card, reload returns to the chooser, Surfen shows the tools.
  Run with `npm run e2e:install` (once) then `npm run test:e2e`. Storage is
  seeded through the service worker, so the smoke run needs neither Wikipedia nor
  LM Studio.

## [0.6.59] — 2026-06-18

### Changed
- **UI consistency pass** (from a dark+light screenshot review of every surface):
  - "Sites" section header no longer uses the lone 🔖 emoji — consistent with the
    other (icon-less) section headers.
  - Daily-card teaser no longer shows doubled punctuation ("Munich.…"); it trims
    and only adds an ellipsis when actually truncated.
  - In the lesson, capitalised words (almost always proper nouns like
    "Palace"/"Crystal") are no longer underlined or auto-collected as vocab — for
    every learning language except German, where common nouns are capitalised.

## [0.6.58] — 2026-06-18

### Changed
- **The panel always opens on the Lernen/Surfen chooser** again. The mode is no
  longer persisted across opens (it only lives for the session, kept across tab
  switches while the panel stays open) — so every fresh open starts at the
  landing screen.

## [0.6.57] — 2026-06-18

### Fixed
- **Daily card empty on a new day.** The Wikipedia featured feed for "today" can
  404 early in the day, returning no articles and leaving the learn view with
  only "Vokabeln üben". The fetch now **falls back to yesterday's feed** (whose
  `mostread` always exists), logs failures, and the card shows a
  "lädt…/Erneut versuchen" state instead of disappearing.

## [0.6.56] — 2026-06-17

### Changed
- **Daily card button reflects lesson progress.** If the current mini-lesson is
  already in progress, the button reads "Fortsetzen →" (was always
  "Lektion starten"); still "Nächste Lektion →" after finishing one and
  "Lektion starten →" for a fresh one.

## [0.6.55] — 2026-06-17

### Changed
- **Smarter word underlining in the lesson.** Only words clearly above your
  level (≥ 2 CEFR bands) are underlined now, so common near-level words (B1
  cognates like "français"/"décembre" for an A2 reader) are left alone. The same
  threshold applies to the per-paragraph auto-collected vocab.
- **Lesson app bar matches the sidebar** — same page-background "material" (no
  filled surface bar), only the logo square + "LERN-MODUS" chip carry the accent.
- **"Lektion starten →"** instead of "Lektion lesen →" on the daily card.

## [0.6.54] — 2026-06-17

### Fixed
- **Daily card vanished after the mini-lesson-set change.** A pre-existing daily
  state from before (single `article` field) made `ensureToday` throw on the new
  `articles[]` shape, leaving the learn view empty. It now guards against the old
  shape and refetches the set.

## [0.6.53] — 2026-06-17

### Changed
- **Calmer lesson app bar.** The full violet gradient top bar was too heavy and
  clashed with the subtle sidebar header — it's now a light surface bar with a
  thin divider, the accent kept only on the small Sidelearn logo square and the
  "LERN-MODUS" chip, so both surfaces read consistently.

## [0.6.52] — 2026-06-17

### Added
- **Comprehension check after every paragraph (#2).** In the lesson, pressing
  "Gelesen" now shows a single multiple-choice question (3 options) about that
  paragraph, generated in the background while you read; answer it, then
  continue. The lesson also **auto-collects a few new/hard words per paragraph**
  into your vocab. The end screen shows your quiz score; results are saved to the
  lesson.
- **Daily challenge is now a small set of mini-lessons (#3).** Instead of one big
  article, the day's challenge is **2 articles by default** (configurable 1–3 in
  settings → "Mini-Lektionen pro Tag"). The card shows progress (e.g. 1/2) and
  the current lesson; finishing all of them credits the streak. Completion is
  tracked via the lesson store, so it survives reloads.

## [0.6.51] — 2026-06-17

### Added
- **One-click word translation in the lesson (app mode).** Borderline words
  (above your level) are now gently underlined in the simplified text; clicking
  one opens a small popover with the dictionary translation, **★ merken** (saves
  to vocab) and **mehr** (local-model explanation with an example) — no more
  selection → OS menu → submenu → translate. **Selecting any text** also opens
  the popover (single words via the dictionary, phrases translated by the model).

## [0.6.50] — 2026-06-17

### Changed
- **Leaner, airier learn view.** Erfolge is no longer a big card in the flow —
  it's now a small round **trophy badge in the header** (with the streak count);
  clicking it opens a lighter, dismissible Erfolge panel. The daily-challenge
  card is flatter (plain surface instead of the heavy violet fill) with slimmer
  buttons, and spacing is more generous throughout.

## [0.6.49] — 2026-06-17

### Changed
- **Surf page actions are now a compact icon row** (Merken / Übersetzen / Quiz /
  Chat) with SVG icons + tiny labels, instead of stacked text buttons — much
  leaner. Bookmark shows a filled star when the page is saved; Quiz shows the
  spinner while generating.
- **Landing footer**: when relevant, the mode chooser shows a subtle 🔥 streak
  and a "Lektion fortsetzen →" shortcut if today's lesson is in progress.

## [0.6.48] — 2026-06-17

### Changed
- **Decluttered the sidebar into two focused modes.** Instead of one crowded
  panel, a clean landing asks "Lernen oder Surfen?" with two large SVG buttons:
  - **Lernen** — the lean-back hub: daily lesson card, Erfolge, "Vokabeln üben".
  - **Surfen** — the browsing tools: Markieren/Vereinfachen toggles, page actions
    (merken, Seite übersetzen, Seiten-Quiz, Chat) and the Übersetzungen / Vokabeln
    / Sites sections.
  A small home button in the header returns to the landing; the chosen mode is
  remembered (`settings.mode`). New icons: book (Lernen), compass (Surfen), home.

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
