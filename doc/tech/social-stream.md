# Social Stream — Implementierungs-Referenz

Der **Stream**-Tab zeigt echte, kurze Mastodon-Posts ("Toots") in der Lernsprache:
schwierigkeitsgefiltert, on-tap übersetzbar, Original einen Klick entfernt.
**Kein LLM** beim Einsammeln — Übersetzung passiert nur on-tap (gecacht),
Schwierigkeit wird client-seitig aus Wort-Frequenzen geschätzt.

Design-Hintergrund/„Warum": siehe [`social-stream-plan.md`](./social-stream-plan.md).
Diese Datei beschreibt den **Ist-Zustand**.

Kerncode: `server/app/social.py` (Harvester + Quellen), `server/app/db.py`
(`toot`-Tabelle + Pool-Queries), `server/app/main.py` (`/stream`-Endpoint, Cron),
`server/app/config.py` (Stellschrauben), Client `pwa/App.tsx` (`StreamTab`).

---

## 1. Quellen (Instanzen)

**Eine öffentliche Mastodon-Instanz pro Lernsprache.** Abgegriffen wird die
öffentliche Hashtag-Timeline — `GET https://{instanz}/api/v1/timelines/tag/{tag}?limit=40`
— **ohne Auth**.

| Sprache | Instanz | Status |
|---|---|---|
| **en** | `mastodon.social` | aktiv |
| **fr** | `piaille.fr` (große allgemeine FR-Instanz) | aktiv |
| de, it, nl, es | — | **noch nicht** (keine Quelle definiert) |

> Mastodon normalisiert Hashtags (lowercase, **ohne Akzente**) → französische Tags
> werden ASCII geschrieben: `cinema`, `litterature`, `archeologie`, `numerique`.

## 2. Hashtags pro Rubrik

Die Rubrik-Schlüssel spiegeln die Artikelrubriken (`wiki.AREAS`), damit der Client
dieselben Farben/Chips nutzt.

### 🇬🇧 Englisch — `mastodon.social`
| Rubrik | Hashtags |
|---|---|
| natur | `science` `nature` `wildlife` `space` `astronomy` |
| geschichte | `history` `archaeology` `heritage` |
| kultur | `art` `music` `film` `books` `photography` |
| technik | `technology` `programming` `ai` `gaming` |
| sport | `sport` `football` `cycling` `running` |

### 🇫🇷 Französisch — `piaille.fr`
| Rubrik | Hashtags |
|---|---|
| natur | `sciences` `nature` `animaux` `astronomie` `espace` |
| geschichte | `histoire` `archeologie` `patrimoine` |
| kultur | `art` `musique` `cinema` `litterature` `photographie` `culture` |
| technik | `technologie` `informatique` `numerique` `jeuxvideo` |
| sport | `sport` `football` `cyclisme` `rugby` |

Quelle der Wahrheit: `SOURCES` in `server/app/social.py`.

## 3. Harvest (Cron)

- Läuft **beim Container-Start** und danach **alle 15 Min** (`SL_SOCIAL_EVERY_MIN`),
  via APScheduler neben dem Artikel-Build.
- Pro Lauf: für jede aktive Sprache (`SL_SOCIAL_LANGS`, Default `en,fr`) × jeden
  Hashtag → 40 neueste Toots holen → filtern → säubern → in die `toot`-Tabelle
  (Upsert, Dedup per `id = "{instanz}:{status_id}"`).
- **Kosten: 0** (nur HTTP + DB, kein LLM). ~42 Calls/Lauf bei en+fr.

## 4. Filter-Pipeline (beim Einlesen)

Ein Toot landet nur im Pool, wenn er **alle** Stufen besteht:

