"""Sidelearn content server — read-only API over the pre-baked daily lessons."""

import asyncio
from datetime import date

import hashlib
from datetime import datetime, timezone

import httpx
from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from . import admin, config, db, llm, pipeline, wiki

app = FastAPI(title="Sidelearn Content Server", version="0.1")

# Public, read-only data → permissive CORS so the extension can fetch it.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(admin.router)

scheduler = BackgroundScheduler()


def _run_build() -> None:
    asyncio.run(pipeline.build_day(date.today()))


@app.on_event("startup")
def _startup() -> None:
    db.init()
    # By default the container just serves; content is prepared via the admin
    # dashboard. Auto-build (startup + daily cron) is opt-in via SL_AUTO_BUILD=1.
    if config.AUTO_BUILD:
        import threading

        threading.Thread(target=_run_build, daemon=True).start()
        scheduler.add_job(_run_build, "cron", hour=config.BUILD_HOUR, id="daily", replace_existing=True)
        scheduler.start()


@app.on_event("shutdown")
def _shutdown() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)


@app.get("/health")
def health() -> dict:
    return {"ok": True, "provider": config.PROVIDER, "langs": config.LANGS, "levels": config.LEVELS}


def _check_level(level: str) -> None:
    if level not in config.LEVELS:
        raise HTTPException(400, f"unknown level {level!r}; allowed: {config.LEVELS}")


def _check_lang(lang: str) -> None:
    if lang not in config.LANGS:
        raise HTTPException(400, f"unknown lang {lang!r}; allowed: {config.LANGS}")


@app.get("/daily")
def daily(
    lang: str = Query(...),
    level: str = Query("A2"),
    date_: str | None = Query(None, alias="date"),
) -> dict:
    _check_lang(lang)
    _check_level(level)
    dkey = date_ or pipeline.today_key()
    ids = db.daily_article_ids(dkey, lang)
    # If today's set isn't built yet (and no explicit date was asked), fall back
    # to the most recent day that has content — so users always see a challenge.
    if not ids and not date_:
        recent = db.daily_dates(lang, 1)
        if recent:
            dkey = recent[0]
            ids = db.daily_article_ids(dkey, lang)
    articles = []
    for aid in ids:
        art = db.get_article(aid)
        if not art:
            continue
        prepared = db.get_prepared(aid, level)
        articles.append(
            {
                "id": art["id"],
                "title": art["title"],
                "url": art["url"],
                "thumbnail": art["thumbnail"],
                "paragraphs": len(art["paragraphs"]),
                "ready": prepared is not None,
                "summary": (prepared or {}).get("summary", ""),
            }
        )
    return {"date": dkey, "lang": lang, "level": level, "goal": min(2, len(articles)), "articles": articles}


async def _ensure_prepared(article_id: str, level: str) -> dict | None:
    """Return the prepared lesson for (article, level), preparing it on demand
    (cap-guarded) if the level is allowed but not built yet — e.g. A1."""
    prepared = db.get_prepared(article_id, level)
    if prepared:
        return prepared
    if db.telemetry_count_today("ondemand") >= config.ONDEMAND_DAILY_CAP:
        return None
    await asyncio.to_thread(pipeline.process_article, article_id, [level], False, "ondemand")
    return db.get_prepared(article_id, level)


@app.get("/lesson/{article_id}")
async def lesson(article_id: str, level: str = Query("A2")) -> dict:
    _check_level(level)
    art = db.get_article(article_id)
    if not art:
        raise HTTPException(404, "article not found")
    prepared = await _ensure_prepared(article_id, level)
    if not prepared:
        raise HTTPException(404, f"lesson not prepared for level {level}")
    prep_paras = prepared.get("paragraphs", [])
    paragraphs = []
    for i, original in enumerate(art["paragraphs"]):
        p = prep_paras[i] if i < len(prep_paras) else {}
        paragraphs.append(
            {
                "original": original,
                "simplified": p.get("simplified", original),
                "question": p.get("question"),
            }
        )
    return {
        "id": art["id"],
        "lang": art["lang"],
        "level": level,
        "title": art["title"],
        "url": art["url"],
        "thumbnail": art["thumbnail"],
        "excerpt": True,
        "paragraphs": paragraphs,
        "vocab": prepared.get("vocab", []),
        "summary": prepared.get("summary", ""),
        "digest": prepared.get("digest", ""),
        "digestQuestions": prepared.get("digest_questions", []),
        "source": "wikipedia",
        "license": "CC BY-SA",
    }


