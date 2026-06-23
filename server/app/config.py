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

LANG_NAMES = {
    "fr": "French",
    "de": "German",
    "en": "English",
    "nl": "Dutch",
    "es": "Spanish",
    "it": "Italian",
}
