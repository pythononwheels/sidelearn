"""Two-stage content prep, decoupled so it can be triggered manually:

  1. discover(lang, day)   — fetch the day's pool + article text. No LLM. Fast.
  2. process_article(id)   — simplify to each level + questions + vocab + summary
                              via the LLM. Resilient (one failing level/article
                              never aborts the rest).

build_day() chains both and is only used when SL_AUTO_BUILD=1.
"""

import asyncio
from datetime import date, datetime, timezone

import httpx

from . import config, db, llm, wiki

# Article ids currently being processed (so the admin UI can show "läuft").
PROCESSING: set[str] = set()


def today_key() -> str:
    return datetime.now().strftime("%Y-%m-%d")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def discover(lang: str, day: date) -> int:
    """Fetch the day's pool for `lang` and store the original articles. No LLM."""
    dkey = day.strftime("%Y-%m-%d")
    added = 0
    async with httpx.AsyncClient(timeout=30) as client:
        pool = await wiki.fetch_pool(client, lang, day, config.POOL)
        for rank, a in enumerate(pool):
            if not db.has_article(a["id"]):
                paras = await wiki.fetch_paragraphs(client, lang, a["title"], config.MAX_PARAS)
                if not paras:
                    continue
                db.upsert_article({**a, "paragraphs": paras}, _now())
                added += 1
            db.upsert_daily(dkey, lang, rank, a["id"])
    return added


def process_article(
    article_id: str, levels: list[str] | None = None, force: bool = False, fn: str = "prepare"
) -> dict:
    """Prepare an article for each level via the LLM. Per-level try/except so one
    failure doesn't abort the others. `fn` tags telemetry (e.g. "surprise" for
    on-demand prepares, so they can be counted/capped separately). Returns
    {made, skipped, errors}."""
    art = db.get_article(article_id)
    if not art:
        return {"ok": False, "error": "article not found"}
    levels = levels or config.LEVELS
    made, skipped, errors = 0, 0, []

    def _log(meta, level):
        db.add_telemetry(
            {
                "ts": _now(), "provider": config.PROVIDER, "model": meta["model"], "fn": fn,
                "level": level, "lang": art["lang"], "article_id": article_id, "article_url": art["url"],
                "input_tokens": meta["input_tokens"], "output_tokens": meta["output_tokens"],
                "cost_usd": meta["cost_usd"], "ms": meta["ms"], "status": meta["status"],
                "error": meta["error"], "excerpt": meta["excerpt"],
            }
        )

    PROCESSING.add(article_id)
    try:
        for level in levels:
            if not force and db.has_prepared(article_id, level):
                skipped += 1
                continue
            data, meta = llm.prepare(art["paragraphs"], art["lang"], level)
            _log(meta, level)
            if data is None:
                # One retry — most failures are transient (empty/garbled JSON).
                data, meta = llm.prepare(art["paragraphs"], art["lang"], level)
                _log(meta, level)
            if data is None:
                errors.append(f"{level}: {meta['error']}")
                continue
            db.upsert_prepared(article_id, level, data, _now())
            made += 1
    finally:
        PROCESSING.discard(article_id)
    return {"ok": True, "made": made, "skipped": skipped, "errors": errors}


def process_day(date_key: str, lang: str) -> dict:
    """Process every (not-yet-prepared) article in a day's pool for `lang`."""
    made, errors = 0, []
    for aid in db.daily_article_ids(date_key, lang):
        r = process_article(aid)
        made += r.get("made", 0)
        errors += r.get("errors", [])
    return {"made": made, "errors": errors}


async def build_areas() -> dict:
    """Top up the /surprise area pool: for each (area, lang), add up to
    AREA_TOPUP_PER_DAY NEW random topical articles (skipping ones already pooled
    or too short), then prepare them for all levels. Idempotent; capped per day."""
    added = 0
    async with httpx.AsyncClient(timeout=30) as client:
        for area in wiki.AREAS:
            for lang in config.LANGS:
                if db.telemetry_count_today("area") >= config.AREA_DAILY_CAP:
                    return {"ok": True, "added": added, "capped": True}
                have = set(db.area_pool_article_ids(area, lang))
                want = config.AREA_TOPUP_PER_DAY
                got, attempts = 0, 0
                while got < want and attempts < want * 4:
                    attempts += 1
                    art = await wiki.fetch_random_in_area(client, lang, area)
                    if not art or art["id"] in have:
                        continue
                    if not db.has_article(art["id"]):
                        paras = await wiki.fetch_paragraphs(client, lang, art["title"], config.MAX_PARAS)
                        if len(paras) < 3:
                            continue
                        db.upsert_article({**art, "paragraphs": paras}, _now())
                    have.add(art["id"])
                    db.add_area_pool(area, lang, art["id"], _now())
                    await asyncio.to_thread(process_article, art["id"], None, False, "area")
                    got += 1
                    added += 1
    return {"ok": True, "added": added}


async def build_day(day: date | None = None) -> dict:
    """Discover + process all languages for a day (auto-build mode only)."""
    day = day or date.today()
    dkey = day.strftime("%Y-%m-%d")
    for lang in config.LANGS:
        await discover(lang, day)
        await asyncio.to_thread(process_day, dkey, lang)
    await build_areas()
    return {"ok": True}
