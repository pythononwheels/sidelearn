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

# Tag → rubrik maps per language (rubrik keys mirror wiki.AREAS so the client
# reuses its colors). Hashtags are ASCII — Mastodon strips accents.
_EN_TAGS = {
    "science": "natur", "nature": "natur", "wildlife": "natur", "space": "natur", "astronomy": "natur",
    "history": "geschichte", "archaeology": "geschichte", "heritage": "geschichte",
    "art": "kultur", "music": "kultur", "film": "kultur", "books": "kultur", "photography": "kultur",
    "technology": "technik", "programming": "technik", "ai": "technik", "gaming": "technik",
    "sport": "sport", "football": "sport", "cycling": "sport", "running": "sport",
}
_FR_TAGS = {
    "sciences": "natur", "nature": "natur", "animaux": "natur", "astronomie": "natur", "espace": "natur",
    "histoire": "geschichte", "archeologie": "geschichte", "patrimoine": "geschichte",
    "art": "kultur", "musique": "kultur", "cinema": "kultur", "litterature": "kultur",
    "photographie": "kultur", "culture": "kultur",
    "technologie": "technik", "informatique": "technik", "numerique": "technik", "jeuxvideo": "technik",
    "sport": "sport", "football": "sport", "cyclisme": "sport", "rugby": "sport",
}
_NL_TAGS = {
    "wetenschap": "natur", "natuur": "natur", "dieren": "natur", "ruimte": "natur",
    "geschiedenis": "geschichte", "archeologie": "geschichte",
    "kunst": "kultur", "muziek": "kultur", "film": "kultur", "literatuur": "kultur", "fotografie": "kultur",
    "technologie": "technik", "informatica": "technik", "gamen": "technik",
    "sport": "sport", "voetbal": "sport", "wielrennen": "sport",
}
_ES_TAGS = {
    "ciencia": "natur", "naturaleza": "natur", "animales": "natur", "astronomia": "natur",
    "historia": "geschichte", "arqueologia": "geschichte",
    "arte": "kultur", "musica": "kultur", "cine": "kultur", "literatura": "kultur", "fotografia": "kultur",
    "tecnologia": "technik", "informatica": "technik", "videojuegos": "technik",
    "deporte": "sport", "futbol": "sport", "ciclismo": "sport",
}
_IT_TAGS = {
    "scienza": "natur", "natura": "natur", "animali": "natur", "astronomia": "natur",
    "storia": "geschichte", "archeologia": "geschichte",
    "arte": "kultur", "musica": "kultur", "cinema": "kultur", "letteratura": "kultur", "fotografia": "kultur",
    "tecnologia": "technik", "informatica": "technik", "videogiochi": "technik",
    "sport": "sport", "calcio": "sport", "ciclismo": "sport",
}

# Per learn-language: one or more public Mastodon instances + their tag map. More
# instances widen the pool; federated duplicates are deduped by canonical URL at
# harvest. All instances verified to serve unauth tag timelines (2026-06-25).
# Lernsprachen = fr/en/nl/es/it (Muttersprache Deutsch).
SOURCES: dict[str, list[dict[str, Any]]] = {
    "en": [{"instance": "mastodon.social", "tags": _EN_TAGS}],
    "fr": [{"instance": "piaille.fr", "tags": _FR_TAGS}],
    "nl": [
        {"instance": "mastodon.nl", "tags": _NL_TAGS},
        {"instance": "nerdculture.de", "tags": _NL_TAGS},
    ],
    "es": [
        {"instance": "masto.es", "tags": _ES_TAGS},
        {"instance": "mas.to", "tags": _ES_TAGS},
    ],
    "it": [
        {"instance": "mastodon.uno", "tags": _IT_TAGS},
        {"instance": "livellosegreto.it", "tags": _IT_TAGS},
    ],
}

_ANCHOR = re.compile(r"<a\b[^>]*>.*?</a>", re.IGNORECASE | re.DOTALL)
_TAG_HTML = re.compile(r"<[^>]+>")
_BLOCK_BREAK = re.compile(r"</p>|<br\s*/?>", re.IGNORECASE)
_URL = re.compile(r"https?://\S+")
_MENTION = re.compile(r"@[\w.\-]+(@[\w.\-]+)?")
_HASHTAG = re.compile(r"#\w+")
_WS = re.compile(r"\s+")
_LETTERS = re.compile(r"[^A-Za-zÀ-ÿ]")


