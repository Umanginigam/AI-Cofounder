"""
Multi-step reasoning chains.

Currently provides the onboarding extraction chain — processes
the onboarding conversation to seed the startup knowledge graph.
"""

from __future__ import annotations

import json

from src.llm.client import extract
from src.memory import store


ONBOARDING_EXTRACTION_PROMPT = """\
You just completed an onboarding conversation with a founder. Extract their startup information.

Conversation:
{conversation}

Return a JSON object with these fields (use null if not mentioned):
{{
  "problem": "the problem they're solving",
  "icp": "their ideal customer profile / target customer",
  "value_prop": "their value proposition",
  "model": "their business model / how they make money",
  "stage": "their current stage (idea/mvp/revenue/scaling)",
  "product": "current product status",
  "competitors": "known competitors",
  "risk": "biggest risk or fear"
}}

Only include what was explicitly stated. Return valid JSON only.\
"""


def extract_onboarding(messages: list[dict[str, str]]) -> dict[str, str]:
    """
    Process the onboarding conversation and seed the startup context.
    Returns the extracted fields.
    """
    conversation_text = "\n".join(
        f"{m['role'].upper()}: {m['content']}" for m in messages
    )

    raw = extract([
        {"role": "system", "content": "Extract startup data from onboarding conversations. Return valid JSON only."},
        {"role": "user", "content": ONBOARDING_EXTRACTION_PROMPT.format(conversation=conversation_text)},
    ])

    try:
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1]
            raw = raw.rsplit("```", 1)[0]
        data = json.loads(raw)
    except (json.JSONDecodeError, IndexError):
        return {}

    extracted = {}
    for field, value in data.items():
        if value and value != "null":
            store.set_context(field, str(value))
            extracted[field] = str(value)

    return extracted
