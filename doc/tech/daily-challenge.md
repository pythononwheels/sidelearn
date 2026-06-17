# Daily Challenge & Progress — Concept

Status: **draft / brainstorm** (not yet scheduled). Captures the idea so we can
slice it into shippable steps later.

Goal: a gentle *challenge → reward* loop that gives the learner something fresh
to read every day (real, topical, in the learning language) plus a light sense
of progress — without turning Sidelearn into a nagging gamified app. Stays true
to "assist, don't dominate".

---

## 1. Data source — Wikipedia featured feed

Endpoint (one call, no API key, public read-only):

```
GET https://{lang}.wikipedia.org/api/rest_v1/feed/featured/{YYYY}/{MM}/{DD}
```

Verified 2026-06-17 for fr/es/nl (de/en known good):

| Section      | de | en | fr | es | nl | Content |
|--------------|----|----|----|----|----|---------|
| `mostread`   | ✓  | ✓  | ✓  | ✓  | ✓  | ~50 real articles ranked by yesterday's views; each has title, `extract` (plain summary), thumbnail, `content_urls`. **Universal backbone.** |
| `tfa`        | ✓  | ✓  | ✗  | ✗  | ✗  | "Artikel des Tages" — only langs with a featured-article programme. |
| `news`       | ✓  | ✓  | ~  | ~  | ~  | "In den Nachrichten" — current events with linked articles. |
| `onthisday`  | ✓  | ✓  | ~  | ~  | ~  | "Was geschah am …" — historical events for the date. |
| `image`      | ✓  | ✓  | ~  | ~  | ~  | Picture of the day (Commons). |

(~ = present for some dates/langs; not relied upon.)

**Pick strategy:** use `tfa` when present, else `mostread`. `mostread` works in
every language we support and is *more* topical (what people actually read
today), so it is the safe default and the difficulty-filter pool.

**Networking note:** this is the **first non-localhost network call** in the
extension (dictionaries are bundled). It's a public Wikipedia endpoint, no user
data leaves the device, CORS-enabled, and covered by our existing `https://*/*`
host permission. Still worth a one-line mention in onboarding + privacy doc, and
ideally behind a setting (`dailyChallenge: on/off`) so the offline-purist user
can keep it fully local.

---

## 2. Difficulty pre-check (reuse what we have)

Each candidate carries an `extract`. Run it through the existing
frequency→CEFR banding (`difficulty/banding.ts`) to estimate the share of tokens
above the user's level:

- pick the candidate whose difficulty best *matches* the level (not trivial, not
  wall-of-unknown);
- tag the card: "passt zu A2" / "etwas anspruchsvoll" / "anspruchsvoll".

If the best candidate is still way too hard → offer the **side-by-side simpler
version** (see §4) instead of silently dropping it.

---

## 3. The Daily Challenge card (panel top)

Shown above the nav, collapsible, only after onboarding, refreshes per calendar
day:

```
🎯 Deine Daily Challenge — <Artikel des Tages>
   <one-line teaser from extract>            [passt zu A2]
   [ Lesen ]   [ erledigt ✓ ]
```

- **Lesen** → open the article URL in a new tab (marking auto-on, as today).
- **erledigt ✓** → mark today's challenge done → streak++, small reward cue.
- If too hard → a third affordance: **In einfacherer Sprache** (§4).

State persisted: `{ date, lang, articleTitle, url, done }` — so reopening the
panel the same day shows the same challenge and its done-state.

---

## 4. "Einfachere Sprache" side-by-side (phase 2, LLM)

When the chosen article is above level, offer a simplified read:

- **v1 (cheap):** simplify just the **lead / extract** to the user's CEFR level
  via the local LLM, shown side-by-side (original ‖ simplified) in the panel,
  with a link to read the full original with heavy marking.
- **v2:** per-paragraph simplify-on-demand inside a reader view (ties into the
  already-open "Reader view in panel" task).

Trade-off: full-article rewrite is long/expensive on a local model; start with
the lead so it stays snappy and useful as a "taster".

---

## 5. Progress / reward

### Daily goals (configurable, gentle)
- e.g. **10 neue Vokabeln/Tag**, 1 Artikel gelesen, 1 Quiz gemacht.
- progress ring / "7/10" on the start card; streak counter for consecutive days
  with the challenge done.

### Stats card (panel start)
- **Neue Vokabeln:** letzte 7 Tage / 30 Tage / all-time — derivable *today* from
  `vocab[].ts`.
- **Quiz:** beantwortet, richtig/falsch, Quote; Anzahl Quizzes.
- Reward: streak badges, a small "erledigt" flourish, maybe a soft level/XP.

### Data we have vs. need
- **Have:** `vocab[]` with `ts`, `reviews`, `correct`, `lastReviewed` → vocab
  counts + review accuracy come for free.
- **Need new stores:**
  - `daily` — today's challenge + done flag + streak + per-day goal progress.
  - `stats` — **page-quiz** results are currently *not* persisted (only shown in
    the Quiz UI). Persist `{date, total, correct}` per quiz to feed quiz stats.
  - `settings.dailyChallenge` (on/off) + goal config.

---

## 6. Suggested phasing

- **Phase 1 (small, high value):** Daily Challenge card from `tfa`/`mostread` +
  difficulty tag + **Lesen** + **erledigt ✓** + streak. Stats card with vocab
  counts (7d/30d/all) + review accuracy — all from data we already store.
  New: `core/daily.ts`, `core/wikifeed.ts`, `settings.dailyChallenge`.
- **Phase 2:** difficulty-aware candidate pick; persist page-quiz results →
  quiz stats; daily goals + progress rings.
- **Phase 3:** "einfachere Sprache" side-by-side; variety from `news` /
  `onthisday` / `image`; badges.

---

## 7. Open decisions

1. **Card placement:** dedicated top card vs. a fourth accordion section.
   (Lean: small top card — a challenge is a call-to-action, not an archive.)
2. **Source scope:** Wikipedia-only daily, or also let "the current page" count
   as today's challenge? (Lean: Wikipedia daily for the *offer*; any read can
   satisfy goals.)
3. **Opt-in:** default the network feed on or off? (Lean: on, with a clear
   toggle + onboarding mention, given it's read-only public data.)
4. **Reward tone:** how much gamification before it feels naggy? Keep it to
   streak + counts + a quiet flourish; no popups, no guilt.
