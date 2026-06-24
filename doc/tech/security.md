# Server-Schutz: Rate-Limits, Missbrauch & Kosten-Cap

Schutz der öffentlichen LLM-Endpoints (`api.sidelearn.pyrates.io`) gegen Missbrauch und Kostenausreißer.
Alle Werte sind env-tunebar in `server/.env` (Defaults in `server/app/config.py`). Stand: siehe CHANGELOG.

## Schichten (von außen nach innen)
1. **CORS** auf die PWA-Origin verengt (`ALLOWED_ORIGIN_REGEX`, Default `learny.pyrates.io` + localhost).
2. **Origin-Gate** auf allen Kosten-Endpoints: kein/falscher `Origin` (bzw. `Referer`) → **403**
   (`require_origin` in `main.py`). Stoppt curl/Bots/Fremdseiten. Von Profis mit gefälschtem Header
   umgehbar → dann greifen 3–5.
3. **Per-IP-Rate-Limit** (slowapi, IP aus `X-Forwarded-For` via Caddy) → **429** bei Überschreitung.
4. **Eingabe-Limits** (Überlänge → **400**): killt „100k-Wörter"-Anfragen am Eingang.
5. **Per-Funktion-Tages-Caps** (Call-Zähler aus Telemetrie) → **429**.
6. **Harter Tages-Kosten-Cap** (Summe `cost_usd` aus Telemetrie) → **429**; stoppt ALLE frischen LLM-Calls.
7. **Output-Caps** (`max_output_tokens` + Trim) + **gehärtete Prompts** (Eingabe = Daten, Anweisungen ignorieren).

Gecachte/vorgebaute Inhalte (Wort-Cache, prebuilt Lessons, Area-Pool) werden **immer** ausgeliefert —
auch wenn Caps/Cost-Cap greifen. Nur *frische* LLM-Calls werden blockiert.

## Per-IP-Rate-Limits (slowapi)  — `config.RL_*`
| Endpoint | Default | Env |
|---|---|---|
| `/translate` | 30/min | `SL_RL_TRANSLATE` |
| `/sentence` | 20/min | `SL_RL_SENTENCE` |
| `/digest/{id}` | 20/min | `SL_RL_DIGEST` |
| `/surprise` | 8/min | `SL_RL_SURPRISE` |
| `/lesson/{id}`, `/random` | 60/min | `SL_RL_LESSON` |
| `/areas/list` | 60/min | `SL_RL_AREAS` |
(`/daily`, `/archive`, `/areas`, `/health` haben kein Limit — billig/gecacht. `/areas/list` ist
zwar auch nur DB (kein LLM), aber ein 3-Tabellen-Join → Origin-Gate **+** Rate-Limit als Schutz.)

## Eingabe-Limits — `config.MAX_*` (→ 400)
| Feld | Default | Env |
|---|---|---|
| `word` (/translate) | 64 Zeichen, ≤3 Tokens, keine Zeilenumbrüche | `SL_MAX_WORD_LEN` |
| `sentence` (/translate) | 300 Zeichen | `SL_MAX_SENTENCE_LEN` |
| `text` (/sentence) | 400 Zeichen | `SL_MAX_TEXT_LEN` |

## Output-Caps — `config.*_MAX_OUT`
| Call | max_output_tokens | Env |
|---|---|---|
| translate | 120 | `SL_TRANSLATE_MAX_OUT` |
| sentence | 300 | `SL_SENTENCE_MAX_OUT` |
| digest | skaliert (`DIGEST_WORDS×4+160`, ≤512) | — |
Zusätzlich harte String-Trims: translation ≤80, Satzübersetzung ≤600 Zeichen.

