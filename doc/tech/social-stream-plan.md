# Social Stream (Mastodon) — MVP-Plan

Status: **Entwurf / zur Abstimmung** · Stand: 2026-06-25

Social-Media-Sog + Sprachenlernen: ein **„Stream"-Tab** mit echten, kurzen Mastodon-Posts in der
Lernsprache — schwierigkeitsgefiltert, on-tap übersetzbar, Original immer einen Klick entfernt.

## Leitentscheidungen (das „Warum")
- **Quelle = kuratierte Themen-Hashtags** (wie die Artikelrubriken), **nicht** der Firehose/Trending.
  Mastodon-„Trending" ist pro Instanz, global, unkuratiert (oft Off-Topic-Meme-Tags) → ungeeignet als
  Backbone für eine kinderfreundliche Lern-App.
- **„In die Niveaus bringen" = Schwierigkeit filtern/badgen, KEIN LLM-Rewrite.** Bei kurzen Toots ist
  Umschreiben (× 6 Sprachen × 5 Stufen × 100/Tag) zu teuer. Schwierigkeit schätzen wir **client-seitig
  gratis** über die Wort-Frequenzränge (`rankOf`/`isAboveLevel`, haben wir schon).
- **Original bleibt echt.** Übersetzen passiert **on-tap** (Wort/Satz, gecacht); „Vereinfachen" nur
  **on-demand**. Klick auf die Quelle öffnet den echten Toot.
- **Bounded Pool** (wie der Area-Pool) → planbar & günstig. Fetch erzeugt **keine** LLM-Kosten.
- **Safety zuerst** (kinderfreundlich): sensitive/CW raus, Sprachfilter, Blocklist, Spam-Heuristik.

