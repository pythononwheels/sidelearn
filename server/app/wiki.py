"""Wikipedia fetchers — mirrors the extension's wikifeed logic server-side."""

import hashlib
import re
from datetime import date, timedelta
from typing import Any, Optional

import httpx

UA = "SidelearnContentServer/0.1 (https://github.com/; educational)"


def article_id(url: str) -> str:
    return hashlib.sha1(url.encode("utf-8")).hexdigest()[:16]


def _to_article(p: dict[str, Any], lang: str) -> Optional[dict[str, Any]]:
    title = p.get("normalizedtitle") or (p.get("titles") or {}).get("normalized") or p.get("title")
    urls = p.get("content_urls") or {}
    url = (urls.get("desktop") or {}).get("page") or (urls.get("mobile") or {}).get("page")
    if not title or not url:
        return None
    thumb = (p.get("thumbnail") or {}).get("source")
    return {"id": article_id(url), "lang": lang, "title": title, "url": url, "thumbnail": thumb}


async def fetch_pool(client: httpx.AsyncClient, lang: str, day: date, count: int) -> list[dict[str, Any]]:
    """The day's article pool (tfa + mostread). Falls back to the previous day."""
    arts = await _fetch_feed(client, lang, day, count)
    if arts:
        return arts
    return await _fetch_feed(client, lang, day - timedelta(days=1), count)


async def _fetch_feed(client: httpx.AsyncClient, lang: str, day: date, count: int) -> list[dict[str, Any]]:
    url = (
        f"https://{lang}.wikipedia.org/api/rest_v1/feed/featured/"
        f"{day.year:04d}/{day.month:02d}/{day.day:02d}"
    )
    try:
        r = await client.get(url, headers={"accept": "application/json", "user-agent": UA})
        if r.status_code != 200:
            return []
        data = r.json()
    except Exception:
        return []
    candidates: list[dict[str, Any]] = []
    if data.get("tfa"):
        candidates.append(data["tfa"])
    candidates += (data.get("mostread") or {}).get("articles") or []
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for p in candidates:
        a = _to_article(p, lang)
        if not a or a["url"] in seen:
            continue
        seen.add(a["url"])
        out.append(a)
        if len(out) >= count:
            break
    return out


async def fetch_paragraphs(client: httpx.AsyncClient, lang: str, title: str, cap: int) -> list[str]:
    """Clean plain-text paragraphs (Action API extracts), capped to `cap`."""
    params = {
        "action": "query",
        "prop": "extracts",
        "explaintext": "1",
        "exsectionformat": "plain",
        "redirects": "1",
        "format": "json",
        "titles": title,
    }
    try:
        r = await client.get(
            f"https://{lang}.wikipedia.org/w/api.php",
            params=params,
            headers={"user-agent": UA},
        )
        if r.status_code != 200:
            return []
        pages = (r.json().get("query") or {}).get("pages") or {}
    except Exception:
        return []
    extract = ""
    for page in pages.values():
        extract = page.get("extract") or ""
        break
    paras = [s.strip() for s in re.split(r"\n+", extract)]
    paras = [s for s in paras if len(s) >= 40 and re.search(r"[.!?…]", s)]
    return paras[:cap]
