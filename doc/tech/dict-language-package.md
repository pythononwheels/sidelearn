# Dict- & Sprachverbesserungs-Paket — Status, Kosten, Erfahrungen

Stand: **2026-06-30**. Dieses Dokument fasst die Arbeit am mehrsprachigen Vokabular
(richdict), der UI-Übersetzungs-Qualität und der Lektions-Frage-Logik zusammen:
was erledigt ist, was aussteht, was es gekostet hat, was wir gelernt haben — und
**was sich ohne LLM (also ohne Gemini-Kosten) machen ließe**.

Detaillierte Einzelbefunde (276 richdict-QA-Findings): siehe `richdict-qa-report.md`.

---

## 1. Was erledigt & live ist

### 1.1 Multilang-Vokabel-Engine — alle 6 Muttersprachen
- **Stufe 1 (EN/ES-Native):** 8 richdicts (`fr/nl/es/de→en`, `en/fr/nl/de→es`), je ~5.700–5.900 Wörter.
- **Stufe 2 (NL/IT/FR-Native):** 12 richdicts (`fr/de/en/it→nl`, `fr/de/en/nl/es→it`, `de/en/nl→fr`).
- `build-richdict.mjs` für **beliebige Muttersprache parametrisiert** (`<learn> [native]`); FreeDict-gegroundet.
- **25 richdicts gesamt** → NL→FR, IT→EN etc. funktionieren. App lädt `richdict-<learn>-<native>.json`
  on-demand (nicht im Install-Precache → kein Bundle-Bloat).
- `posBucket` (Cloze-Distraktoren) mehrsprachig (de/en/es/fr/nl/it POS-Begriffe).

### 1.2 UI-Native-Review (i18n nl/fr/es/it)
- Zwei unabhängige LLM-Cross-Checks (**OpenAI gpt-5 + gpt-5.5**) der maschinenübersetzten Strings
  gegen die de/en-Quelle.
- **64 Fixes** eingearbeitet (29 high + 35 med): Cloze-Begriffe (`lacune`→`Invultekst`, …),
  Grammatik/Kongruenz, Imperative für Buttons, kulturelle Fixes (es `coge`→`consigue`).
- gpt-5.5 bestätigte danach **0 verbleibende High-Issues**. Platzhalter/HTML überall erhalten.

### 1.3 richdict-Inhalts-Bereinigung
- **Eigennamen entfernt:** 6.952 Einträge (~280/Dict, POS=Eigenname — `john/paris/michael` waren
  Vokabular; sicher per POS, *nicht* per Stoppliste).
- **Bedeutungs-Korrekturen (120er-Stichprobe, alle 25 Dicts):** 867 Sinne korrigiert (gemini-3.5-flash).
- **Stufe-1 Top-Frequenz (Top-1500/Dict):** 1.565 Korrekturen — **nur die 4 deutsch-nativen Dicts**
  (`en-de/es-de/fr-de/it-de`), dann am Spending-Cap abgebrochen.
- **Bewusst NICHT gedroppt:** flektierte/lowercase Formen bleiben (siehe §4 — Frequenz- vs. Lemma-Dict).

### 1.4 Lektions-Verständnisfragen gegroundet
- Bug: Fragen wurden gegen den **Original**-Absatz generiert, der Lernende liest aber den
  **vereinfachten** → manche Fragen unbeantwortbar.
- Fix: Prompt (`server/app/llm.py`) verlangt jetzt eine Frage, die **allein aus dem `simplified`-Text**
  beantwortbar ist. `SCHEMA_VERSION 1→2` → alte Lektionen re-prepen lazy.
- Live verifiziert (fr/B1: Frage-Antwort steht jeweils explizit im vereinfachten Absatz).

---

## 2. Was aussteht

| Aufgabe | Umfang | Kosten (3.5-flash) | Kosten (2.5-flash) |
|---|---|---|---|
| **Stufe-1 Rest** (21 Dicts: nl-de + 20 nicht-DE-native) | Top-1500/Dict | **~$7–8** | ~$1,5 (fängt nur ~⅓) |
| Long-Tail (Rang 1500+) | seltene Wörter | ~$15–20 | ~$3 | **niedrige ROI — auslassen** |

