"""Tiny SQLite layer. One connection per call keeps it thread-safe across the
API workers and the background scheduler without extra locking."""

import json
import sqlite3
from contextlib import contextmanager
from typing import Any, Iterator, Optional

from . import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS article (
  id TEXT PRIMARY KEY,
  lang TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  thumbnail TEXT,
  paragraphs TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS prepared (
  article_id TEXT NOT NULL,
  level TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (article_id, level)
);
CREATE TABLE IF NOT EXISTS daily (
  date TEXT NOT NULL,
  lang TEXT NOT NULL,
  rank INTEGER NOT NULL,
  article_id TEXT NOT NULL,
  PRIMARY KEY (date, lang, article_id)
);
CREATE INDEX IF NOT EXISTS idx_daily_lookup ON daily (date, lang, rank);
CREATE INDEX IF NOT EXISTS idx_article_lang ON article (lang);
CREATE TABLE IF NOT EXISTS area_pool (
  area TEXT NOT NULL,
  lang TEXT NOT NULL,
  article_id TEXT NOT NULL,
  added_at TEXT NOT NULL,
  PRIMARY KEY (area, lang, article_id)
);
CREATE INDEX IF NOT EXISTS idx_area_pool ON area_pool (area, lang);
CREATE TABLE IF NOT EXISTS toot (
  id TEXT PRIMARY KEY,            -- "{instance}:{status_id}" (globally unique)
  lang TEXT NOT NULL,             -- detector-confirmed learn language
  instance TEXT NOT NULL,
  url TEXT NOT NULL,              -- link to the original toot
  author TEXT,
  author_handle TEXT,
  content TEXT NOT NULL,          -- cleaned plain text (links/mentions stripped)
  media_url TEXT,                 -- image: media attachment or link-preview card
  tags TEXT,                      -- comma-sep hashtags of the post (lowercased)
  rubrik TEXT,                    -- our topic the query-tag maps to (sport, natur…)
  created_at TEXT,
  fetched_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_toot_stream ON toot (lang, created_at);
CREATE TABLE IF NOT EXISTS telemetry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  fn TEXT,
  level TEXT,
  lang TEXT,
  article_id TEXT,
  article_url TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd REAL,
  ms INTEGER,
  status TEXT,
  error TEXT,
  excerpt TEXT
);
CREATE INDEX IF NOT EXISTS idx_telemetry_ts ON telemetry (ts);
CREATE TABLE IF NOT EXISTS word_cache (
  lang TEXT NOT NULL,
  native TEXT NOT NULL,
  word TEXT NOT NULL,
  shash TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (lang, native, word, shash)
);
CREATE TABLE IF NOT EXISTS abuse (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  ip TEXT,
  path TEXT,
  kind TEXT
);
CREATE INDEX IF NOT EXISTS idx_abuse_ts ON abuse (ts);
CREATE INDEX IF NOT EXISTS idx_abuse_ip ON abuse (ip);
"""


@contextmanager
def conn() -> Iterator[sqlite3.Connection]:
    # WAL + busy_timeout so reads (e.g. /daily) don't fail with "database is
    # locked" while the daily auto-build is writing prepared lessons.
    c = sqlite3.connect(config.DB_PATH, check_same_thread=False, timeout=10)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA journal_mode=WAL")
    c.execute("PRAGMA busy_timeout=10000")
    try:
        yield c
        c.commit()
    finally:
        c.close()


def init() -> None:
    with conn() as c:
        c.executescript(SCHEMA)
        # Idempotent column migrations for tables that shipped before a column existed.
        for table, col, decl in [("toot", "media_url", "TEXT")]:
            try:
                c.execute(f"ALTER TABLE {table} ADD COLUMN {col} {decl}")
            except sqlite3.OperationalError:
                pass  # already there


def upsert_article(art: dict[str, Any], now: str) -> None:
    with conn() as c:
        c.execute(
            """INSERT INTO article (id, lang, title, url, thumbnail, paragraphs, fetched_at)
               VALUES (?,?,?,?,?,?,?)
               ON CONFLICT(id) DO UPDATE SET title=excluded.title, thumbnail=excluded.thumbnail""",
            (art["id"], art["lang"], art["title"], art["url"], art.get("thumbnail"),
             json.dumps(art["paragraphs"], ensure_ascii=False), now),
        )


def get_article(article_id: str) -> Optional[dict[str, Any]]:
    with conn() as c:
        row = c.execute("SELECT * FROM article WHERE id=?", (article_id,)).fetchone()
    if not row:
        return None
    d = dict(row)
    d["paragraphs"] = json.loads(d["paragraphs"])
    return d


def has_article(article_id: str) -> bool:
    with conn() as c:
        return c.execute("SELECT 1 FROM article WHERE id=?", (article_id,)).fetchone() is not None


def upsert_daily(date: str, lang: str, rank: int, article_id: str) -> None:
    with conn() as c:
        c.execute(
            """INSERT INTO daily (date, lang, rank, article_id) VALUES (?,?,?,?)
               ON CONFLICT(date, lang, article_id) DO UPDATE SET rank=excluded.rank""",
            (date, lang, rank, article_id),
        )


def daily_article_ids(date: str, lang: str) -> list[str]:
    with conn() as c:
        rows = c.execute(
            "SELECT article_id FROM daily WHERE date=? AND lang=? ORDER BY rank", (date, lang)
        ).fetchall()
    return [r["article_id"] for r in rows]


def daily_dates(lang: str, limit: int) -> list[str]:
    with conn() as c:
        rows = c.execute(
            "SELECT DISTINCT date FROM daily WHERE lang=? ORDER BY date DESC LIMIT ?", (lang, limit)
        ).fetchall()
    return [r["date"] for r in rows]


def add_area_pool(area: str, lang: str, article_id: str, now: str) -> None:
    with conn() as c:
        c.execute(
            """INSERT INTO area_pool (area, lang, article_id, added_at) VALUES (?,?,?,?)
               ON CONFLICT(area, lang, article_id) DO NOTHING""",
            (area, lang, article_id, now),
        )


def area_pool_count(area: str, lang: str) -> int:
    with conn() as c:
        row = c.execute(
            "SELECT count(*) n FROM area_pool WHERE area=? AND lang=?", (area, lang)
        ).fetchone()
    return row["n"]


def area_pool_article_ids(area: str, lang: str) -> list[str]:
    with conn() as c:
        rows = c.execute(
            "SELECT article_id FROM area_pool WHERE area=? AND lang=?", (area, lang)
        ).fetchall()
    return [r["article_id"] for r in rows]


def random_area_prepared(area: str, lang: str, level: str) -> Optional[str]:
    """A random pooled article for (area, lang) that already has `level` prepared."""
    with conn() as c:
        row = c.execute(
            """SELECT p.article_id FROM area_pool ap
                 JOIN prepared p ON p.article_id = ap.article_id
                WHERE ap.area=? AND ap.lang=? AND p.level=? AND p.schema_version=?
                ORDER BY RANDOM() LIMIT 1""",
            (area, lang, level, config.SCHEMA_VERSION),
        ).fetchone()
    return row["article_id"] if row else None


def area_pool_prepared(
    lang: str, level: str, date: Optional[str] = None, since: Optional[str] = None
) -> list[dict[str, Any]]:
    """All pooled area articles for (lang) that already have `level` prepared —
    instant to serve. If `date` (YYYY-MM-DD) is given, only those added that day;
    else if `since` (YYYY-MM-DD) is given, only those added on/after that date."""
    sql = (
        "SELECT ap.area AS area, a.id AS id, a.title AS title, a.url AS url, a.thumbnail AS thumbnail "
        "FROM area_pool ap "
        "JOIN article a ON a.id = ap.article_id "
        "JOIN prepared p ON p.article_id = ap.article_id AND p.level=? AND p.schema_version=? "
        "WHERE ap.lang=? "
    )
    params: list[Any] = [level, config.SCHEMA_VERSION, lang]
    if date:
        sql += "AND substr(ap.added_at, 1, 10) = ? "
        params.append(date)
    elif since:
        sql += "AND substr(ap.added_at, 1, 10) >= ? "
        params.append(since)
    sql += "ORDER BY ap.area, ap.added_at DESC"
    with conn() as c:
        rows = c.execute(sql, params).fetchall()
    return [{"area": r["area"], "id": r["id"], "title": r["title"], "url": r["url"], "thumbnail": r["thumbnail"]} for r in rows]


def upsert_toot(t: dict[str, Any]) -> bool:
    """Insert a harvested toot; ignore if its id is already pooled. Returns True
    if a NEW row was added (so the harvester can count fresh toots)."""
    with conn() as c:
        cur = c.execute(
            """INSERT INTO toot
               (id, lang, instance, url, author, author_handle, content, media_url, tags, rubrik, created_at, fetched_at)
               VALUES (:id,:lang,:instance,:url,:author,:author_handle,:content,:media_url,:tags,:rubrik,:created_at,:fetched_at)
               ON CONFLICT(id) DO UPDATE SET media_url=excluded.media_url
                 WHERE COALESCE(toot.media_url,'')='' AND COALESCE(excluded.media_url,'')!=''""",
            t,
        )
        return cur.rowcount > 0


def stream_toots(
    lang: str, rubriks: Optional[list[str]] = None, since: Optional[str] = None, limit: int = 50
) -> list[dict[str, Any]]:
    """Pooled toots for `lang`, newest first. `rubriks` filters by topic;
    `since` (ISO) keeps only newer toots."""
    sql = (
        "SELECT id, lang, instance, url, author, author_handle, content, media_url, tags, rubrik, created_at "
        "FROM toot WHERE lang=? "
    )
    params: list[Any] = [lang]
    if since:
        sql += "AND created_at >= ? "
        params.append(since)
    if rubriks:
        sql += "AND rubrik IN (%s) " % ",".join("?" * len(rubriks))
        params.extend(rubriks)
    sql += "ORDER BY created_at DESC LIMIT ?"
    params.append(limit)
    with conn() as c:
        rows = c.execute(sql, params).fetchall()
    return [dict(r) for r in rows]


def prune_toots(keep_days: int) -> int:
    """Delete toots older than `keep_days` (by created_at). Returns rows removed."""
    from datetime import datetime, timedelta, timezone

    cutoff = (datetime.now(timezone.utc) - timedelta(days=keep_days)).isoformat()
    with conn() as c:
        cur = c.execute("DELETE FROM toot WHERE created_at < ?", (cutoff,))
        return cur.rowcount


def toot_overview() -> list[dict[str, Any]]:
    """Counts per (lang, rubrik) — for admin/verification."""
    with conn() as c:
        rows = c.execute(
            "SELECT lang, rubrik, count(*) n FROM toot GROUP BY lang, rubrik ORDER BY lang, rubrik"
        ).fetchall()
    return [dict(r) for r in rows]


def random_article(lang: str) -> Optional[dict[str, Any]]:
    with conn() as c:
        row = c.execute(
            "SELECT * FROM article WHERE lang=? ORDER BY RANDOM() LIMIT 1", (lang,)
        ).fetchone()
    if not row:
        return None
    d = dict(row)
    d["paragraphs"] = json.loads(d["paragraphs"])
    return d


def has_prepared(article_id: str, level: str) -> bool:
    with conn() as c:
        row = c.execute(
            "SELECT 1 FROM prepared WHERE article_id=? AND level=? AND schema_version=?",
            (article_id, level, config.SCHEMA_VERSION),
        ).fetchone()
    return row is not None


def upsert_prepared(article_id: str, level: str, data: dict[str, Any], now: str) -> None:
    with conn() as c:
        c.execute(
            """INSERT INTO prepared (article_id, level, schema_version, data, created_at)
               VALUES (?,?,?,?,?)
               ON CONFLICT(article_id, level) DO UPDATE SET
                 schema_version=excluded.schema_version, data=excluded.data, created_at=excluded.created_at""",
            (article_id, level, config.SCHEMA_VERSION, json.dumps(data, ensure_ascii=False), now),
        )


def prepared_levels(article_id: str) -> list[str]:
    with conn() as c:
        rows = c.execute(
            "SELECT level FROM prepared WHERE article_id=? AND schema_version=?",
            (article_id, config.SCHEMA_VERSION),
        ).fetchall()
    return [r["level"] for r in rows]


def get_prepared(article_id: str, level: str) -> Optional[dict[str, Any]]:
    with conn() as c:
        row = c.execute(
            "SELECT data FROM prepared WHERE article_id=? AND level=? AND schema_version=?",
            (article_id, level, config.SCHEMA_VERSION),
        ).fetchone()
    return json.loads(row["data"]) if row else None


def add_telemetry(row: dict[str, Any]) -> None:
    with conn() as c:
        c.execute(
            """INSERT INTO telemetry
               (ts,provider,model,fn,level,lang,article_id,article_url,
                input_tokens,output_tokens,cost_usd,ms,status,error,excerpt)
               VALUES (:ts,:provider,:model,:fn,:level,:lang,:article_id,:article_url,
                :input_tokens,:output_tokens,:cost_usd,:ms,:status,:error,:excerpt)""",
            row,
        )


def telemetry_totals() -> dict[str, Any]:
    with conn() as c:
        r = c.execute(
            """SELECT count(*) calls, coalesce(sum(input_tokens),0) tin,
                      coalesce(sum(output_tokens),0) tout, coalesce(sum(cost_usd),0) cost,
                      coalesce(sum(status='error'),0) errors
               FROM telemetry"""
        ).fetchone()
    return dict(r)


def telemetry_by_fn() -> list[dict[str, Any]]:
    with conn() as c:
        rows = c.execute(
            """SELECT fn||coalesce(':'||level,'') label, count(*) calls,
                      coalesce(sum(input_tokens),0) tin, coalesce(sum(output_tokens),0) tout,
                      coalesce(sum(cost_usd),0) cost,
                      coalesce(avg(input_tokens),0) ain, coalesce(avg(output_tokens),0) aout,
                      coalesce(avg(cost_usd),0) acost
               FROM telemetry GROUP BY label ORDER BY cost DESC"""
        ).fetchall()
    return [dict(r) for r in rows]


def telemetry_by_lang() -> list[dict[str, Any]]:
    with conn() as c:
        rows = c.execute(
            """SELECT lang, count(*) calls, coalesce(sum(input_tokens),0) tin,
                      coalesce(sum(output_tokens),0) tout, coalesce(sum(cost_usd),0) cost
               FROM telemetry GROUP BY lang ORDER BY lang"""
        ).fetchall()
    return [dict(r) for r in rows]


def telemetry_by_day(limit: int = 14) -> list[dict[str, Any]]:
    with conn() as c:
        rows = c.execute(
            """SELECT substr(ts,1,10) day, count(*) calls,
                      coalesce(sum(CASE WHEN status='ok' THEN 1 ELSE 0 END),0) ok,
                      coalesce(sum(CASE WHEN status!='ok' THEN 1 ELSE 0 END),0) err,
                      coalesce(sum(cost_usd),0) cost
               FROM telemetry GROUP BY day ORDER BY day DESC LIMIT ?""",
            (limit,),
        ).fetchall()
    return [dict(r) for r in rows]


def telemetry_daily_series(days: int = 365) -> list[dict[str, Any]]:
    """Per-calendar-day {day, calls, ok, err, cost}, zero-filled over the last
    `days` days (continuous, so charts can show empty days)."""
    from datetime import datetime, timedelta, timezone

    rows = {d["day"]: d for d in telemetry_by_day(max(days, 1) + 5)}
    today = datetime.now(timezone.utc).date()
    out: list[dict[str, Any]] = []
    for i in range(days - 1, -1, -1):
        key = (today - timedelta(days=i)).strftime("%Y-%m-%d")
        r = rows.get(key)
        out.append(
            {"day": key, "calls": r["calls"] if r else 0, "ok": r["ok"] if r else 0,
             "err": r["err"] if r else 0, "cost": r["cost"] if r else 0.0}
        )
    return out


def area_pool_overview() -> list[dict[str, Any]]:
    with conn() as c:
        rows = c.execute(
            "SELECT area, lang, count(*) n FROM area_pool GROUP BY area, lang ORDER BY area, lang"
        ).fetchall()
    return [dict(r) for r in rows]


def telemetry_count_today(fn: str) -> int:
    from datetime import datetime, timezone

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    with conn() as c:
        row = c.execute(
            "SELECT count(*) n FROM telemetry WHERE fn=? AND ts LIKE ?", (fn, today + "%")
        ).fetchone()
    return row["n"]


def cost_today() -> float:
    """Total LLM cost (USD) recorded today (UTC) across all functions — drives the
    hard daily cost cap."""
    from datetime import datetime, timezone

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    with conn() as c:
        row = c.execute(
            "SELECT COALESCE(SUM(cost_usd), 0) c FROM telemetry WHERE ts LIKE ?", (today + "%",)
        ).fetchone()
    return float(row["c"] or 0.0)


def log_abuse(ip: str, path: str, kind: str) -> None:
    """Record a blocked/limited request (kind: 'ratelimit' | 'origin' | 'blocked')
    so repeat offenders can be reviewed and IP-blocked."""
    from datetime import datetime, timezone

    try:
        with conn() as c:
            c.execute(
                "INSERT INTO abuse (ts, ip, path, kind) VALUES (?,?,?,?)",
                (datetime.now(timezone.utc).isoformat(), ip, path, kind),
            )
    except Exception:  # noqa: BLE001 — logging must never break a request
        pass


def abuse_top(hours: int = 24, limit: int = 50) -> list[dict[str, Any]]:
    """Repeat offenders in the last `hours`: IP, hit count, kinds, last seen."""
    from datetime import datetime, timezone, timedelta

    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    with conn() as c:
        rows = c.execute(
            "SELECT ip, count(*) hits, group_concat(DISTINCT kind) kinds, max(ts) last "
            "FROM abuse WHERE ts >= ? GROUP BY ip ORDER BY hits DESC LIMIT ?",
            (since, limit),
        ).fetchall()
    return [dict(r) for r in rows]


def get_word_cache(lang: str, native: str, word: str, shash: str) -> Optional[dict[str, Any]]:
    with conn() as c:
        row = c.execute(
            "SELECT data FROM word_cache WHERE lang=? AND native=? AND word=? AND shash=?",
            (lang, native, word.lower(), shash),
        ).fetchone()
    return json.loads(row["data"]) if row else None


def put_word_cache(lang: str, native: str, word: str, shash: str, data: dict[str, Any], now: str) -> None:
    with conn() as c:
        c.execute(
            """INSERT INTO word_cache (lang, native, word, shash, data, created_at)
               VALUES (?,?,?,?,?,?)
               ON CONFLICT(lang, native, word, shash) DO UPDATE SET data=excluded.data""",
            (lang, native, word.lower(), shash, json.dumps(data, ensure_ascii=False), now),
        )


def telemetry_recent(limit: int = 25) -> list[dict[str, Any]]:
    with conn() as c:
        rows = c.execute(
            "SELECT * FROM telemetry ORDER BY id DESC LIMIT ?", (limit,)
        ).fetchall()
    return [dict(r) for r in rows]
