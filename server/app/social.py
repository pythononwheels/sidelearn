"""Social-stream harvester — pulls short public toots from curated topical
hashtags on per-language Mastodon instances, cleans + safety-filters them, and
pools them in the `toot` table. NO LLM: difficulty leveling and translation
happen client-side / on-tap. Runs on a light cron (see main.py).

Public hashtag timelines need no auth:
  GET https://{instance}/api/v1/timelines/tag/{tag}?limit=40
"""

import html
import re
from datetime import datetime, timezone
from typing import Any, Optional

import httpx

from . import config, db

UA = "LearnyContentServer/0.1 (https://learny.pyrates.io; educational)"

# langdetect is a small pure-Python lib; if it isn't installed yet (e.g. before a
# rebuild) we degrade gracefully and rely on the instance+tag curation instead of
# hard-failing the harvest.
try:
    from langdetect import DetectorFactory, LangDetectException
    from langdetect import detect as _detect

    DetectorFactory.seed = 0  # deterministic output
    _HAVE_LANGDETECT = True
except Exception:  # noqa: BLE001
    _HAVE_LANGDETECT = False

# Per learn-language: which instance to pull from and which hashtags map to which
# Learny rubrik (rubrik keys mirror wiki.AREAS so the client reuses its colors).
# mastodon.social is EN-dominant; piaille.fr gives strong French (verified on real
# data, 2026-06-25). De/es/it/nl can get their own instances later.
SOURCES: dict[str, dict[str, Any]] = {
    "en": {
        "instance": "mastodon.social",
        "tags": {
            "science": "natur",
            "history": "geschichte",
            "art": "kultur",
            "music": "kultur",
            "technology": "technik",
            "sport": "sport",
        },
    },
    "fr": {
        "instance": "piaille.fr",
        "tags": {
            "sciences": "natur",
            "histoire": "geschichte",
            "art": "kultur",
            "musique": "kultur",
            "technologie": "technik",
            "sport": "sport",
        },
    },
}

_TAG_HTML = re.compile(r"<[^>]+>")
_BLOCK_BREAK = re.compile(r"</p>|<br\s*/?>", re.IGNORECASE)
_URL = re.compile(r"https?://\S+")
_MENTION = re.compile(r"@[\w.\-]+(@[\w.\-]+)?")
_WS = re.compile(r"\s+")
_LETTERS = re.compile(r"[^A-Za-zÀ-ÿ]")


def clean(content_html: str) -> str:
    """HTML toot body → readable plain text: strip tags, unescape entities, drop
    links/mentions, turn '#science' into the bare word, collapse whitespace.
    Emojis are kept (they give the social flavour and don't hurt reading)."""
    text = _BLOCK_BREAK.sub(" ", content_html)
    text = _TAG_HTML.sub(" ", text)
    text = html.unescape(text)
    text = _URL.sub("", text)
    text = _MENTION.sub("", text)
    text = text.replace("#", "")  # keep the hashtag word, drop the '#'
    return _WS.sub(" ", text).strip()


def _real_len(text: str) -> int:
    """Count of letters only — so pure link/emoji/hashtag posts fail the min-length
    gate while normal posts (even with some emoji garnish) pass."""
    return len(_LETTERS.sub("", text))


def detect_lang(text: str) -> Optional[str]:
    if not _HAVE_LANGDETECT:
        return None
    try:
        return _detect(text)
    except LangDetectException:
        return None


def is_safe(status: dict[str, Any], text: str) -> bool:
    """Kid-friendly first-pass filter: drop content-warned / sensitive posts and
    anything hitting the NSFW/spam blocklist."""
    if status.get("sensitive") or (status.get("spoiler_text") or "").strip():
        return False
    low = text.lower()
    return not any(bad in low for bad in config.SOCIAL_BLOCKLIST)


async def fetch_tag(client: httpx.AsyncClient, instance: str, tag: str, limit: int) -> list[dict]:
    r = await client.get(
        f"https://{instance}/api/v1/timelines/tag/{tag}",
        params={"limit": limit},
        headers={"User-Agent": UA, "Accept": "application/json"},
    )
    r.raise_for_status()
    return r.json()


async def harvest() -> dict[str, Any]:
    """One harvest pass over all enabled (lang, hashtag) sources. Filters, cleans,
    and upserts into the toot pool, then prunes old toots. Returns per-tag counts."""
    now = datetime.now(timezone.utc).isoformat()
    stats: dict[str, Any] = {}
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        for lang, src in SOURCES.items():
            if lang not in config.SOCIAL_LANGS:
                continue
            instance = src["instance"]
            for tag, rubrik in src["tags"].items():
                key = f"{lang}/#{tag}"
                try:
                    statuses = await fetch_tag(client, instance, tag, config.SOCIAL_PER_TAG)
                except Exception as e:  # noqa: BLE001 — one bad tag/instance must not abort the run
                    stats[key] = f"err: {e}"
                    continue
                added, seen = 0, 0
                for s in statuses:
                    seen += 1
                    text = clean(s.get("content", ""))
                    if not is_safe(s, text):
                        continue
                    if _real_len(text) < config.SOCIAL_MIN_LEN:
                        continue
                    if _HAVE_LANGDETECT and detect_lang(text) != lang:
                        continue
                    acct = s.get("account", {}) or {}
                    row = {
                        "id": f"{instance}:{s['id']}",
                        "lang": lang,
                        "instance": instance,
                        "url": s.get("url") or s.get("uri") or "",
                        "author": acct.get("display_name") or acct.get("username") or "",
                        "author_handle": acct.get("acct") or "",
                        "content": text,
                        "tags": ",".join(t.get("name", "").lower() for t in s.get("tags", []))[:300],
                        "rubrik": rubrik,
                        "created_at": s.get("created_at") or now,
                        "fetched_at": now,
                    }
                    if db.upsert_toot(row):
                        added += 1
                stats[key] = {"seen": seen, "added": added}
    removed = db.prune_toots(config.SOCIAL_KEEP_DAYS)
    stats["_pruned"] = removed
    return stats
