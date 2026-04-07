"""
Pushback engine — the core differentiator.

Before each response, analyzes the situation and classifies whether
the AI should push back and how.

Classifications:
- CONTRADICTION: user says something conflicting with past statements
- UNVALIDATED_CLAIM: bold claim without evidence
- MISSING_PERSPECTIVE: ignoring obvious risk/competitor/angle
- COMMITMENT_DUE: outstanding commitments to check on
- NORMAL: no pushback needed
"""

from __future__ import annotations

import json
from enum import Enum

from src.llm.client import extract
from src.memory import store
from src.memory.retriever import get_open_commitments_formatted


class PushbackType(str, Enum):
    CONTRADICTION = "contradiction"
    UNVALIDATED_CLAIM = "unvalidated_claim"
    MISSING_PERSPECTIVE = "missing_perspective"
    COMMITMENT_DUE = "commitment_due"
    NORMAL = "normal"


ANALYSIS_PROMPT = """\
You are analyzing a founder's message to determine if it warrants pushback from their AI co-founder.

STARTUP CONTEXT (what we know):
{context}

RECENT DECISIONS:
{decisions}

OPEN COMMITMENTS:
{commitments}

FOUNDER'S MESSAGE:
{message}

Classify this into ONE of these categories:
- "contradiction": The message contradicts something in the startup context or past decisions.
- "unvalidated_claim": The founder makes a bold claim/assumption without evidence.
- "missing_perspective": The founder is ignoring an obvious risk, competitor, or important angle.
- "commitment_due": The founder has overdue or unaddressed commitments that should be raised.
- "normal": No pushback needed — the message is straightforward.

Respond with a JSON object:
{{
  "type": "contradiction|unvalidated_claim|missing_perspective|commitment_due|normal",
  "detail": "Brief explanation of what specifically triggered this classification. Empty string for normal."
}}

Only return valid JSON.\
"""


def analyze(message: str) -> tuple[PushbackType, str]:
    """
    Analyze a founder's message and determine pushback type.

    Returns (pushback_type, detail_string).
    """
    context_rows = store.get_context()
    context_str = "\n".join(f"- {r['field']}: {r['value']}" for r in context_rows) or "None yet."

    decisions = store.get_decisions(status="active")
    dec_str = "\n".join(f"- {d['decision']}" for d in decisions[:10]) or "None yet."

    commitments_str = get_open_commitments_formatted() or "None."

    if not context_rows and not decisions:
        return PushbackType.NORMAL, ""

    prompt = ANALYSIS_PROMPT.format(
        context=context_str,
        decisions=dec_str,
        commitments=commitments_str,
        message=message,
    )

    raw = extract([
        {"role": "system", "content": "You classify founder messages for pushback. Return valid JSON only."},
        {"role": "user", "content": prompt},
    ])

    try:
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1]
            raw = raw.rsplit("```", 1)[0]
        data = json.loads(raw)
        pb_type = PushbackType(data.get("type", "normal"))
        detail = data.get("detail", "")
        return pb_type, detail
    except (json.JSONDecodeError, ValueError):
        return PushbackType.NORMAL, ""


def get_pushback_prompt_modifier(pb_type: PushbackType, detail: str) -> str:
    """
    Return the system prompt modifier based on the pushback classification.
    """
    from src.llm.prompts import (
        PUSHBACK_CONTRADICTION,
        PUSHBACK_UNVALIDATED,
        PUSHBACK_MISSING_PERSPECTIVE,
        PUSHBACK_COMMITMENT_DUE,
    )
    from src.memory.retriever import get_open_commitments_formatted

    if pb_type == PushbackType.CONTRADICTION:
        parts = detail.split(" vs ", 1)
        old = parts[0] if len(parts) > 1 else detail
        new = parts[1] if len(parts) > 1 else detail
        return PUSHBACK_CONTRADICTION.format(
            old_statement=old, new_statement=new
        )

    if pb_type == PushbackType.UNVALIDATED_CLAIM:
        return PUSHBACK_UNVALIDATED

    if pb_type == PushbackType.MISSING_PERSPECTIVE:
        return PUSHBACK_MISSING_PERSPECTIVE.format(missing_angle=detail)

    if pb_type == PushbackType.COMMITMENT_DUE:
        commitments = get_open_commitments_formatted()
        return PUSHBACK_COMMITMENT_DUE.format(commitments=commitments)

    return ""
