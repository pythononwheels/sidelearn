"""The daily build: fetch each language's pool, store originals, and prepare a
lesson per level via the LLM. Idempotent — skips work already in the DB."""

import asyncio
from datetime import date, datetime, timezone

import httpx

from . import config, db, llm, wiki


def today_key() -> str:
    return datetime.now().strftime("%Y-%m-%d")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def build_day(day: date | None = None) -> dict[str, int]:
    day = day or date.today()
    dkey = day.strftime("%Y-%m-%d")
    stats = {"articles": 0, "prepared": 0}
    async with httpx.AsyncClient(timeout=30) as client:
        for lang in config.LANGS:
            pool = await wiki.fetch_pool(client, lang, day, config.POOL)
            for rank, a in enumerate(pool):
                if not db.has_article(a["id"]):
                    paras = await wiki.fetch_paragraphs(client, lang, a["title"], config.MAX_PARAS)
                    if not paras:
                        continue
                    db.upsert_article({**a, "paragraphs": paras}, _now())
                    stats["articles"] += 1
                db.upsert_daily(dkey, lang, rank, a["id"])
                stats["prepared"] += _prepare_levels(a["id"], lang)
    return stats


def _prepare_levels(article_id: str, lang: str) -> int:
    art = db.get_article(article_id)
    if not art:
        return 0
    made = 0
    for level in config.LEVELS:
        if db.has_prepared(article_id, level):
            continue
        # LLM calls are blocking; run them off the event loop in build_day's caller.
        data = llm.prepare(art["paragraphs"], lang, level)
        db.upsert_prepared(article_id, level, data, _now())
        made += 1
    return made


async def ensure_today() -> dict[str, int]:
    """Build today's content if the first language has none yet."""
    if db.daily_article_ids(today_key(), config.LANGS[0]):
        return {"articles": 0, "prepared": 0}
    # LLM prepare is synchronous/blocking — run the whole build in a thread.
    return await asyncio.to_thread(_build_today_sync)


def _build_today_sync() -> dict[str, int]:
    return asyncio.run(build_day())
