"""Configuration from environment (see .env.example)."""

import os

from dotenv import load_dotenv

load_dotenv()

LANGS = [s.strip() for s in os.getenv("SL_LANGS", "fr,de,en,nl,es").split(",") if s.strip()]
LEVELS = [s.strip() for s in os.getenv("SL_LEVELS", "A1,A2,B1,B2,C1").split(",") if s.strip()]
POOL = int(os.getenv("SL_POOL", "4"))
MAX_PARAS = int(os.getenv("SL_MAX_PARAS", "8"))

DB_PATH = os.getenv("DB_PATH", "./sidelearn.db")

# LLM
PROVIDER = os.getenv("LLM_PROVIDER", "mock").lower()  # openai | gemini | mock
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

# Auto-build: when "1", the container discovers + processes the daily set on
# startup and on a daily cron. Default off — content is prepared manually via the
# admin dashboard, so the container just boots and serves.
AUTO_BUILD = os.getenv("SL_AUTO_BUILD", "0") == "1"
BUILD_HOUR = int(os.getenv("SL_BUILD_HOUR", "4"))

# Bump when the prepared-content shape changes so old rows are re-generated.
SCHEMA_VERSION = 1

# Price per 1M tokens (text input, output) in USD.
# Gemini verified against ai.google.dev/gemini-api/docs/pricing on 2026-06-18.
PRICES = {
    "gemini-2.5-flash-lite": (0.10, 0.40),
    "gemini-2.5-flash": (0.30, 2.50),
    "gpt-4o-mini": (0.15, 0.60),
    "gpt-4o": (2.50, 10.0),
}
DEFAULT_PRICE = (0.20, 0.80)


def cost_usd(model: str, in_tokens: int, out_tokens: int) -> float:
    pin, pout = PRICES.get(model, DEFAULT_PRICE)
    return in_tokens / 1_000_000 * pin + out_tokens / 1_000_000 * pout


# Max uncached on-demand word translations per day (cost guard). Cached lookups
# don't count. Each call is tiny (~150 tokens), so this stays well under a euro.
TRANSLATE_DAILY_CAP = int(os.getenv("SL_TRANSLATE_DAILY_CAP", "3000"))

# Max uncached sentence/question translations per day (cost guard). Cached lookups
# don't count; each call is small.
SENTENCE_DAILY_CAP = int(os.getenv("SL_SENTENCE_DAILY_CAP", "2000"))

# Max on-demand "surprise" article prepares per day (cost guard). Each prepares a
# single level (~$0.001), so the default stays well under a euro. Cached repeats
# don't count — the surprise pool grows into a reusable library over time.
SURPRISE_DAILY_CAP = int(os.getenv("SL_SURPRISE_DAILY_CAP", "200"))

# Max on-demand lesson prepares per day for an allowed-but-unbuilt level (e.g.
# A1, which is prepared lazily when first requested). Cached repeats don't count.
ONDEMAND_DAILY_CAP = int(os.getenv("SL_ONDEMAND_DAILY_CAP", "300"))

# Area pool: how many NEW random articles to add per (rubrik, lang) each daily
# build (a steady trickle that grows the /surprise library), and a hard daily
# safety cap on area prepares (fn="area").
AREA_TOPUP_PER_DAY = int(os.getenv("SL_AREA_TOPUP", "2"))
AREA_DAILY_CAP = int(os.getenv("SL_AREA_DAILY_CAP", "500"))

# "Digest" short-read mode (area articles, A2+): target length per level. The
# prompt scales the standalone summary so it reads naturally at each level.
DIGEST_WORDS = {"A2": 80, "B1": 110, "B2": 140, "C1": 170}

# Hard daily cost ceiling (USD) across ALL LLM calls, measured from telemetry.
# Once today's cost reaches this, fresh LLM calls stop (cached/prebuilt content
# is still served). The ultimate cost backstop above the per-function caps.
DAILY_COST_CAP_USD = float(os.getenv("SL_DAILY_COST_CAP_USD", "1.50"))

# --- Abuse / cost protection for the public LLM endpoints -------------------
# Only browser requests from these origins may hit the cost endpoints. Default:
# the Learny PWA in prod + localhost for dev. Tune via SL_ALLOWED_ORIGIN_REGEX.
ALLOWED_ORIGIN_REGEX = os.getenv(
    "SL_ALLOWED_ORIGIN_REGEX",
    r"^https://learny\.pyrates\.io$|^http://(localhost|127\.0\.0\.1)(:\d+)?$",
)

