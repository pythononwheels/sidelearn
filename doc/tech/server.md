# Sidelearn Content Server — concept

A small FastAPI container that **pre-bakes** the daily reading content so the
extension can offer instant, high-quality, multi-level lessons. Optional: the
extension works fully locally without it.

## Why

- **Speed:** lessons are prepared ahead of time — no waiting on the local model.
- **Quality:** a cloud LLM simplifies better than a small local model.
- **Multi-level:** every article is prepared for A2/B1/B2/C1, so "same article in
  B1" is a dropdown.
- **Privacy:** only public Wikipedia content goes up; the server is
  **native-language-agnostic** (everything it stores is in the *learning*
  language). No user data, no auth.

## Separation of concerns

- **Server = public/static**: daily article pool, simplified paragraphs,
  comprehension questions, vocabulary, summary — all in the learning language.
- **Local (LM Studio) = personal/interactive**: hover explanations, page chat,
  page translate, live marking, and translating server vocab into the user's
  native language. None of this leaves the device.

## Pipeline (daily job)

For each language (`fr,de,en,nl,es`):
1. Fetch the Wikipedia featured feed (today, fallback yesterday).
2. Pick the day's pool (`tfa` + top `mostread`, `SL_POOL` items).
3. For each article: fetch full text → clean paragraphs → cap to `SL_MAX_PARAS`.
4. For each `(article, level)`: **one** LLM call returns simplified paragraphs +
   one MC question per paragraph + vocab + a level summary (minified JSON).
5. Store in SQLite.

Cost is bounded: ~5 langs × ~4 articles × 4 levels = ~80 calls/day, batchable.

## Storage (SQLite)

- `article(id, lang, title, url, thumbnail, paragraphs_json, fetched_at)`
- `prepared(article_id, level, schema_version, data_json, created_at)`
- `daily(date, lang, rank, article_id)`

`id = sha1(url)`. `data_json` =
`{"paragraphs":[{"simplified","question":{"q","options","correct"}}],"vocab":[{"word","hint"}],"summary"}`.

## API (read-only, CORS open)

- `GET /health`
- `GET /daily?lang=fr&level=A2&date=YYYY-MM-DD` → pool for the day (ready flags).
- `GET /lesson/{id}?level=A2` → merged original + prepared lesson.
- `GET /archive?lang=fr&limit=30` → past days (for "old challenges").
- `GET /random?lang=fr` → a random past article.

## Config (env)

`LLM_PROVIDER=openai|gemini|mock`, `OPENAI_API_KEY`/`OPENAI_MODEL`,
`GEMINI_API_KEY`/`GEMINI_MODEL`, `SL_LANGS`, `SL_LEVELS`, `SL_POOL`,
`SL_MAX_PARAS`, `DB_PATH`, `SL_BUILD_HOUR`.

## Deploy

Runs behind the existing Caddy reverse proxy on a subdomain (TLS). Container
exposes `:8000`; mount a volume for the SQLite DB. CORS is open (public data).

## Licensing

Wikipedia text is CC BY-SA. Responses carry the source URL + attribution; the
simplified derivative is shared under the same terms.

## Phases

1. **MVP (this):** pipeline + simplify/questions/vocab/summary + `/daily` +
   `/lesson`. Extension: opt-in toggle + server client with local fallback +
   level dropdown.
2. `/archive` + `/random` UI; scheduler hardening; retries/backoff.
3. Per-level tuning, more languages, caching/CDN.
