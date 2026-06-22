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
"""


@contextmanager
def conn() -> Iterator[sqlite3.Connection]:
    c = sqlite3.connect(config.DB_PATH, check_same_thread=False)
    c.row_factory = sqlite3.Row
    try:
        yield c
        c.commit()
    finally:
        c.close()


def init() -> None:
    with conn() as c:
        c.executescript(SCHEMA)


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
                      coalesce(sum(cost_usd),0) cost
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


def telemetry_count_today(fn: str) -> int:
    from datetime import datetime, timezone

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    with conn() as c:
        row = c.execute(
            "SELECT count(*) n FROM telemetry WHERE fn=? AND ts LIKE ?", (fn, today + "%")
        ).fetchone()
    return row["n"]


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
