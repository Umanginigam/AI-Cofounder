"""
LLM client wrapper for GitHub Models via OpenAI-compatible API.

Uses GPT-4o for main reasoning, GPT-4o-mini for background tasks,
and text-embedding-3-small for vector embeddings.
"""

from __future__ import annotations

import os
import time
import sqlite3
from datetime import date
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from openai import OpenAI, APIError, RateLimitError

load_dotenv()

GITHUB_MODELS_URL = "https://models.inference.ai.azure.com"
MODEL_STRONG = "gpt-4o"
MODEL_FAST = "gpt-4o-mini"
MODEL_EMBED = "text-embedding-3-small"

DAILY_STRONG_LIMIT = 45  # conservative buffer under 50
DAILY_FAST_LIMIT = 140

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
USAGE_DB = DATA_DIR / "usage.db"

_client: OpenAI | None = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        token = os.environ.get("GITHUB_TOKEN")
        if not token:
            raise EnvironmentError(
                "GITHUB_TOKEN not set. Generate one at https://github.com/settings/tokens "
                "and add it to your .env file."
            )
        _client = OpenAI(base_url=GITHUB_MODELS_URL, api_key=token)
    return _client


# ---------------------------------------------------------------------------
# Usage tracking
# ---------------------------------------------------------------------------

def _ensure_usage_table():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(USAGE_DB), check_same_thread=False)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS usage ("
        "  day TEXT NOT NULL,"
        "  model TEXT NOT NULL,"
        "  count INTEGER DEFAULT 0,"
        "  PRIMARY KEY (day, model)"
        ")"
    )
    conn.commit()
    conn.close()


def _increment_usage(model: str) -> int:
    _ensure_usage_table()
    today = date.today().isoformat()
    conn = sqlite3.connect(str(USAGE_DB), check_same_thread=False)
    conn.execute(
        "INSERT INTO usage (day, model, count) VALUES (?, ?, 1) "
        "ON CONFLICT(day, model) DO UPDATE SET count = count + 1",
        (today, model),
    )
    conn.commit()
    cur = conn.execute(
        "SELECT count FROM usage WHERE day = ? AND model = ?", (today, model)
    )
    row = cur.fetchone()
    conn.close()
    return row[0] if row else 0


def get_daily_usage(model: str | None = None) -> dict[str, int]:
    _ensure_usage_table()
    today = date.today().isoformat()
    conn = sqlite3.connect(str(USAGE_DB), check_same_thread=False)
    if model:
        cur = conn.execute(
            "SELECT model, count FROM usage WHERE day = ? AND model = ?",
            (today, model),
        )
    else:
        cur = conn.execute("SELECT model, count FROM usage WHERE day = ?", (today,))
    rows = {r[0]: r[1] for r in cur.fetchall()}
    conn.close()
    return rows


def _can_use_strong() -> bool:
    usage = get_daily_usage(MODEL_STRONG)
    return usage.get(MODEL_STRONG, 0) < DAILY_STRONG_LIMIT


# ---------------------------------------------------------------------------
# Core API calls with retry
# ---------------------------------------------------------------------------

def _call_with_retry(func, *, max_retries: int = 3, **kwargs) -> Any:
    for attempt in range(max_retries):
        try:
            return func(**kwargs)
        except RateLimitError:
            wait = 2 ** (attempt + 1)
            time.sleep(wait)
        except APIError as e:
            if attempt == max_retries - 1:
                raise
            time.sleep(1)
    raise RuntimeError("Max retries exceeded for LLM call")


def think(
    messages: list[dict[str, str]],
    *,
    temperature: float = 0.7,
    force_strong: bool = False,
) -> tuple[str, str]:
    """
    Main co-founder reasoning call.

    Returns (response_text, model_used).
    Falls back to fast model if daily strong limit is reached.
    """
    client = _get_client()

    if force_strong or _can_use_strong():
        model = MODEL_STRONG
    else:
        model = MODEL_FAST

    response = _call_with_retry(
        client.chat.completions.create,
        model=model,
        messages=messages,
        temperature=temperature,
    )
    _increment_usage(model)
    return response.choices[0].message.content, model


def extract(messages: list[dict[str, str]], *, temperature: float = 0.2) -> str:
    """Background extraction/classification — always uses the fast model."""
    client = _get_client()
    response = _call_with_retry(
        client.chat.completions.create,
        model=MODEL_FAST,
        messages=messages,
        temperature=temperature,
    )
    _increment_usage(MODEL_FAST)
    return response.choices[0].message.content


def embed(text: str) -> list[float]:
    """Generate an embedding vector for semantic search."""
    client = _get_client()
    response = _call_with_retry(
        client.embeddings.create,
        model=MODEL_EMBED,
        input=text,
    )
    _increment_usage(MODEL_EMBED)
    return response.data[0].embedding