# Hard IP blocklist (comma-separated) — repeat offenders from the abuse log.
# These get a 403 on the cost endpoints before any work happens.
BLOCKED_IPS = {ip.strip() for ip in os.getenv("SL_BLOCKED_IPS", "").split(",") if ip.strip()}

# Hard input-length limits (reject above → 400). Kills the "send 100k words" attack.
MAX_WORD_LEN = int(os.getenv("SL_MAX_WORD_LEN", "64"))
MAX_SENTENCE_LEN = int(os.getenv("SL_MAX_SENTENCE_LEN", "300"))
MAX_TEXT_LEN = int(os.getenv("SL_MAX_TEXT_LEN", "400"))

# Output-token caps per LLM call (bounds cost + cuts "…and also do xyz" essays).
TRANSLATE_MAX_OUT = int(os.getenv("SL_TRANSLATE_MAX_OUT", "120"))
SENTENCE_MAX_OUT = int(os.getenv("SL_SENTENCE_MAX_OUT", "300"))

# Per-IP rate limits (slowapi syntax) for the cost endpoints.
RL_DEFAULT = os.getenv("SL_RL_DEFAULT", "120/minute")
RL_TRANSLATE = os.getenv("SL_RL_TRANSLATE", "30/minute")
RL_SENTENCE = os.getenv("SL_RL_SENTENCE", "20/minute")
RL_SURPRISE = os.getenv("SL_RL_SURPRISE", "8/minute")
RL_DIGEST = os.getenv("SL_RL_DIGEST", "20/minute")
RL_LESSON = os.getenv("SL_RL_LESSON", "60/minute")
RL_AREAS = os.getenv("SL_RL_AREAS", "60/minute")  # /areas/list — cheap DB join, but guard the DB

# --- Social stream (Mastodon) -----------------------------------------------
# A bounded pool of short public toots from curated topical hashtags, fetched on
# a light cron (no LLM). See server/app/social.py for the per-language source map.
SOCIAL_ENABLE = os.getenv("SL_SOCIAL_ENABLE", "1") == "1"
SOCIAL_EVERY_MIN = int(os.getenv("SL_SOCIAL_EVERY_MIN", "15"))  # harvest cadence (minutes)
SOCIAL_PER_TAG = int(os.getenv("SL_SOCIAL_PER_TAG", "40"))  # toots fetched per tag/run
# Rolling pool: keep the newest N per (lang, rubrik); older toots roll out. With
# 6 rubriks × 2 langs and N=60 that's ~720 toots to scroll through, balanced by topic.
SOCIAL_KEEP_PER_RUBRIK = int(os.getenv("SL_SOCIAL_KEEP_PER_RUBRIK", "80"))
SOCIAL_KEEP_DAYS = int(os.getenv("SL_SOCIAL_KEEP_DAYS", "30"))  # age backstop prune
SOCIAL_MIN_LEN = int(os.getenv("SL_SOCIAL_MIN_LEN", "60"))  # min letters of real text
SOCIAL_MAX_LEN = int(os.getenv("SL_SOCIAL_MAX_LEN", "500"))  # max chars (no essays; tweet-ish)
SOCIAL_MAX_PER_AUTHOR = int(os.getenv("SL_SOCIAL_MAX_PER_AUTHOR", "3"))  # per tag/run anti-flood
# Which learn-languages to harvest (subset of the SOURCES map in social.py).
SOCIAL_LANGS = [s.strip() for s in os.getenv("SL_SOCIAL_LANGS", "en,fr").split(",") if s.strip()]
# NSFW/spam word blocklist (substring match on cleaned text) — first safety layer.
SOCIAL_BLOCKLIST = {
    w.strip().lower()
    for w in os.getenv(
        "SL_SOCIAL_BLOCKLIST", "porn,nsfw,sex,xxx,onlyfans,casino,nude,escort,gambling"
    ).split(",")
    if w.strip()
}
RL_STREAM = os.getenv("SL_RL_STREAM", "60/minute")  # /stream — cheap DB read

LANG_NAMES = {
    "fr": "French",
    "de": "German",
    "en": "English",
    "nl": "Dutch",
    "es": "Spanish",
    "it": "Italian",
}
