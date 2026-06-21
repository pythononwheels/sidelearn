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

## Deploy (prod host, mirrors the other /opt services)

```bash
# one-time on the host
sudo mkdir -p /opt/sidelearn && sudo chown "$USER" /opt/sidelearn
git clone https://github.com/pythononwheels/sidelearn.git /opt/sidelearn
cd /opt/sidelearn/server
cp .env.example .env        # set LLM_PROVIDER=gemini + GEMINI_API_KEY
./deploy.sh                 # build + up + health on 127.0.0.1:9990

# Caddy: append this block to /etc/caddy/Caddyfile, then validate + reload.
# (Config is NOT committed — the host's Caddyfile is the source of truth.)
sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy
```

Caddy block (the `/admin*` basicauth hash via
`caddy hash-password --plaintext '…'`):

```
api.sidelearn.pyrates.io {
    import security_headers
    encode zstd gzip
    @admin path /admin*
    basicauth @admin {
        khz <BCRYPT_HASH>
    }
    reverse_proxy localhost:9990
}
```

Updates later: `cd /opt/sidelearn/server && ./deploy.sh` (git pull + rebuild).

CORS is open (public data), so the extension can fetch cross-origin.

## Admin dashboard

The container boots and just **serves**; content is prepared manually at
`/admin` (protect it with the Caddy basicauth above). Flow:

1. **Entdecken** (per language/day) — fetches the Wikipedia pool + article text,
   no LLM. Fast.
2. **Verarbeiten** (per article, background) — simplifies to each level + makes
   questions, vocab and a summary via the LLM. One failing level/article never
   aborts the rest.

`/admin` → language tabs + "Heute entdecken" + day list. `/admin/day?lang=&date=`
→ article cards with level badges, "Verarbeiten" / "Alle verarbeiten", and
"Ansehen" to inspect the prepared content. Set `SL_AUTO_BUILD=1` to instead
discover+process automatically on startup and daily.

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