def clean(content_html: str) -> str:
    """HTML toot body → readable plain text. Emojis are kept (social flavour, no
    harm); links, @mentions and #hashtags are removed.

    Mastodon wraps links/hashtags/mentions in <a>…</a> (URLs split across <span>s),
    so we drop whole anchors FIRST — otherwise stripping tags leaves fragments like
    'https:// buff.ly/…' and a trailing hashtag word-salad, which wreck readability
    AND mislead the language detector."""
    text = _ANCHOR.sub(" ", content_html)
    text = _BLOCK_BREAK.sub(" ", text)
    text = _TAG_HTML.sub(" ", text)
    text = html.unescape(text)
    text = _URL.sub(" ", text)      # bare URLs (rare — most are anchored)
    text = _MENTION.sub(" ", text)  # bare @mentions
    text = _HASHTAG.sub(" ", text)  # bare #hashtags
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


def pick_media(status: dict[str, Any]) -> str:
    """Best image for the card: a photo/video-thumbnail attachment if present,
    else the link-preview card image (what makes news posts look rich). ''
    if none."""
    for m in status.get("media_attachments") or []:
        if m.get("type") in ("image", "gifv", "video"):
            url = m.get("preview_url") or m.get("url")
            if url:
                return url
    card = status.get("card") or {}
    return card.get("image") or ""


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
        for lang, sources in SOURCES.items():
            if lang not in config.SOCIAL_LANGS:
                continue
            for src in sources:
              instance = src["instance"]
              for tag, rubrik in src["tags"].items():
                key = f"{lang}@{instance}/#{tag}"
                try:
                    statuses = await fetch_tag(client, instance, tag, config.SOCIAL_PER_TAG)
                except Exception as e:  # noqa: BLE001 — one bad tag/instance must not abort the run
                    stats[key] = f"err: {e}"
                    continue
                added, seen = 0, 0
                by_author: dict[str, int] = {}
                for s in statuses:
                    seen += 1
                    text = clean(s.get("content", ""))
                    if not is_safe(s, text):
                        continue
                    if _real_len(text) < config.SOCIAL_MIN_LEN:
                        continue
                    if len(text) > config.SOCIAL_MAX_LEN:
                        continue  # essays aren't toots — keep it short/medium
                    if _HAVE_LANGDETECT and detect_lang(text) != lang:
                        continue
                    acct = s.get("account", {}) or {}
                    handle = acct.get("acct") or ""
                    # Cap one author's share of a tag so bot/feed accounts (e.g.
                    # auto-posted video titles) can't flood the pool.
                    if by_author.get(handle, 0) >= config.SOCIAL_MAX_PER_AUTHOR:
                        continue
                    by_author[handle] = by_author.get(handle, 0) + 1
                    row = {
                        "id": f"{instance}:{s['id']}",
                        "lang": lang,
                        "instance": instance,
                        "url": s.get("url") or s.get("uri") or "",
                        "author": acct.get("display_name") or acct.get("username") or "",
                        "author_handle": acct.get("acct") or "",
                        "content": text,
                        "media_url": pick_media(s),
                        "tags": ",".join(t.get("name", "").lower() for t in s.get("tags", []))[:300],
                        "rubrik": rubrik,
                        "created_at": s.get("created_at") or now,
                        "fetched_at": now,
                    }
                    # Skip federated duplicates already pooled via another instance
                    # (same canonical URL, different local id).
                    dup = db.toot_id_for_url(row["url"]) if row["url"] else None
                    if dup is not None and dup != row["id"]:
                        continue
                    if db.upsert_toot(row):
                        added += 1
                stats[key] = {"seen": seen, "added": added}
    # Drop any oversized toots (e.g. from before the cap), then roll the pool.
    db.prune_long_toots(config.SOCIAL_MAX_LEN)
    rolled = db.prune_toots_per_rubrik(config.SOCIAL_KEEP_PER_RUBRIK)
    aged = db.prune_toots(config.SOCIAL_KEEP_DAYS)
    stats["_pruned"] = {"rolled": rolled, "aged": aged}
    return stats
