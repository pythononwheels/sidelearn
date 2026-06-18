"""Configuration from environment (see .env.example)."""

import os

from dotenv import load_dotenv

load_dotenv()

LANGS = [s.strip() for s in os.getenv("SL_LANGS", "fr,de,en,nl,es").split(",") if s.strip()]
LEVELS = [s.strip() for s in os.getenv("SL_LEVELS", "A2,B1,B2,C1").split(",") if s.strip()]
POOL = int(os.getenv("SL_POOL", "4"))
MAX_PARAS = int(os.getenv("SL_MAX_PARAS", "8"))

DB_PATH = os.getenv("DB_PATH", "./sidelearn.db")

# LLM
PROVIDER = os.getenv("LLM_PROVIDER", "mock").lower()  # openai | gemini | mock
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

# Daily build hour (local server time, 0-23). The job also runs once on startup
# if today's content is missing.
BUILD_HOUR = int(os.getenv("SL_BUILD_HOUR", "4"))

# Bump when the prepared-content shape changes so old rows are re-generated.
SCHEMA_VERSION = 1

LANG_NAMES = {
    "fr": "French",
    "de": "German",
    "en": "English",
    "nl": "Dutch",
    "es": "Spanish",
}