- **Blocker:** Gemini-Projekt-**Spending-Cap** erreicht (`429 RESOURCE_EXHAUSTED`). Erst anheben
  (ai.studio/spend) oder Monats-Reset (1.) abwarten.
- **Wichtig:** derselbe Key/Projekt treibt auch die **Server-Lektions-Aufbereitung**. Solange das Cap
  voll ist, kann der Server **keine neuen** Lektionen prepen (alte gecachte funktionieren weiter).
- Stufe-1 für die anderen Muttersprachen betrifft *nicht* den deutschen Nutzer — die 4 DE-Dicts sind durch.

---

## 3. Kosten (rekonstruiert)

Die lokalen Skripte loggen keine Token → Output **gemessen** aus den Artefakten, Input geschätzt
(±). Server-Telemetrie erfasst diese Arbeit **nicht** (lief nicht über den Server).

| Komponente | Modell | Output (gem.) | Kosten |
|---|---|---|---|
| richdict-Builds (20 neue + 2 Re-runs) | gemini-2.5-flash-lite | 6,4 M | ~$3,72 |
| Inhalts-QA (25 Dicts) | gemini-3.5-flash | 41 k | ~$0,62 |
| Korrektur-Pass (120/Dict) | gemini-3.5-flash | 48 k | ~$0,72 |
| Stufe-1 (Top-1500, 4 DE-Dicts) | gemini-3.5-flash | 89 k | ~$1,34 |
| verworfener Fix-Pass (zu aggressiv, §4) | gemini-3.5-flash | 42 k | ~$0,63 |
| UI-Native-Review | OpenAI gpt-5/5.5 | 15 k | ~$0,21 |

- **Gemini gesamt: ~$7** · **OpenAI gesamt: ~$0,21** · **Summe ~$7,2** (Input-Unsicherheit → real evtl. ~$8–9).
- **Kosten-Treiber:** 51 % des Output-Tokens sind **neu generierte Beispielsätze** (`ex`+`exd`).
  Bedeutung+POz allein wäre ~halb so teuer.
- Preise (verifiziert, `config.py`): flash-lite $0,10/$0,40 · flash $0,30/$2,50 → 3.5-flash $1,50/$9 · 3.1-pro $2/$12.

---

## 4. Erfahrungen / Learnings

1. **Frequenz-Dict ≠ Lemma-Dict (wichtigster Punkt).** Das richdict ist frequenzbasiert: keyed nach
   den **Oberflächenformen**, die Lernende im Text antippen (`frappé`, `war`, `hosen`) — inkl. Beugungen
   und lowercase. Ein LLM-„Review" wendet die Norm eines **kanonischen Lemma-Wörterbuchs** an und will
   `rannte`/`kleiner`/`hosen` als „Fehler" **droppen** → ein erster Fix-Pass hätte ~60 % der Einträge
   (inkl. `war/einen/vamos`) gelöscht. **Regel: NIE droppen, jeden Headword behalten, nur Bedeutungen
   korrigieren** (Lookup-Sicherheit; Antipp-Feature braucht die Oberflächenformen).
2. **Eigennamen sicher per POS, nicht per Stoppliste.** `names.json` ist sprachübergreifend → `aber/so/war`
   sind anderswo Namen → Kahlschlag. `POS=Eigenname` (am Eintrag) trifft nur echte Namen.
3. **Output-Kosten = Beispielsätze.** Wer Kosten drücken will: Beispiele **nicht** neu generieren
   (nur `t`+`p` korrigieren, `ex`/`exd` behalten) → Output ~halbiert.
4. **Modell-Ökonomie:** 3.5-flash gründlich (17/60); 2.5-flash billig, aber nur ~⅓ Recall (5/60);
   **3.1-pro ist *teurer* als 3.5-flash (+ zu langsam für Batch) → nie für QA**. gpt-5.5 (UI) bestätigte
   die gpt-5-Fixes (0 verbliebene High).
