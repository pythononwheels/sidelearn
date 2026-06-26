"""Wikipedia fetchers — mirrors the extension's wikifeed logic server-side."""

import hashlib
import random
import re
from datetime import date, timedelta
from typing import Any, Optional
from urllib.parse import quote

import httpx

UA = "SidelearnContentServer/0.1 (https://github.com/; educational)"

# Topic areas → localized search seed terms (relevance search picks real articles
# about the topic; a random seed + random offset gives variety run to run).
AREAS: dict[str, dict[str, list[str]]] = {
    "technik": {
        "de": ["Technik", "Technologie", "Erfindung", "Maschine", "Computer"],
        "fr": ["Technologie", "Invention", "Machine", "Ingénierie", "Informatique"],
        "en": ["Technology", "Invention", "Engineering", "Machine", "Computer"],
        "nl": ["Technologie", "Uitvinding", "Techniek", "Machine", "Computer"],
        "es": ["Tecnología", "Invención", "Ingeniería", "Máquina", "Informática"],
        "it": ["Tecnologia", "Invenzione", "Ingegneria", "Macchina", "Informatica"],
    },
    "sport": {
        "de": ["Sport", "Fußball", "Olympische Spiele", "Sportler", "Tennis"],
        "fr": ["Sport", "Football", "Jeux olympiques", "Athlète", "Tennis"],
        "en": ["Sport", "Football", "Olympic Games", "Athlete", "Tennis"],
        "nl": ["Sport", "Voetbal", "Olympische Spelen", "Atleet", "Tennis"],
        "es": ["Deporte", "Fútbol", "Juegos Olímpicos", "Atleta", "Tenis"],
        "it": ["Sport", "Calcio", "Giochi olimpici", "Atleta", "Tennis"],
    },
    "geschichte": {
        "de": ["Geschichte", "Antike", "Mittelalter", "Krieg", "Revolution"],
        "fr": ["Histoire", "Antiquité", "Moyen Âge", "Guerre", "Révolution"],
        "en": ["History", "Ancient history", "Middle Ages", "War", "Revolution"],
        "nl": ["Geschiedenis", "Oudheid", "Middeleeuwen", "Oorlog", "Revolutie"],
        "es": ["Historia", "Antigüedad", "Edad Media", "Guerra", "Revolución"],
        "it": ["Storia", "Antichità", "Medioevo", "Guerra", "Rivoluzione"],
    },
    "gesellschaft": {
        "de": ["Schauspieler", "Sänger", "Musiker", "Berühmtheit", "Fernsehen"],
        "fr": ["Acteur", "Chanteur", "Musicien", "Célébrité", "Télévision"],
        "en": ["Actor", "Singer", "Musician", "Celebrity", "Television"],
        "nl": ["Acteur", "Zanger", "Muzikant", "Beroemdheid", "Televisie"],
        "es": ["Actor", "Cantante", "Músico", "Celebridad", "Televisión"],
        "it": ["Attore", "Cantante", "Musicista", "Celebrità", "Televisione"],
    },
    "natur": {
        "de": ["Tier", "Säugetier", "Vogel", "Pflanze", "Natur"],
        "fr": ["Animal", "Mammifère", "Oiseau", "Plante", "Nature"],
        "en": ["Animal", "Mammal", "Bird", "Plant", "Nature"],
        "nl": ["Dier", "Zoogdier", "Vogel", "Plant", "Natuur"],
        "es": ["Animal", "Mamífero", "Ave", "Planta", "Naturaleza"],
        "it": ["Animale", "Mammifero", "Uccello", "Pianta", "Natura"],
    },
    "kultur": {
        "de": ["Musik", "Film", "Kunst", "Roman", "Maler"],
        "fr": ["Musique", "Film", "Art", "Roman", "Peintre"],
        "en": ["Music", "Film", "Art", "Novel", "Painter"],
        "nl": ["Muziek", "Film", "Kunst", "Roman", "Schilder"],
        "es": ["Música", "Película", "Arte", "Novela", "Pintor"],
        "it": ["Musica", "Film", "Arte", "Romanzo", "Pittore"],
    },
    "wissenschaft": {
        "de": ["Wissenschaft", "Physik", "Biologie", "Weltraum", "Planet"],
        "fr": ["Science", "Physique", "Biologie", "Espace", "Planète"],
        "en": ["Science", "Physics", "Biology", "Space", "Planet"],
        "nl": ["Wetenschap", "Natuurkunde", "Biologie", "Ruimte", "Planeet"],
        "es": ["Ciencia", "Física", "Biología", "Espacio", "Planeta"],
        "it": ["Scienza", "Fisica", "Biologia", "Spazio", "Pianeta"],
    },
}

_LIST_PREFIXES = ("liste ", "list of ", "lista de ", "lijst van ", "liste de", "liste des ")


def article_id(url: str) -> str:
    return hashlib.sha1(url.encode("utf-8")).hexdigest()[:16]


def _to_article(p: dict[str, Any], lang: str) -> Optional[dict[str, Any]]:
    # Skip disambiguation / homonym pages (e.g. "XXX" = the Roman numeral 30) —
    # they're link lists, not readable prose.
    if p.get("type") == "disambiguation":
        return None
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


def _looks_like_list(title: str) -> bool:
    t = title.lower()
    return t.startswith("(") or any(t.startswith(p) for p in _LIST_PREFIXES)


async def _article_from_title(client: httpx.AsyncClient, lang: str, title: str) -> Optional[dict[str, Any]]:
    """Resolve a page title to {id,title,url,thumbnail} via the REST summary."""
    url = f"https://{lang}.wikipedia.org/api/rest_v1/page/summary/{quote(title, safe='')}"
    try:
        r = await client.get(url, headers={"accept": "application/json", "user-agent": UA})
        if r.status_code != 200:
            return None
        data = r.json()
    except Exception:
        return None
    if data.get("type") == "disambiguation":
        return None
    return _to_article(data, lang)


async def fetch_random_in_area(
    client: httpx.AsyncClient, lang: str, area: str, attempts: int = 6
) -> Optional[dict[str, Any]]:
    """A random real article from a topic area, via relevance search + random
    offset. Skips list/disambiguation pages. None if nothing usable turns up."""
    seeds = (AREAS.get(area) or {}).get(lang)
    if not seeds:
        return None
    for _ in range(attempts):
        params = {
            "action": "query",
            "list": "search",
            "srsearch": random.choice(seeds),
            "srnamespace": "0",
            "srlimit": "15",
            # Small offset keeps results on-topic (relevance drops off fast);
            # variety comes from the random seed + offset + shuffle below.
            "sroffset": str(random.randint(0, 40)),
            "format": "json",
        }
        try:
            r = await client.get(
                f"https://{lang}.wikipedia.org/w/api.php", params=params, headers={"user-agent": UA}
            )
            if r.status_code != 200:
                continue
            hits = (r.json().get("query") or {}).get("search") or []
        except Exception:
            continue
        random.shuffle(hits)
        for h in hits:
            title = h.get("title") or ""
            if not title or _looks_like_list(title):
                continue
            a = await _article_from_title(client, lang, title)
            if a:
                return a
    return None


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
