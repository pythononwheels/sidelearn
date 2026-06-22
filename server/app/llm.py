"""Provider-agnostic LLM call that prepares a whole lesson in one shot.

Returns a dict:
  {"paragraphs":[{"simplified":str,"question":{"q":str,"options":[str,...],"correct":int}}],
   "vocab":[{"word":str,"hint":str}], "summary":str}

Everything is in the *learning* language (native-language-agnostic). Translation
to the user's native language stays on the client.
"""

import json
import re
import time
from typing import Any

from . import config

SYSTEM = (
    "You build a graded-reader lesson from a Wikipedia article for a learner of "
    "{lang} at CEFR level {level}. The user message is a JSON array of original "
    "{lang} paragraphs.\n"
    "For EACH paragraph, in the SAME order and SAME count, produce:\n"
    "  - 'simplified': the paragraph GENUINELY rewritten in simpler {lang} for level "
    "{level} — clearly shorter sentences and more common words than the original. "
    "For A2 keep sentences very short and basic. Do NOT just copy the original; it "
    "must read easier. Keep the key facts, stay in {lang}, do NOT translate.\n"
    "  - 'question': ALWAYS exactly ONE comprehension question about that paragraph, "
    "with exactly 3 'options' in {lang} and 'correct' = 0-based index of the right "
    "one. Never null, never omit it.\n"
    "ALSO ALWAYS produce:\n"
    "  - 'vocab': up to 8 useful words from the article above level {level}, each "
    "with a short {lang} definition 'hint'.\n"
    "  - 'summary': a NON-EMPTY 2-3 sentence {lang} summary of the whole article, "
    "written at level {level}.\n"
    "Reply with MINIFIED JSON ONLY, no markdown, matching: "
    '{{"paragraphs":[{{"simplified":"","question":{{"q":"","options":["","",""],"correct":0}}}}],'
    '"vocab":[{{"word":"","hint":""}}],"summary":""}}. '
    "The 'paragraphs' array length MUST equal the input length."
)


def prepare(paragraphs: list[str], lang_code: str, level: str) -> tuple[dict[str, Any] | None, dict[str, Any]]:
    """Returns (data, meta). data is None on error. meta carries telemetry:
    model, input_tokens, output_tokens, cost_usd, ms, status, error, excerpt."""
    lang = config.LANG_NAMES.get(lang_code, lang_code)
    system = SYSTEM.format(lang=lang, level=level)
    user = json.dumps(paragraphs, ensure_ascii=False)
    model = (
        config.OPENAI_MODEL
        if config.PROVIDER == "openai"
        else config.GEMINI_MODEL
        if config.PROVIDER == "gemini"
        else "mock"
    )
    t0 = time.monotonic()
    try:
        if config.PROVIDER == "openai":
            raw, tin, tout = _openai(system, user)
        elif config.PROVIDER == "gemini":
            raw, tin, tout = _gemini(system, user)
        else:
            raw, tin, tout = json.dumps(_mock_raw(paragraphs)), 0, 0
    except Exception as e:  # noqa: BLE001
        return None, _meta(model, 0, 0, t0, "error", str(e), "")
    data = _normalize(_parse(raw), paragraphs)
    return data, _meta(model, tin, tout, t0, "ok", None, raw[:4000])


WORD_SYSTEM = (
    "You are a precise bilingual dictionary for a {native} speaker reading {lang}. "
    "Given a {lang} WORD and the SENTENCE it appears in, reply with MINIFIED JSON "
    'matching {{"translation":"","alternatives":["",""],"example":"","pos":""}}:\n'
    "- 'translation': the {native} meaning of the word AS USED in this sentence "
    "(1-4 words, the contextually correct sense — not just the most common one).\n"
    "- 'alternatives': up to 3 OTHER common {native} meanings the word can have in "
    "different contexts (omit if none).\n"
    "- 'example': one short, simple {lang} example sentence using the word.\n"
    "- 'pos': part of speech in {native} (e.g. Verb, Substantiv).\n"
    "JSON only, no markdown."
)