## Erkenntnisse aus echten Daten (2026-06-25, 360 Toots / 9 Tags)
- `mastodon.social` ist **stark EN** (74% en, 14% `language=None`); fr/es/it/nl dort **sehr dünn**.
- **Lösung: pro Sprache eigene Instanz + Hashtags.** Eine französische Instanz (`piaille.fr`) mit
  **französischen** Tags liefert reichlich fr (#sciences 30/40, #histoire 29/40, #musique 17/40).
- Das **`language`-Feld ist unzuverlässig** (14% leer, teils falsch getaggt — ein dt. Toot war `en`).
  → **Sprach-Detektor** server-seitig als Gegencheck (billige Lib, z. B. `lingua`/`langdetect`).
- **Safety gering** (~1–2 sensitive/CW pro 40) → `sensitive`/`spoiler_text`-Filter reicht als Basis.
- Viel **Bot-/Feed-Content** (News-Headlines + Link + Emojis). Real & aktuell, aber link-/emoji-lastig
  → **Text säubern** (Links/Emojis raus, Mindest-Realtext-Länge), Pure-Link-Posts deprioritisieren.

### Quellen-Map (pro Lernsprache)
| Lernsprache | Instanz | Hashtags (Beispiele) |
|---|---|---|
| **en** | mastodon.social | #science #history #art #ai #nature #sport #space #music |
| **fr** | piaille.fr (od. mamot.fr) | #sciences #histoire #art #musique #nature #sport #cuisine |
| *(de später)* | mastodon.social / .de-Instanz | #wissenschaft #geschichte #kunst #natur #musik |

## Architektur

### Server
**Fetcher** (täglicher Cron, analog Area-Top-up):
- Pro `(hashtag, ziel)` → `GET {instance}/api/v1/timelines/tag/{tag}?limit=40` (public, **kein Auth**).
  Hashtag-Timelines **föderieren** → eine große Instanz (Start: `mastodon.social`) liefert Posts
  vieler Sprachen; wir filtern.
- **Filter beim Einlesen:**
  - `language ∈ {en, de, fr, nl, it, es}` (Toot-`language`-Feld) — optional Sprach-Detektor-Gegencheck.
  - `sensitive == false` **und** kein `spoiler_text` (Content-Warning) → raus.
  - Wort-**Blocklist** (NSFW/Hass), Spam-Heuristik (zu viele Links/Hashtags, zu kurz, Bot-Muster).
- **Speichern** in neue `toot`-Tabelle (Dedup per `id`). **Kein LLM.**

**Endpoints** (Origin-gated + rate-limited wie `/areas/list`):
- `GET /stream?lang=&tags=&days=&limit=` → gefilterte Pool-Toots, neueste zuerst.
- *(später)* `POST /simplify` → on-demand CEFR-Vereinfachung eines Toots (LLM, gecacht, cost-capped).

**DB:**
```
toot(id PK, instance, url, author, author_handle, lang, tags TEXT,  -- comma-sep
     content_text, created_at, media_url?, fetched_at)
INDEX (lang, created_at)
```

### Client
Neuer **Stream-Tab** (oder unter „Mehr"):
- Lädt `/stream?lang=<learn>&tags=<selected>`, rendert **Toot-Karten**:
  Autor · Text (über `TapText` → Wort-Übersetzung) · Zeit · Tags · Quelle-Link.
- **Niveau-Badge** pro Toot (client-seitig: Anteil Wörter über User-Niveau via `rankOf` → CEFR-Schätzung).
- **Filter:** Tag-Chips (Sport/Technik/…) + „passt zu meinem Niveau"-Toggle.
- **on-tap:** Wort → `WordPopover` (haben wir) · „Satz/Toot übersetzen" → `/sentence` (gecacht) ·
  „Vereinfachen" → `/simplify` (später).
- **Lern-Hooks:** „ins Deck speichern", XP für gelesene/übersetzte Toots, evtl. eigener Streak-Beitrag.

## Schwierigkeits-Leveln (client-seitig, gratis)
Pro Toot: tokenize → Anteil Wörter **über** dem User-Niveau (`isAboveLevel`/`rankToBand`, vorhanden).
Schwellen → Band-Schätzung A1…C1 → Badge + Filter. Kein Server-Call.

## Safety-Schichten
1. `sensitive`/CW raus · 2. Sprachfilter · 3. Wort-Blocklist · 4. Spam-Heuristik ·
5. *(später)* leichter Klassifizierer · + Themen-Hashtags statt News/Politik.

## Hashtag-Backbone (Vorschlag, an die Rubriken angelehnt)
- **Sport:** #sport #football #cycling #running
- **Technik:** #technology #ai #programming #opensource
- **Wissenschaft:** #science #space #astronomy #biology
- **Geschichte:** #history #archaeology
- **Natur:** #nature #wildlife #birds #plants
- **Kultur:** #art #music #books #film #photography
- *(Gesellschaft/News bewusst weg — am riskantesten für Kinder.)*

~6–8 Hashtags/Rubrik, je 40 frische Toots ziehen → Pool.

## MVP-Scope (klein anfangen)
- 1 Instanz (`mastodon.social`), 2 Sprachen (z. B. fr, en), ~6 Hashtags (1–2 pro Rubrik).
- Fetcher-Cron + `toot`-Tabelle + `GET /stream`.
- Stream-Tab: Liste + Niveau-Badge + Tag-Filter + Wort-/Satz-Übersetzung + „ins Deck".
- **Ohne** `/simplify`, **ohne** eigenen Klassifizierer (nur `sensitive` + Blocklist).

## Später / Extensions
- `/simplify` on-demand · **On-Device-Übersetzung** (Desktop-Chrome Built-in AI) als Gratis-Turbo ·
  mehr Instanzen/Sprachen · „Trending" als Würze · Klassifizierer · Medien/Bilder ·
  „Folge-Lektion" aus einem Toot generieren.

## Risiken / offen
- **Safety** (Hauptrisiko) — auch kuratierte Tags haben Ausreißer.
- Mastodon-Instanz-Verfügbarkeit / Rate-Limits / unauth-Sperren einzelner Instanzen.
- `language`-Feld nicht immer korrekt → Detektor-Gegencheck.
- Sehr kurze Toots → Schwierigkeits-Schätzung wackelig (kleine Stichprobe) → Mindestlänge.

## Kosten
- **Fetch:** nur DB, kein LLM.
- **Übersetzen on-tap:** über bestehenden `/sentence`-Cache → winzig.
- **`/simplify`:** on-demand, cost-capped.
→ Insgesamt **deutlich günstiger** als die Artikel-Pipeline.