## Per-Funktion-Tages-Caps (Call-Zähler) — `config.*_DAILY_CAP`
| fn | Default Calls/Tag | Env |
|---|---|---|
| translate | 3000 | `SL_TRANSLATE_DAILY_CAP` |
| sentence | 2000 | `SL_SENTENCE_DAILY_CAP` |
| surprise | 200 | `SL_SURPRISE_DAILY_CAP` |
| ondemand (lazy lesson) / digest | 300 | `SL_ONDEMAND_DAILY_CAP` |
| area (Pool-Top-up) | 500 | `SL_AREA_DAILY_CAP` |
Gemessen via `db.telemetry_count_today(fn)` (UTC-Tag, `ts LIKE 'YYYY-MM-DD%'`).

## Harter Tages-Kosten-Cap — `config.DAILY_COST_CAP_USD`
- Default **$1.50/Tag** (Env `SL_DAILY_COST_CAP_USD`).
- Gemessen aus Telemetrie: `db.cost_today()` = `SUM(cost_usd)` für den UTC-Tag.
- Durchgesetzt **vor jedem frischen LLM-Call**: `_cost_guard()` in `/translate`, `/sentence`, `/digest`,
  `/surprise`, `_ensure_prepared` (lazy `/lesson`), **und** in `pipeline.process_article` (deckt den
  nächtlichen Build ab). Ist der Cap erreicht → **429** bzw. Build bricht ab.
- Greift global über alle Funktionen (anders als die per-fn Call-Caps) → ultimativer Kosten-Backstop.

## Wo es im Code liegt
- `server/app/config.py` — alle Defaults/Env (Origins, RL_*, MAX_*, *_MAX_OUT, *_DAILY_CAP, DAILY_COST_CAP_USD).
- `server/app/main.py` — CORS, slowapi-Setup, `require_origin`, `_cost_guard`, Eingabe-Validierung,
  `@limiter.limit` + `Depends(require_origin)` an den Kosten-Endpoints.
- `server/app/llm.py` — `max_output_tokens` in `_gemini`/`_openai`, Prompt-Härtung, Output-Trim.
- `server/app/db.py` — `telemetry_count_today(fn)`, `cost_today()`.
- `server/app/pipeline.py` — Kosten-Cap-Check im Build (`process_article`).

## Verifikation (curl)
```
B=https://api.sidelearn.pyrates.io
curl -s -o /dev/null -w '%{http_code}\n' "$B/translate?lang=fr&native=de&word=chat"            # 403 (kein Origin)
curl -s -o /dev/null -w '%{http_code}\n' -H 'Origin: https://learny.pyrates.io' "$B/translate?lang=fr&native=de&word=chat&sentence=le%20chat"  # 200
curl -s -o /dev/null -w '%{http_code}\n' -H 'Origin: https://learny.pyrates.io' "$B/sentence?lang=fr&native=de&text=<5000 Zeichen>"            # 400
# Rate-Limit: >RL Anfragen/min von einer IP → 429
# Cost-Cap testen: SL_DAILY_COST_CAP_USD=0 → alle frischen LLM-Calls 429
```

## Abuse-Logging & IP-Blocklist
- Jeder **429 (Rate-Limit)**, **403 (Origin)** und **403 (geblockte IP)** wird in der DB-Tabelle
  `abuse` protokolliert (`ts, ip, path, kind`) via `db.log_abuse(...)`. IP = echte Client-IP aus
  `X-Forwarded-For`.
- **Wiederholungstäter ansehen:** `/admin/abuse` (hinter Caddy-Basicauth) — Top-IPs nach Hits der
  letzten 24 h / 7 Tage (`db.abuse_top`).
- **IP hart blocken:** IP in `SL_BLOCKED_IPS` (.env, kommagetrennt) eintragen + Server neu laden →
  sofort 403 auf den Kosten-Endpoints (`config.BLOCKED_IPS`, geprüft in `require_origin`).

## Offen / optional
- **Cloudflare Turnstile** (unsichtbares CAPTCHA) für echten Bot-Schutz statt nur Origin-Gate.
- Retry/Backoff bei transienten Gemini-503 (statt 502 an den Client).
- Caddy-seitiges IP-Rate-Limit als zusätzliche Schicht.