def translate_word(
    word: str, sentence: str, lang_code: str, native_code: str
) -> tuple[dict[str, Any] | None, dict[str, Any]]:
    """Context-aware word translation. Returns (data, meta); data None on error."""
    lang = config.LANG_NAMES.get(lang_code, lang_code)
    native = config.LANG_NAMES.get(native_code, native_code)
    system = WORD_SYSTEM.format(lang=lang, native=native)
    user = json.dumps({"word": word, "sentence": sentence}, ensure_ascii=False)
    model = (
        config.OPENAI_MODEL
        if config.PROVIDER == "openai"
        else config.GEMINI_MODEL
        if config.PROVIDER == "gemini"
        else "mock"
    )
    t0 = time.monotonic()
    try:
        if config.PROVIDER == "openai":
            raw, tin, tout = _openai(system, user, temperature=0.2)
        elif config.PROVIDER == "gemini":
            raw, tin, tout = _gemini(system, user, temperature=0.2)
        else:
            raw, tin, tout = json.dumps({"translation": word, "alternatives": [], "example": "", "pos": ""}), 0, 0
    except Exception as e:  # noqa: BLE001
        return None, _meta(model, 0, 0, t0, "error", str(e), "")
    d = _parse(raw)
    translation = d.get("translation") if isinstance(d.get("translation"), str) else ""
    if not translation.strip():
        # Empty/garbled — treat as failure so we don't cache junk; client falls back.
        return None, _meta(model, tin, tout, t0, "error", "empty translation", raw[:1000])
    data = {
        "word": word,
        "translation": translation,
        "alternatives": [a for a in (d.get("alternatives") or []) if isinstance(a, str) and a.strip()][:3],
        "example": d.get("example", "") if isinstance(d.get("example"), str) else "",
        "pos": d.get("pos", "") if isinstance(d.get("pos"), str) else "",
    }
    return data, _meta(model, tin, tout, t0, "ok", None, raw[:1000])


def _meta(model, tin, tout, t0, status, error, excerpt) -> dict[str, Any]:
    return {
        "model": model,
        "input_tokens": int(tin or 0),
        "output_tokens": int(tout or 0),
        "cost_usd": config.cost_usd(model, int(tin or 0), int(tout or 0)),
        "ms": int((time.monotonic() - t0) * 1000),
        "status": status,
        "error": error,
        "excerpt": excerpt,
    }


def _openai(system: str, user: str, temperature: float = 0.4) -> tuple[str, int, int]:
    from openai import OpenAI

    client = OpenAI(api_key=config.OPENAI_API_KEY)
    resp = client.chat.completions.create(
        model=config.OPENAI_MODEL,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        response_format={"type": "json_object"},
        temperature=temperature,
    )
    u = resp.usage
    return resp.choices[0].message.content or "{}", getattr(u, "prompt_tokens", 0), getattr(u, "completion_tokens", 0)


def _gemini(system: str, user: str, temperature: float = 0.4) -> tuple[str, int, int]:
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=config.GEMINI_API_KEY)
    resp = client.models.generate_content(
        model=config.GEMINI_MODEL,
        contents=user,
        config=types.GenerateContentConfig(
            system_instruction=system,
            response_mime_type="application/json",
            temperature=temperature,
        ),
    )
    u = resp.usage_metadata
    return (
        resp.text or "{}",
        getattr(u, "prompt_token_count", 0) or 0,
        getattr(u, "candidates_token_count", 0) or 0,
    )


def _parse(raw: str) -> dict[str, Any]:
    """Extract the FIRST balanced {...} object. Small models sometimes append
    repeated/garbled fragments after the valid JSON, which a greedy regex would
    swallow — so we brace-match (string-aware) instead."""
    raw = re.sub(r"```(?:json)?", "", raw)
    start = raw.find("{")
    if start < 0:
        return {}
    depth = 0
    in_str = False
    esc = False
    for i in range(start, len(raw)):
        c = raw[i]
        if in_str:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == '"':
                in_str = False
            continue
        if c == '"':
            in_str = True
        elif c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(raw[start : i + 1])
                except Exception:
                    return {}
    return {}


def _normalize(data: dict[str, Any], paragraphs: list[str]) -> dict[str, Any]:
    """Force the paragraph array to line up with the input; drop bad questions."""
    out_paras: list[dict[str, Any]] = []
    raw_paras = data.get("paragraphs") or []
    for i, original in enumerate(paragraphs):
        p = raw_paras[i] if i < len(raw_paras) and isinstance(raw_paras[i], dict) else {}
        simplified = p.get("simplified") if isinstance(p.get("simplified"), str) else original
        q = p.get("question") if isinstance(p.get("question"), dict) else None
        question = None
        if q:
            opts = [o for o in (q.get("options") or []) if isinstance(o, str) and o.strip()][:4]
            correct = q.get("correct")
            if isinstance(q.get("q"), str) and len(opts) >= 2 and isinstance(correct, int) and 0 <= correct < len(opts):
                question = {"q": q["q"], "options": opts, "correct": correct}
        out_paras.append({"simplified": simplified, "question": question})
    vocab = [
        {"word": v.get("word", ""), "hint": v.get("hint", "")}
        for v in (data.get("vocab") or [])
        if isinstance(v, dict) and isinstance(v.get("word"), str) and v["word"].strip()
    ][:8]
    summary = data.get("summary") if isinstance(data.get("summary"), str) else ""
    return {"paragraphs": out_paras, "vocab": vocab, "summary": summary}


def _mock_raw(paragraphs: list[str]) -> dict[str, Any]:
    """Passthrough for local testing without an API key."""
    return {
        "paragraphs": [{"simplified": p, "question": None} for p in paragraphs],
        "vocab": [],
        "summary": paragraphs[0][:200] if paragraphs else "",
    }