@app.get("/digest/{article_id}")
async def digest(article_id: str, level: str = Query("A2")) -> dict:
    """Digest (short-read) for an area article, generated lazily on first request
    and cached into the prepared row. A1 has no digest."""
    _check_level(level)
    if level == "A1":
        return {"digest": "", "digestQuestions": []}
    art = db.get_article(article_id)
    if not art:
        raise HTTPException(404, "article not found")
    prepared = db.get_prepared(article_id, level)
    if prepared and prepared.get("digest"):
        return {"digest": prepared["digest"], "digestQuestions": prepared.get("digest_questions", [])}
    if db.telemetry_count_today("digest") >= config.ONDEMAND_DAILY_CAP:
        raise HTTPException(429, "daily digest budget reached — try later")

    now = datetime.now(timezone.utc).isoformat()
    data, meta = await asyncio.to_thread(llm.digest_only, art["paragraphs"], art["lang"], level)
    db.add_telemetry(
        {
            "ts": now, "provider": config.PROVIDER, "model": meta["model"], "fn": "digest",
            "level": level, "lang": art["lang"], "article_id": article_id, "article_url": art["url"],
            "input_tokens": meta["input_tokens"], "output_tokens": meta["output_tokens"],
            "cost_usd": meta["cost_usd"], "ms": meta["ms"], "status": meta["status"],
            "error": meta["error"], "excerpt": meta["excerpt"],
        }
    )
    if not data:
        raise HTTPException(502, "digest failed")
    # Cache into the prepared row so the next reader gets it instantly.
    if prepared is not None:
        prepared["digest"] = data["digest"]
        prepared["digest_questions"] = data["digest_questions"]
        db.upsert_prepared(article_id, level, prepared, now)
    return {"digest": data["digest"], "digestQuestions": data["digest_questions"]}


@app.get("/archive")
def archive(lang: str = Query(...), limit: int = Query(30, le=120)) -> dict:
    _check_lang(lang)
    dates = db.daily_dates(lang, limit)
    return {"lang": lang, "dates": dates}


@app.get("/translate")
def translate(
    lang: str = Query(...),
    native: str = Query(...),
    word: str = Query(...),
    sentence: str = Query(""),
) -> dict:
    """Context-aware word translation (+ alternatives), cached. Falls back to a
    capped daily budget for fresh LLM calls."""
    _check_lang(lang)
    if native not in config.LANGS:
        raise HTTPException(400, f"unknown native {native!r}")
    word = word.strip()
    if not word:
        raise HTTPException(400, "empty word")
    shash = hashlib.sha1(sentence.strip().lower().encode("utf-8")).hexdigest()[:12]

    cached = db.get_word_cache(lang, native, word, shash)
    if cached:
        return {**cached, "cached": True}

    if db.telemetry_count_today("translate") >= config.TRANSLATE_DAILY_CAP:
        raise HTTPException(429, "daily translation budget reached — try later")

    now = datetime.now(timezone.utc).isoformat()
    data, meta = llm.translate_word(word, sentence, lang, native)
    db.add_telemetry(
        {
            "ts": now, "provider": config.PROVIDER, "model": meta["model"], "fn": "translate",
            "level": None, "lang": lang, "article_id": None, "article_url": None,
            "input_tokens": meta["input_tokens"], "output_tokens": meta["output_tokens"],
            "cost_usd": meta["cost_usd"], "ms": meta["ms"], "status": meta["status"],
            "error": meta["error"], "excerpt": meta["excerpt"],
        }
    )
    if not data:
        raise HTTPException(502, "translation failed")
    db.put_word_cache(lang, native, word, shash, data, now)
    return {**data, "cached": False}