5. **Hintergrund-Builds + Schlaf.** MacBook schlief bei Inaktivität ein → Node-Prozess pausiert, Requests
   reißen ab (sah aus wie Rate-Limit, war es nicht). **Lösung: alle Hintergrund-Läufe unter `caffeinate -i`.**
6. **zsh splittet nicht.** `set -- $pair` lässt `"nl en"` ungeteilt → Build-Fehler. **`${pair%-*}`/`${pair#*-}`.**
7. **Geteilter Gemini-Key.** Lokale Skripte + Prod-Server teilen Key/Projekt → das **monatliche Spending-Cap**
   ist gemeinsam. Heutige ~$7-Session + Monats-Server-Verbrauch zusammen → Cap gerissen.
8. **`schema_version`-Bump** ist der saubere Re-Prep-Hebel (alte Lektionen lazy neu) — aber bei vollem Cap
   blockiert er neue Preps. Notfall-Fallback: Bump zurücknehmen → alte gecachte Lektionen wieder sichtbar.
9. **Keine Token-Telemetrie in den lokalen Skripten** — Kosten nur per Artefakt-Rekonstruktion. *Verbesserung:*
   `usageMetadata` der Gemini-Antwort mitloggen, dann exakte Kosten pro Lauf.

---

## 5. Was OHNE LLM ginge (kostenlos)

Gemessen an den 25 Dicts (212.536 Sinne):

| Maßnahme | LLM nötig? | Befund |
|---|---|---|
| **Doppel-Sinne** entfernen (gleiche Bedeutung 2×) | nein | 0 (Build dedupt schon) |
| **Feld-Validierung** (leere/kaputte Felder) | nein | 3 leere Beispiele — vernachlässigbar |
| **Bad-Example-Detektion** („Beispiel enthält das Wort gar nicht") | nein (Detektion) | ~2–3 % der Sinne (~5.000) echt, lemma-bewusst via `forms-<lang>.json` |
| **Eigennamen / Sprach-Leaks** flaggen | teilw. | per `names.json`/POS + Cross-Frequenzliste; nicht 100 % sauber |
| **Bedeutung/POS korrigieren, Sinn-Reihenfolge** | **ja** | braucht semantisches Urteil → LLM |
| **Beispielsatz *fixen*** (neu erzeugen) | **ja ODER Korpus** | LLM **oder** ein freies Satz-Korpus |

**Schlussfolgerung:**
- **Detektion** vieler Probleme ist gratis & deterministisch (Bad-Examples lemma-bewusst, Dubletten,
  Leak-Heuristik). **Fixen** von Bedeutungen braucht ein LLM.
- **Beste LLM-freie Qualitäts-Quelle für Beispiele: ein freies Satz-Korpus** statt LLM-generierter Sätze:
  **Tatoeba** (Millionen CC-BY-Sätze mit Übersetzungen in allen 6 Sprachen). Pipeline: bad/missing
  `ex` durch einen echten Tatoeba-Satz ersetzen, der das Stichwort enthält → **$0**, echte Sätze,
  reproduzierbar. Das würde den größten *kostenpflichtigen* Output-Block (Beispiel-Generierung, §3)
  komplett ersetzen.
- **Empfehlung (lean, keine Nice-to-haves):** Bedeutungs-Korrektur per LLM nur auf der
  **Top-Frequenz** (Stufe 1, die real getroffenen Wörter); Beispiel-Qualität LLM-frei über Tatoeba;
  Long-Tail unangetastet lassen.

---

## 6. Schlüssel-Dateien

- `scripts/build-richdict.mjs` — richdict-Build (native parametrisiert)
- `scripts/build-wordlists.mjs` — `DICT_PAIRS` (FreeDict-Grounding)
- `src/public/data/richdict-<learn>-<native>.json` — 25 Dicts
- `pwa/i18n.ts` — UI-Strings (64 native-review-Fixes)
- `server/app/llm.py` — Lektions-Prep-Prompt (Frage gegroundet); `config.py` — `SCHEMA_VERSION`
- `doc/tech/richdict-qa-report.md` — alle 276 QA-Einzelbefunde