1. **Sicherheit:** `sensitive == false` **und** kein `spoiler_text` (Content-Warning).
2. **Säuberung** (`clean()`): `<a>`-Anker (Links/@Mentions/#Hashtags) komplett raus,
   restliche HTML-Tags raus, Entities entschärft, bare URLs/Mentions/Hashtags raus.
   **Emojis bleiben** (Social-Flair). → reiner Lesetext.
3. **Blocklist:** NSFW/Spam-Wörter (`SL_SOCIAL_BLOCKLIST`) als Substring → raus.
4. **Länge:** ≥ **60** echte Buchstaben (`SL_SOCIAL_MIN_LEN`) und ≤ **500** Zeichen
   (`SL_SOCIAL_MAX_LEN`) — killt Pure-Link/Titel-Posts und Essays.
5. **Sprach-Gegencheck:** `langdetect` muss die Ziel-Sprache bestätigen (das
   Mastodon-`language`-Feld ist unzuverlässig).
6. **Anti-Flood:** max **3 Toots pro Autor** je Hashtag/Lauf (`SL_SOCIAL_MAX_PER_AUTHOR`)
   — gegen News-/Feed-Bots.

**Bild:** pro Toot wird das erste Bild-Attachment (Foto/Video-Thumbnail) gespeichert,
sonst das Link-Preview-Bild der Karte (`card.image`).

## 5. Niveau-Kategorisierung (CEFR)

**Client-seitig, gratis, kein LLM** — in `pwa/App.tsx` (`tootBand`):

1. Toot tokenisieren; jedes Wort (≥3 Zeichen) im **Frequenz-Rang** der Sprache
   nachschlagen (`data/freq-<lang>.json`, generiert aus OpenSubtitles-FrequencyWords).
2. Ränge sortieren, das **80.-Perzentil** nehmen (mit Antippen zählt der Großteil des
   Texts mehr als das eine seltenste Wort; < 4 bekannte Wörter → kein Badge).
3. Rang → CEFR-Band über feste Schwellen (`RANK_THRESHOLDS`, `banding.ts`):

   | Band | max. Rang (häufigste Wörter) |
   |---|--:|
   | A1 | 750 |
   | A2 | 1 500 |
   | B1 | 3 000 |
   | B2 | 6 000 |
   | C1 | 12 000 |
   | C2 | darüber |

Das Band ist nur eine Schätzung/Hilfe — der Server speichert **kein** Niveau.

## 6. Pool-Verwaltung (rollierend)

Nach jedem Harvest:
- **Übergroße** Toots (> `SL_SOCIAL_MAX_LEN`) löschen.
- **Rolling-Prune:** pro `(Sprache, Rubrik)` nur die **neuesten 80**
  (`SL_SOCIAL_KEEP_PER_RUBRIK`) behalten → Pool bleibt bounded & balanciert
  (~80×5×Sprachen, real ~200–390/Sprache je nach Tag-Aktivität).
- **Alters-Backstop:** alles > 30 Tage (`SL_SOCIAL_KEEP_DAYS`) raus.

## 7. Auslieferung — `GET /stream`

`GET /stream?lang=&tags=&before=&limit=` — origin-gated (nur Learny-PWA) +
per-IP-rate-limited (`RL_STREAM`), **kein** Cost-Guard (kein LLM).
- `tags` = comma-sep Rubriken (Filter), `before` = ISO-`created_at`-Cursor fürs
  Paging, `limit` ≤ 100. Sortiert **neueste zuerst**.

**Client (`StreamTab`):** lädt die neuesten ~40 als **Zeit-Block**, sortiert sie
**innerhalb** nach Niveau (leicht→schwer), weiterscrollen lädt per `before`-Cursor
den nächsten älteren Block (Infinite-Scroll). Drei Filter: **Thema** (Rubrik),
**Zeit** (Blöcke), **Niveau** (A1–C2 Buttons, Default = Userniveau + 2 und drunter).

## 8. Stellschrauben (ENV)

| Var | Default | Bedeutung |
|---|---|---|
| `SL_SOCIAL_ENABLE` | `1` | Harvest an/aus |
| `SL_SOCIAL_EVERY_MIN` | `15` | Cadence (Minuten) |
| `SL_SOCIAL_LANGS` | `en,fr` | aktive Lernsprachen |
| `SL_SOCIAL_PER_TAG` | `40` | Toots/Hashtag/Lauf |
| `SL_SOCIAL_KEEP_PER_RUBRIK` | `80` | rollierende Pool-Größe je Rubrik/Sprache |
| `SL_SOCIAL_KEEP_DAYS` | `30` | Alters-Backstop |
| `SL_SOCIAL_MIN_LEN` | `60` | min. echte Buchstaben |
| `SL_SOCIAL_MAX_LEN` | `500` | max. Zeichen |
| `SL_SOCIAL_MAX_PER_AUTHOR` | `3` | Anti-Flood je Hashtag/Lauf |
| `SL_SOCIAL_BLOCKLIST` | (NSFW-Liste) | Substring-Blocklist |
| `SL_RL_STREAM` | `60/minute` | Rate-Limit `/stream` |

## 9. Neue Sprache hinzufügen (de/it/nl/es)

1. **`server/app/social.py`** → `SOURCES`-Eintrag: passende Instanz + Hashtag→Rubrik-Map
   (lokale Hashtags, ASCII). Vorschläge:
   - **de** → `mastodon.social`/`troet.cafe`: `wissenschaft geschichte kunst musik technologie sport natur`
   - **it** → `mastodon.uno`: `scienza storia arte musica tecnologia sport natura cinema`
   - **nl** → `mastodon.nl`: `wetenschap geschiedenis kunst muziek technologie sport natuur`
   - **es** → `masto.es`/`mastodon.social`: `ciencia historia arte musica tecnologia deporte naturaleza cine`
2. **`SL_SOCIAL_LANGS`** um die Sprache erweitern.
3. **Client** `STREAM_LANGS` in `pwa/App.tsx` erweitern (sonst „gibt's noch nicht").
4. Frequenzdaten `data/freq-<lang>.json` müssen existieren (für die Niveau-Schätzung)
   — sind für de/it/nl/es bereits gebaut.
5. Deploy + Harvest abwarten, dann mit `scripts/stream-report.py` die Verteilung prüfen.

## 10. Analyse

`python3 scripts/stream-report.py` — paged den ganzen Pool durch `/stream` und
berichtet **gesamt / pro Rubrik / pro Niveau** (repliziert `tootBand` exakt).