@app.get("/sentence")
def sentence(
    lang: str = Query(...),
    native: str = Query(...),
    text: str = Query(...),
) -> dict:
    """Translate a whole sentence/question into the native language (for the
    'Übersetzung' button on quizzes & cloze). Cached; capped per day."""
    _check_lang(lang)
    if native not in config.LANGS:
        raise HTTPException(400, f"unknown native {native!r}")
    text = text.strip()
    if not text:
        raise HTTPException(400, "empty text")
    thash = hashlib.sha1(text.lower().encode("utf-8")).hexdigest()[:16]

    cached = db.get_word_cache(lang, native, thash, "s2")
    if cached:
        return {"translation": cached.get("translation", ""), "cached": True}

    if db.telemetry_count_today("sentence") >= config.SENTENCE_DAILY_CAP:
        raise HTTPException(429, "daily translation budget reached — try later")

    now = datetime.now(timezone.utc).isoformat()
    data, meta = llm.translate_text(text, lang, native)
    db.add_telemetry(
        {
            "ts": now, "provider": config.PROVIDER, "model": meta["model"], "fn": "sentence",
            "level": None, "lang": lang, "article_id": None, "article_url": None,
            "input_tokens": meta["input_tokens"], "output_tokens": meta["output_tokens"],
            "cost_usd": meta["cost_usd"], "ms": meta["ms"], "status": meta["status"],
            "error": meta["error"], "excerpt": meta["excerpt"],
        }
    )
    if not data:
        raise HTTPException(502, "translation failed")
    db.put_word_cache(lang, native, thash, "s2", {"translation": data["translation"], "alternatives": [], "example": "", "pos": ""}, now)
    return {"translation": data["translation"], "cached": False}


@app.get("/areas")
def areas() -> dict:
    """Topic areas available for /surprise (with the languages each supports)."""
    return {a: sorted(by_lang.keys()) for a, by_lang in wiki.AREAS.items()}


@app.get("/surprise")
async def surprise(
    lang: str = Query(...),
    level: str = Query("A2"),
    area: str = Query("technik"),
) -> dict:
    """A random topical article, prepared on demand for `level` and returned as a
    lesson. Caches into the normal article/prepared tables, so repeats are free
    and the pool grows into a reusable library. Capped per day (cost guard)."""
    _check_lang(lang)
    _check_level(level)
    if area not in wiki.AREAS:
        raise HTTPException(400, f"unknown area {area!r}; allowed: {sorted(wiki.AREAS)}")

    # Pool-first: serve an already-prepared article from the prebuilt area pool
    # (instant, no LLM). The daily build keeps this topped up.
    pooled = db.random_area_prepared(area, lang, level)
    if pooled:
        return await lesson(pooled, level)

    # Try a few candidates so a random too-short article (or a one-off prepare
    # hiccup) doesn't surface as a user-facing error. Cheap checks (length) skip
    # for free; the expensive LLM prepare is attempted at most MAX_PREPARES times.
    MAX_CANDIDATES, MAX_PREPARES = 4, 2
    prepares = 0
    async with httpx.AsyncClient(timeout=30) as client:
        for _ in range(MAX_CANDIDATES):
            art = await wiki.fetch_random_in_area(client, lang, area)
            if not art:
                continue

            # Already in the library and prepared for this level → free, return.
            if db.has_prepared(art["id"], level):
                return await lesson(art["id"], level)

            if not db.has_article(art["id"]):
                paras = await wiki.fetch_paragraphs(client, lang, art["title"], config.MAX_PARAS)
                if len(paras) < 3:
                    continue  # too short — try another candidate (no LLM spent)
                db.upsert_article({**art, "paragraphs": paras}, datetime.now(timezone.utc).isoformat())

            if db.telemetry_count_today("surprise") >= config.SURPRISE_DAILY_CAP:
                raise HTTPException(429, "daily surprise budget reached — try a built lesson")
            if prepares >= MAX_PREPARES:
                break
            prepares += 1
            await asyncio.to_thread(pipeline.process_article, art["id"], [level], False, "surprise", True)
            if db.has_prepared(art["id"], level):
                return await lesson(art["id"], level)

    raise HTTPException(404, "couldn't find a good article right now — try again")


@app.get("/random")
async def random_lesson(lang: str = Query(...), level: str = Query("A2")) -> dict:
    _check_lang(lang)
    _check_level(level)
    art = db.random_article(lang)
    if not art:
        raise HTTPException(404, "no articles yet")
    return await lesson(art["id"], level)
