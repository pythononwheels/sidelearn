# Sidelearn Content Server

FastAPI container that pre-bakes the daily Wikipedia lessons (simplified to
A2–C1, with comprehension questions, vocab and a summary) so the extension can
serve them instantly. Read-only, no auth, no user data — everything it stores is
public Wikipedia content in the *learning* language. See
`../doc/tech/server.md` for the concept.

## Run locally

```bash
cd server
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # set LLM_PROVIDER + key (or leave mock)
uvicorn app.main:app --reload
```

On startup it builds today's content if missing (with `LLM_PROVIDER=mock` this is
instant and just passes the original text through). Then:

```bash
curl 'http://localhost:8000/health'
curl 'http://localhost:8000/daily?lang=fr&level=A2'
curl 'http://localhost:8000/lesson/<id>?level=B1'
```

## Docker

```bash
docker compose up --build -d
```

The SQLite DB persists in the `sidelearn-data` volume. The daily job runs at
`SL_BUILD_HOUR`.

## Caddy

```
sidelearn-api.example.com {
    reverse_proxy localhost:8000
}
```

CORS is open (public data), so the extension can fetch cross-origin.

## Config

See `.env.example`. Key vars: `LLM_PROVIDER` (`openai|gemini|mock`), the
provider key/model, `SL_LANGS`, `SL_LEVELS`, `SL_POOL`, `SL_MAX_PARAS`,
`SL_BUILD_HOUR`, `DB_PATH`.

## API

| Endpoint | Description |
|---|---|
| `GET /health` | status + config |
| `GET /daily?lang=&level=&date=` | the day's article pool (with `ready` + summary) |
| `GET /lesson/{id}?level=` | merged original + simplified paragraphs, questions, vocab, summary |
| `GET /archive?lang=&limit=` | past dates (for "old challenges") |
| `GET /random?lang=&level=` | a random prepared article |
