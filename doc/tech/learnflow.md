# Learny — Lernflow (Stand 0.6.93)

Wie Learny lehrt: woher Inhalte kommen, was lokal liegt, und wie ein Nutzer
vom einen CEFR-Niveau zum nächsten gebracht wird. Learny ist eine **„nebenbei"-
Lern-App**; Levels sind app-interne Meilensteine („Learny-Level"), kein offizielles
CEFR-Zertifikat.

## 1. Server (FastAPI, `api.sidelearn.pyrates.io`, SQLite)
- **Daily-Discover:** holt pro Sprache die meistgelesenen Wikipedia-Artikel des Tages
  (`SL_POOL=4`/Tag/Sprache), Auszug max **8 Absätze** (`SL_MAX_PARAS`).
- **LLM-Prep (Gemini `gemini-2.5-flash-lite`):** bereitet **jeden Artikel für ALLE
  Level A1–C1** auf → vereinfachte Absätze + 1 Verständnisfrage/Absatz + Vokabelliste
  + Summary. Gespeichert in `prepared` (pro Artikel×Level). *Wichtig:* weil alle Level
  vorliegen, ist die „nächste Stufe" eines Artikels gratis verfügbar (siehe §4).
- **Area-Pool** (Artikelrubriken): täglich `SL_AREA_TOPUP=2` neue Artikel pro Rubrik×
  Sprache (7 Rubriken), für alle Level vorbereitet; **Digest/Kurzfassung** für Area-
  Artikel (A2+, `DIGEST_WORDS`).
- **On-demand:** `/translate` (Wort im Kontext: Übersetzung·Wortart·Alternativen·
  Beispiel), `/sentence`, `/digest`, `/surprise`. Täglicher Auto-Build via APScheduler.
- **Endpoints:** `/daily`, `/lesson/{id}?level=`, `/archive`, `/surprise`, `/digest`,
  `/translate`, `/sentence`, `/random`, `/health`, `/admin*`.
- Sprachen via `SL_LANGS` (fr, de, en, nl, es, it).

## 2. Lokal auf dem Gerät (PWA-Bundle, Service-Worker-gecacht)
Daten in `src/public/data/` (CacheFirst, offline):
- `freq-<lang>.json` (20k Häufigkeitsränge → CEFR-Banding, `banding.ts`).
- `richdict-<lang>-de.json` (~6k Wörter: 1–3 Bedeutungen · Wortart · Beispiel FR/DE ·
  Band) — fr/es/en/nl/it→de. **Quelle der Worterklärungen, Vokabeltest-Karten und
  Next-Level-Zielwörter.**
- `dict-<lang>-de.json` (FreeDict, flache Übersetzungen, Fallback), `forms-<lang>`
  (Flexion→Grundform), `gloss-<lang>-de`, `names.json` (Eigennamen-Stoppliste).

localStorage (privatsphäre-first, nichts zentral):
- `sl_pwa_settings`, `sl_pwa_route` (`{level, etappe}`), `sl_pwa_deck` (Wörter mit
  **SRS-Status**: box/due/seen/correct/band/src/context), `sl_pwa_milestones`,
  `sl_pwa_activity`, Streak/XP, `sl_pwa_progress` (gelesene Artikel).

**Lückentexte** kommen **nicht** vom Server: `ClozeView` baut sie **clientseitig**
(`buildClozeQuestions`, **8 Lücken**/Runde). **i+1-Blend:** ~4 Lücken aus dem
Tagesartikel (Festigung) + ~4 **Next-Level-Zielwörter** der Etappe, ausgeblendet in
ihren richdict-Beispielsätzen (MC). Treffer/Kontakte zählen aufs Wochenziel.

## 3. Tagesablauf (Daily)
- **Tageslektion** = 2 Pflicht-Artikel (`goal=2`), je 5 Pflichtabsätze (`CHALLENGE=5`),
  Rest Bonus. Das ist die **Lesegewohnheit** — sie treibt die Lernroute *nicht* direkt.
- Beim Lesen werden Wörter **über dem eigenen Level markiert** (i+1) → antippen =
  Kontext-Übersetzung (offline aus `richdict`, sonst `/translate`), „★ merken" legt sie
  ins SRS-Deck.
- Zusätzlich frei: **Artikelrubriken** (Server-Area-Pool, optional als Kurzfassung),
  **Lückentext**, **Vokabeltest**, **Wörterbuch**.

## 4. Wie neue Vokabeln zum Nutzer kommen (der Kern)
Artikel werden auf das **eigene** Level vereinfacht — sie pushen das nächste Niveau
also *nicht* per Vereinfachung. Neue (Next-Level-)Wörter kommen über **drei Kanäle**:

1. **Hauptmotor — Vokabeltest / SRS.** Pro Etappe (~Woche) ein Batch von **50
   Next-Level-Zielwörtern** (häufigste zuerst, aus `richdict`, Band = nächstes Level).
   Multiple-Choice mit „Weiß nicht" + ausführlicher Worterklärung; jede Antwort steuert
   die **Leitner-Box** (`srs.ts`: Boxen 0–5, Intervalle 1/2/4/8/16 Tage). „Sitzt"
   (cleared) ab Box ≥ 2.
2. **Daily +1-Stretch (i+1, Variante A).** Der **2. Daily-Artikel wird eine Stufe höher
   gelesen** (A1-User → A2-Fassung; „+1"-Badge). Nutzt die bereits vorbereitete Level+1-
   Version → **kein Mehraufwand**. Dort kommen viele Next-Level-Wörter im Kontext vor.
3. **Passiver Credit beim Lesen/Lückentext.** Beim Abschluss wird der Text nach den
   Etappen-Zielwörtern gescannt (`creditWordsFromText`: tokenisieren → `normalize` →
   `lemmaCandidates`/`forms`); Treffer zählen als **SRS-Kontakt** (`srs.encounter`, +1
   Box) mit Text-Referenz. Fertig-Screen: „+N neue Wörter aus diesem Artikel gelernt".

So füllt sich das Wochenziel aus Vokabeltest **und** Lesen. (Retention-Prinzip: ~10–20
Kontakte über die Zeit; SRS-Spacing taktet ~1 Etappe/Woche.)

## 5. Lernpfad & Aufstieg (`route.ts`, `milestones.ts`)
- **1 Level = 10 Etappen** (`ETAPPEN_PER_LEVEL`), je ~50 Zielwörter
  (`ETAPPE_GOAL`) → **500 Wörter/Level** (`TARGETS_PER_LEVEL`). Sublevel-Anzeige
  `L.e` (A1.1 … A1.10).
- Sitzt das Wochenziel → **Etappen-Check** (kurzer Test über die neuen Wörter, ≥4/5).
  Bestehen → nächste Etappe; Milestone-Snapshot (Wörter · Artikel · Check) zeigt der
  Lernpfad als „Sprachniveau A1.3 · 50 Wörter · 5 Artikel · Check ✓".
- Nach 10 Etappen → **Aufstiegstest** prüft die Next-Level-Zielwörter (≥70 %) + Lesen
  → Level-up. Man wird A2 also nur, wer A2-Wörter kann.
- Lesen/Vokabeltest/Lückentext geben XP, treiben die Route aber nicht direkt; die Route
  hängt am Wortziel + den Checks.

## 6. Wörterbuch
Reiche, durchsuchbare Einträge aus `richdict` (Bedeutungen · Wortart · Beispiel FR/DE ·
Band), Umschalter „Alle" (Stufenwörter bis Level) ⇄ „Meine" (Deck). Suche fällt aufs
volle gebündelte FreeDict-Wörterbuch zurück. Dieselben Daten speisen Wort-Popover und
Vokabeltest-Erklärungen.

## 7. Datenmengen (grob, pro Sprache)
- Frequenz: 20k Ränge · richdict ~6k Wörter (~1–2 MB) · FreeDict ~12k–30k Einträge ·
  forms ~7k–12k. Tages-Pool: 4 Artikel × (A1–C1 Prep). Area-Pool: +2/Rubrik/Tag.
- Vokabel-Ziel: ~500 Next-Level-Wörter/Level (~50/Woche, ~7/Tag).

## 8. Offene Ideen
- **i+1 im at-level-Text** (Variante C): Prep lässt gezielt einige Zielwörter
  unvereinfacht stehen — pädagogisch ideal, aber Prompt-Änderung + Rebuild aller Artikel.
- richdict-Qualität per Stichprobe nachschärfen / Offline-Daten weiter ausbauen.
- Lernpfad-Optik weiter verspielen (Screenshot-getrieben).
